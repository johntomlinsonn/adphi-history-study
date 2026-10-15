/* ---------- song: learn XAIPE ----------
 The lyrics are plain text (see SONG in data.js). Parts are learned one at a time:
 sing along with the words, then with first letters only, then from memory, and
 chain the parts together as you go. Line times come from tapping along once while
 the song plays (Sync). Your edits and timings are saved in this browser.
 Playback is the Spotify embed (its IFrame API reports the position) or an audio file.
*/
const TS = /^\[(\d+):(\d{1,2}(?:\.\d+)?)\]\s*/;
const LEAD = 2;                                    // seconds of run-up before a part starts
const fmtTS = t => `[${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}]`;
const fmtClock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function songParse(text) {
  const parts = [];
  let cur = null;
  const open = name => { cur = {name: name || `Part ${parts.length + 1}`, lines: []}; parts.push(cur); };
  for (const raw of String(text || '').split(/\r?\n/)) {
    const s = raw.trim();
    if (!s) { if (cur?.lines.length) cur = null; continue; }
    const head = !TS.test(s) && s.match(/^\[(.*)\]$/);
    if (head) { if (cur && !cur.lines.length) cur.name = head[1].trim() || cur.name; else open(head[1].trim()); continue; }
    const m = s.match(TS);
    if (!cur) open();
    cur.lines.push({t: m ? +m[1] * 60 + +m[2] : null, text: m ? s.slice(m[0].length) : s});
  }
  return parts;
}
const songText = parts => parts.map(p => `[${p.name}]\n` + p.lines.map(l => (l.t == null ? '' : fmtTS(l.t) + ' ') + l.text).join('\n')).join('\n\n');

let SG = {view: 'sing', k: -1, userScroll: 0};
function songLoad() {
  SG.parts = songParse(store.get('songText', null) ?? SONG.text);
  SG.lines = SG.parts.flatMap((p, pi) => p.lines.map((l, li) => Object.assign(l, {p: pi, li})));
}
function songSave() { store.set('songText', songText(SG.parts)); songLoad(); }
const songSynced = () => SG.lines.length > 0 && SG.lines.every(l => l.t != null);

/* ---------- player ---------- */
const P = {ctl: null, audio: null, file: '', pos: 0, at: 0, paused: true, dur: 0, started: false, hold: 0, nudge: 0};
const useFile = () => S.songSrc === 'file' && P.audio;
function pNow() {
  if (useFile()) return P.audio.currentTime;
  return P.paused ? P.pos : Math.min(P.dur || 1e9, P.pos + (performance.now() - P.at) / 1000);
}
const pPaused = () => useFile() ? P.audio.paused : P.paused;
const pDur = () => useFile() ? P.audio.duration || 0 : P.dur;
function pPlay() {
  if (useFile()) return void P.audio.play();
  if (!P.ctl) return;
  P.started ? P.ctl.resume() : P.ctl.play();
  P.started = true;
  // Some browsers only let the Spotify player start from a tap inside it
  clearTimeout(P.nudge);
  P.nudge = setTimeout(() => { if (P.paused) songMsg('If nothing plays, press play on the Spotify player once. After that these buttons work.'); }, 1800);
}
function pPause() { useFile() ? P.audio.pause() : P.ctl?.pause(); }
function pToggle() { pPaused() ? pPlay() : pPause(); }
function pSeek(s, play) {
  s = Math.max(0, s);
  P.hold = performance.now() + 900;
  if (useFile()) { P.audio.currentTime = s; if (play) P.audio.play(); return; }
  if (!P.ctl) return;
  P.pos = s; P.at = performance.now();
  if (!P.started) { pPlay(); setTimeout(() => P.ctl?.seek(s), 700); }   // the embed seeks only once it has started
  else { P.ctl.seek(s); if (play) P.ctl.resume(); }
}

let spotifyAPI, spotifyWait = [];
window.onSpotifyIframeApiReady = api => { spotifyAPI = api; spotifyWait.splice(0).forEach(f => f(api)); };
function loadSpotify() {
  return new Promise((res, rej) => {
    if (spotifyAPI) return res(spotifyAPI);
    spotifyWait.push(res);
    if (document.getElementById('spotify-api')) return;
    const s = document.createElement('script');
    s.id = 'spotify-api'; s.src = 'https://open.spotify.com/embed/iframe-api/v1'; s.async = true;
    s.onerror = () => { s.remove(); spotifyWait = []; rej(); };
    document.head.appendChild(s);
  });
}
function mountSpotify() {
  const host = $('#sp');
  if (!host) return;
  loadSpotify().then(api => {
    if (!document.body.contains(host)) return;
    api.createController(host, {uri: 'spotify:track:' + SONG.spotify, width: '100%', height: 80}, ctl => {
      P.ctl = ctl; P.started = false; P.paused = true; P.pos = 0;
      ctl.addListener('playback_update', e => {
        const d = e.data;
        P.pos = d.position / 1000; P.at = performance.now(); P.dur = d.duration / 1000;
        P.paused = d.isPaused || d.isBuffering;
        if (!d.isPaused) { P.started = true; clearTimeout(P.nudge); }
      });
    });
  }).catch(() => { host.innerHTML = `<p class="muted">The Spotify player didn't load. Check your connection, or use an audio file of the song instead.</p>`; });
}
function songLeave() {
  cancelAnimationFrame(SG.raf);
  clearTimeout(P.nudge);
  try { P.ctl?.destroy(); } catch {}
  P.ctl = null; P.paused = true; P.started = false; P.pos = 0;
  P.audio?.pause();
}
function songSrc(k) { pPause(); S.songSrc = k; save(); songLeave(); songStart(); }
function songFile(input) {
  const f = input.files[0];
  if (!f) return;
  if (!P.audio) { P.audio = new Audio(); P.audio.preservesPitch = true; }
  if (P.audio.src) URL.revokeObjectURL(P.audio.src);
  P.audio.src = URL.createObjectURL(f);
  P.audio.playbackRate = +S.songRate || 1;
  P.file = f.name;
  songStart();
}
function songRate(r) { S.songRate = r; save(); if (P.audio) P.audio.playbackRate = +r; }

/* ---------- page ---------- */
function songStart() {
  songLoad();
  if (!SG.lines.length) SG.view = 'edit';
  else if (SG.view === 'edit' || SG.view === 'sync') SG.view = 'sing';
  const file = S.songSrc === 'file';
  $('#app').innerHTML = `<div class="panel song-head">
    <div><h2>${esc(SONG.title)}</h2><p class="muted" style="margin:0">${esc(SONG.by)}${SONG.tune ? ` &middot; to the tune of ${esc(SONG.tune)}` : ''}</p></div>
    <div class="seg">${[['spotify', 'Spotify'], ['file', 'Audio file']].map(([k, l]) => `<button class="${(S.songSrc || 'spotify') === k ? 'on' : ''}" onclick="songSrc('${k}')">${l}</button>`).join('')}</div>
    ${file ? `<div class="row"><label class="btn alt">Choose the song file<input type="file" accept="audio/*" hidden onchange="songFile(this)"></label>
        <span class="muted">${P.file ? esc(P.file) : 'An MP3 or M4A of the recording. It stays on this device.'}</span></div>
        <div class="row"><span class="muted">Speed</span>${['0.75', '0.9', '1'].map(r => `<button class="chip ${(S.songRate || '1') === r ? 'on' : ''}" onclick="songRate('${r}');this.parentNode.querySelectorAll('.chip').forEach(b=>b.classList.toggle('on',b===this))">${r}&times;</button>`).join('')}</div>`
      : `<div id="sp" class="sp"><p class="muted">Loading the Spotify player&hellip;</p></div>
        <p class="muted" id="spnote" style="margin:0">Log in at open.spotify.com in this browser to hear the full song. Without an account, Spotify only plays a 30-second preview.</p>`}
    <div class="micstat" id="songmsg"></div></div>
  <div id="songbody"></div>`;
  if (!file) mountSpotify();
  songView(SG.view);
  cancelAnimationFrame(SG.raf);
  SG.raf = requestAnimationFrame(songTick);
}
function songMsg(html) { const m = $('#songmsg'); if (m) m.innerHTML = html; }
function songView(v) {
  SG.view = v; SG.k = -2;
  ({sing: singRender, sync: syncRender, edit: editRender})[v]();
}
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

/* ---------- sing along ---------- */
function songRange() {
  const n = SG.parts.length, a = S.songA ?? -1;
  if (a < 0 || a >= n) return null;
  const b = Math.min(Math.max(a, S.songB ?? a), n - 1);
  const next = SG.parts[b + 1], last = SG.parts[b].lines.at(-1);
  const end = next ? next.lines[0].t : last.t == null ? null : Math.min(pDur() || 1e9, last.t + 8);
  return {a, b, start: SG.parts[a].lines[0].t, end};
}
const rangeName = r => !r ? 'Whole song' : r.a === r.b ? SG.parts[r.a].name : `${SG.parts[r.a].name} → ${SG.parts[r.b].name}`;
const wordsHTML = s => s ? s.split(/\s+/).map(w => {
  const m = w.match(/^([^\p{L}\p{N}]*[\p{L}\p{N}]?)(.*)$/u);
  return `<span class="w">${esc(m[1])}<span class="r">${esc(m[2])}</span></span>`;
}).join(' ') : '<span class="note">&#9834;</span>';

function singRender() {
  const r = songRange(), done = store.get('songDone', {}), synced = songSynced();
  const parts = SG.parts.map((p, pi) => [p, pi]).filter(([, pi]) => !r || (pi >= r.a && pi <= r.b));
  const nDone = SG.parts.filter((p, pi) => done[pi]).length;
  const words = S.songWords || 'show';
  $('#songbody').innerHTML = `
  <div class="song-ctl" id="songctl">
    <div class="row">
      <button class="playbtn" id="playbtn" onclick="pToggle()" aria-label="Play or pause">${PLAY}</button>
      <span class="stime" id="stime">0:00</span>
      <span class="spacer"></span>
      <div class="seg words">${[['show', 'Words'], ['hint', 'Hints'], ['hide', 'Hidden']].map(([k, l]) => `<button class="${words === k ? 'on' : ''}" onclick="songWords('${k}')">${l}</button>`).join('')}</div>
    </div>
    <div class="chips">
      <button class="chip ${!r ? 'on' : ''}" onclick="songPick(-1)">Whole song</button>
      ${SG.parts.map((p, pi) => `<button class="chip ${r && r.a === pi && r.b === pi ? 'on' : ''} ${done[pi] ? 'done' : ''}" onclick="songPick(${pi})">${pi + 1}. ${esc(p.name)}</button>`).join('')}
    </div>
  </div>
  ${!synced ? `<div class="panel song-note"><b>The words aren't timed to the music yet.</b> Tap along once and they'll follow the song from then on.
     <div class="row" style="margin-top:8px"><button class="btn" onclick="songView('sync')">Sync the lyrics</button></div></div>` : ''}
  <div class="panel lyrics m-${words} ${synced ? '' : 'unsynced'}" id="lyrics">
    <div class="row lyr-top"><b>${esc(rangeName(r))}</b><span class="muted" id="songcue"></span><span class="spacer"></span>
      ${r && synced ? `<label class="toggle"><input type="checkbox" ${S.songLoop !== false ? 'checked' : ''} onchange="S.songLoop=this.checked;save()"> Loop</label>` : ''}</div>
    ${parts.map(([p, pi]) => `<h4>${pi + 1}. ${esc(p.name)}${done[pi] ? ' <span class="badge ok">Learned</span>' : ''}</h4>
      ${p.lines.map(l => `<div class="ln" data-k="${SG.lines.indexOf(l)}" onclick="songLine(${SG.lines.indexOf(l)})">${wordsHTML(l.text)}</div>`).join('')}`).join('')}
    ${r ? `<div class="row lyr-acts">
      ${r.a === r.b ? `<button class="btn ${done[r.a] ? 'alt' : ''}" onclick="songDone(${r.a})">${done[r.a] ? 'Not learned yet' : 'I know this part'}</button>` : ''}
      ${r.a > 0 ? `<button class="btn alt" onclick="songChain()">Sing it from the start</button>` : ''}
      ${r.b < SG.parts.length - 1 ? `<button class="btn alt" onclick="songPick(${r.b + 1})">Next part</button>` : ''}</div>` : ''}
  </div>
  <div class="panel"><h3>How to learn it</h3><ol class="plan">
    <li>Pick <b>Part 1</b>. Sing along a few loops with the <b>Words</b> showing.</li>
    <li>Switch to <b>Hints</b> (first letters only), then <b>Hidden</b>. Lines show once they've been sung so you can check yourself.</li>
    <li>When you can sing it hidden, tap <b>I know this part</b> and go to the next one.</li>
    <li>After each new part, tap <b>Sing it from the start</b> to join it to the parts before. Finish with the whole song, hidden.</li></ol>
    <p class="muted">${nDone} of ${SG.parts.length} parts learned. ${keyHint('Keys: <kbd>Space</kbd> play/pause, <kbd>&larr;</kbd> <kbd>&rarr;</kbd> previous/next line, <kbd>1</kbd>&ndash;<kbd>9</kbd> parts, <kbd>0</kbd> whole song, <kbd>H</kbd> words/hints/hidden.', 'Tap a line to jump to it.')}</p>
    <details class="more"><summary>Lyrics and timing</summary><div class="more-body">
      ${synced ? `<div class="row"><span class="muted">Words come in</span>
        <button class="btn alt" onclick="songShift(-0.1)">Earlier</button><button class="btn alt" onclick="songShift(0.1)">Later</button>
        <span class="muted" id="songoff">${songOff()}</span></div>` : ''}
      <div class="row"><button class="btn alt" onclick="songView('edit')">Edit the lyrics</button>
        <button class="btn alt" onclick="songView('sync')">${synced ? 'Re-sync' : 'Sync'} ${r ? 'this part' : 'the lyrics'}</button>
        <button class="btn alt" onclick="songCopy()">Copy lyrics with timings</button></div>
      ${store.get('songText', null) != null && SONG.text ? `<button class="btn ghost" onclick="if(confirm('Replace your lyrics and timings with the site version?')){store.set('songText',null);songStart()}">Use the site version</button>` : ''}
    </div></details></div>`;
  songSize();
}
const songOff = () => { const o = S.songOffset || 0; return o ? `${Math.abs(o).toFixed(1)}s ${o > 0 ? 'earlier' : 'later'}` : 'on the beat'; };
function songShift(d) { S.songOffset = Math.round(((S.songOffset || 0) - d) * 10) / 10; save(); $('#songoff').textContent = songOff(); }
function songWords(k) {
  S.songWords = k; save();
  $('#lyrics').classList.remove('m-show', 'm-hint', 'm-hide'); $('#lyrics').classList.add('m-' + k);
  document.querySelectorAll('.words button').forEach((b, i) => b.classList.toggle('on', ['show', 'hint', 'hide'][i] === k));
}
function songPick(pi) {
  S.songA = pi < 0 ? null : pi; S.songB = S.songA; save();
  singRender();
  const r = songRange();
  if (songSynced()) pSeek(r ? r.start - LEAD : 0, true);
  window.scrollTo({top: 0, behavior: 'smooth'});
}
function songChain() { S.songA = 0; save(); singRender(); const r = songRange(); if (songSynced()) pSeek(r.start - LEAD, true); }
function songDone(pi) {
  const d = store.get('songDone', {});
  d[pi] ? delete d[pi] : d[pi] = true;
  store.set('songDone', d);
  singRender();
}
function songLine(k) {
  const l = SG.lines[k];
  if (l.t == null) return void document.querySelector(`.ln[data-k="${k}"]`)?.classList.toggle('peek');
  pSeek(l.t - (S.songOffset || 0) - .3, true);
}
function songStep(d) {
  const timed = SG.lines.filter(l => l.t != null);
  if (!timed.length) return;
  const cur = timed.findIndex(l => SG.lines.indexOf(l) === SG.k);
  const l = timed[Math.max(0, Math.min(timed.length - 1, cur < 0 ? 0 : cur + d))];
  songLine(SG.lines.indexOf(l));
}
async function songCopy() {
  const text = songText(SG.parts);
  try { await navigator.clipboard.writeText(text); songMsg('Copied. Paste it between the backticks of <b>SONG.text</b> in <b>js/data.js</b> to put it on the site for everyone.'); }
  catch { SG.view = 'edit'; editRender(); songMsg('Copy the text below.'); }
}
// The play strip sits under the header, whose height changes with the screen width
function songSize() { document.body.style.setProperty('--hh', $('header').offsetHeight + 'px'); }
addEventListener('resize', () => { if (mode === 'song') songSize(); });
['wheel', 'touchmove'].forEach(e => addEventListener(e, () => { SG.userScroll = performance.now(); }, {passive: true}));

function songTick() {
  SG.raf = requestAnimationFrame(songTick);
  const raw = pNow(), playing = !pPaused();
  const btn = $('#playbtn');
  if (btn && btn.dataset.on !== String(playing)) { btn.dataset.on = playing; btn.innerHTML = playing ? PAUSE : PLAY; }
  const st = $('#stime');
  if (st) st.textContent = fmtClock(raw) + (pDur() ? ' / ' + fmtClock(pDur()) : '');
  if (!useFile() && P.dur && P.dur < 35 && $('#spnote')) $('#spnote').innerHTML = '<b>Spotify is playing a 30-second preview.</b> Log in at open.spotify.com in this browser, then reload this page, to hear the whole song.';
  if (SG.view === 'sync') return syncTick(raw, playing);
  if (SG.view !== 'sing') return;
  const t = raw + (S.songOffset || 0);
  const r = songRange();
  // At the end of the chosen part: go round again, or stop
  if (r && r.end != null && playing && performance.now() > P.hold && t > r.end + .2) {
    if (S.songLoop !== false) pSeek(r.start - LEAD, true); else { pPause(); P.hold = performance.now() + 900; }
  }
  let k = -1;
  SG.lines.forEach((l, j) => { if (l.t != null && l.t <= t) k = j; });
  if (k !== SG.k) {
    SG.k = k;
    document.querySelectorAll('#lyrics .ln').forEach(el => {
      const j = +el.dataset.k;
      el.classList.toggle('on', j === k); el.classList.toggle('past', j < k);
    });
    const el = document.querySelector(`#lyrics .ln[data-k="${k}"]`);
    if (el && playing && performance.now() - SG.userScroll > 3000) el.scrollIntoView({block: 'center', behavior: 'smooth'});
  }
  // The recording opens with the tune played through: count down to the first words
  const first = SG.lines.find(l => l.t != null), cue = $('#songcue');
  if (cue) cue.textContent = first && k < 0 && first.t - t > 3 && (playing || t > 1) ? `Intro: words in ${Math.ceil(first.t - t)}s` : '';
  if (k >= 0) {
    const l = SG.lines[k], next = SG.lines.slice(k + 1).find(x => x.t != null);
    const end = next ? next.t : l.t + 4;
    document.querySelector(`#lyrics .ln[data-k="${k}"]`)?.style.setProperty('--p', Math.max(0, Math.min(1, (t - l.t) / (end - l.t))));
  }
}

/* ---------- sync: tap as each line starts ---------- */
const REACT = .15;                                 // taps land a little after the line starts
function syncRender() {
  const r = songRange();
  const idx = SG.lines.filter(l => !r || (l.p >= r.a && l.p <= r.b)).map(l => SG.lines.indexOf(l));
  // Start a little before the first line if it's timed already, else just after the line before it
  const first = SG.lines[idx[0]], before = SG.lines.slice(0, idx[0]).reverse().find(l => l.t != null);
  SG.sync = {idx, i: 0, from: first.t != null ? first.t - 3 : before ? before.t + .5 : 0, old: idx.map(k => SG.lines[k].t)};
  $('#songbody').innerHTML = `<div class="song-ctl" id="songctl"><div class="row">
      <button class="playbtn" id="playbtn" onclick="pToggle()" aria-label="Play or pause">${PLAY}</button>
      <span class="stime" id="stime">0:00</span><span class="spacer"></span>
      <button class="btn ghost" onclick="syncCancel()">Cancel</button></div></div>
    <div class="card sync-card">
      <div class="tag">Syncing ${esc(rangeName(r))}</div>
      <p class="muted">Play the song and tap the moment each line <b>starts</b>. Got one wrong? Undo goes back a line.</p>
      <div id="syncprev" class="sync-prev"></div>
      <div id="syncnow" class="sync-now"></div>
      <div id="syncnext" class="sync-next"></div>
      <div class="bar" style="margin:14px 0"><i id="syncbar" style="width:0"></i></div>
      <button class="btn sync-tap" id="synctap" onclick="syncTap()"></button>
      <div class="row" style="justify-content:center;margin-top:10px">
        <button class="btn alt" onclick="syncUndo()">Undo ${keyHint('<kbd>&#9003;</kbd>', '')}</button>
        <button class="btn alt" onclick="syncRestart()">Start over</button>
        <button class="btn alt" onclick="syncFinish()">Save what's done</button></div></div>`;
  songSize();
  syncDraw();
}
function syncDraw() {
  const {idx, i} = SG.sync, line = j => SG.lines[idx[j]];
  $('#syncprev').innerHTML = i > 0 ? `<span>${fmtTS(line(i - 1).t)}</span> ${esc(line(i - 1).text || '♪')}` : '';
  $('#syncnow').textContent = i < idx.length ? line(i).text || '♪ (instrumental)' : 'All lines timed';
  $('#syncnext').textContent = i + 1 < idx.length ? line(i + 1).text : '';
  $('#syncbar').style.width = i / idx.length * 100 + '%';
}
function syncTick(raw, playing) {
  const b = $('#synctap');
  if (!b) return;
  const label = !playing ? `${PLAY} Play from ${fmtClock(Math.max(0, SG.sync.i ? SG.lines[SG.sync.idx[SG.sync.i - 1]].t : SG.sync.from))}` : `Tap: line starts ${keyHint('<kbd>Space</kbd>', '')}`;
  if (b.dataset.l !== label) { b.dataset.l = label; b.innerHTML = label; }
}
function syncTap() {
  const s = SG.sync;
  if (pPaused()) return pSeek(s.i ? SG.lines[s.idx[s.i - 1]].t : s.from, true);
  if (s.i >= s.idx.length) return;
  const prev = s.i ? SG.lines[s.idx[s.i - 1]].t : -1;
  SG.lines[s.idx[s.i]].t = Math.round(Math.max(prev + .1, pNow() - REACT) * 100) / 100;
  s.i++;
  syncDraw();
  if (s.i === s.idx.length) setTimeout(syncFinish, 400);
}
function syncUndo() {
  const s = SG.sync;
  if (!s.i) return;
  s.i--;
  SG.lines[s.idx[s.i]].t = s.old[s.i];
  const back = s.i ? SG.lines[s.idx[s.i - 1]].t - 1 : s.from;
  pSeek(back, !pPaused());
  syncDraw();
}
function syncRestart() { const s = SG.sync; s.idx.forEach((k, j) => { SG.lines[k].t = s.old[j]; }); s.i = 0; pSeek(s.from, true); syncDraw(); }
function syncCancel() { const s = SG.sync; s.idx.forEach((k, j) => { SG.lines[k].t = s.old[j]; }); pPause(); songView('sing'); }
function syncFinish() {
  if (SG.view !== 'sync') return;
  // Lines after the ones tapped keep their old times only if those still come later
  const s = SG.sync;
  let last = -1;
  SG.lines.forEach(l => { if (l.t != null) { if (l.t <= last) l.t = null; else last = l.t; } });
  songSave();
  pPause();
  songView('sing');
  songMsg(s.i ? `Saved ${s.i} line time${s.i === 1 ? '' : 's'}. If the words feel early or late, nudge them under <b>Lyrics and timing</b>.` : '');
}

/* ---------- edit ---------- */
function editRender() {
  const has = SG.lines.length;
  $('#songbody').innerHTML = `<div class="panel">
    <h3>${has ? 'Edit the lyrics' : 'Add the lyrics'}</h3>
    ${has ? '' : `<p>Paste the words of ${esc(SONG.title)} from your chapter's songbook. Then you'll tap along once to time them to the recording.</p>`}
    <p class="muted">One sung line per line. Start each part with its name in brackets, like <b>[Verse 1]</b>, or leave a blank line between parts.
      Times like <b>[0:12.50]</b> at the start of a line are filled in by Sync; you can fix them by hand.</p>
    <textarea id="songtext" class="song-text" rows="16" spellcheck="false" placeholder="[Verse 1]&#10;First line of the verse&#10;Second line&#10;&#10;[Chorus]&#10;First line of the chorus">${esc(has ? songText(SG.parts) : '')}</textarea>
    <div class="row"><button class="btn" onclick="editSave()">Save</button>${has ? `<button class="btn alt" onclick="songView('sing')">Cancel</button>` : ''}</div></div>`;
}
function editSave() {
  const parts = songParse($('#songtext').value);
  if (!parts.length) return songMsg('<span style="color:var(--bad)">Paste the lyrics first.</span>');
  store.set('songText', songText(parts));
  songLoad();
  if ((S.songA ?? -1) >= SG.parts.length) S.songA = S.songB = null;
  save();
  songMsg('');
  songView('sing');
}

function songKey(k) {
  if (SG.view === 'sync') {
    if (k === ' ' || k === 'enter') syncTap();
    else if (k === 'backspace') syncUndo();
    else if (k === 'escape') syncCancel();
    else return;
    return true;
  }
  if (SG.view !== 'sing') return;
  if (k === ' ') pToggle();
  else if (k === 'arrowleft') songStep(-1);
  else if (k === 'arrowright') songStep(1);
  else if (k === 'h') songWords({show: 'hint', hint: 'hide', hide: 'show'}[S.songWords || 'show']);
  else if (k === '0') songPick(-1);
  else if (/^[1-9]$/.test(k) && +k <= SG.parts.length) songPick(+k - 1);
  else return;
  return true;
}
