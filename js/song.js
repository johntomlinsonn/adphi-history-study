/* ---------- song: learn XAIPE ----------
 The lyrics are plain text (see SONG in data.js). Parts are learned one at a time:
 sing along with the words, then with first letters only, then from memory, and
 chain the parts together as you go. Line times come from tapping along once while
 the song plays (Sync). Your edits and timings are saved in this browser.
 The recording is hosted with the site (audio/xaipe.mp3).
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
const P = {audio: null, hold: 0, pending: null};
function pAudio() {
  if (!P.audio) {
    const a = P.audio = new Audio();
    a.preload = 'auto'; a.preservesPitch = true;
    a.addEventListener('error', () => songMsg(`<span style="color:var(--bad)">The song didn't load. Check your connection and reload the page.</span>`));
    // A seek made before the song has loaded happens once it has
    a.addEventListener('loadedmetadata', () => { if (P.pending) { a.currentTime = P.pending.s; if (P.pending.play) pPlay(); P.pending = null; } });
    // Play it from memory: browsers only seek in a streamed file if the server supports range requests (server.py doesn't)
    fetch(SONG.audio).then(r => { if (!r.ok) throw r.status; return r.blob(); })
      .then(b => { a.src = URL.createObjectURL(b); }, () => { a.src = SONG.audio; });
  }
  P.audio.playbackRate = +S.songRate || 1;
  return P.audio;
}
const pNow = () => P.audio?.currentTime || 0;
const pPaused = () => !P.audio || P.audio.paused;
const pDur = () => P.audio?.duration || 0;
function pPlay() { const a = pAudio(); if (a.src) a.play().catch(() => {}); else P.pending = {s: 0, play: true}; }
function pPause() { P.audio?.pause(); }
function pToggle() { pPaused() ? pPlay() : pPause(); }
function pSeek(s, play) {
  P.hold = performance.now() + 900;
  const au = pAudio();
  if (!au.src || au.readyState < 1) return void (P.pending = {s: Math.max(0, s), play});
  au.currentTime = Math.max(0, s);
  if (play) pPlay();
}
function songLeave() { cancelAnimationFrame(SG.raf); P.audio?.pause(); }
function songRate(r) { S.songRate = r; save(); pAudio(); }

/* ---------- page ---------- */
function songStart() {
  songLoad();
  if (!SG.lines.length) SG.view = 'edit';
  else if (SG.view === 'edit' || SG.view === 'sync') SG.view = 'sing';
  pAudio();
  $('#app').innerHTML = `<div class="panel song-head">
    <div><h2>${esc(SONG.title)}</h2><p class="muted" style="margin:0">${esc(SONG.by)}${SONG.tune ? ` &middot; to the tune of ${esc(SONG.tune)}` : ''}</p></div>
    <input type="range" id="scrub" class="scrub" min="0" max="${Math.round(pDur()) || 145}" step="0.1" value="${pNow()}" aria-label="Position in the song"
      oninput="SG.scrubbing=true;pSeek(+this.value, !pPaused())" onchange="SG.scrubbing=false">
    <div class="row"><span class="muted">Speed</span>${['0.75', '0.9', '1'].map(r => `<button class="chip ${(S.songRate || '1') === r ? 'on' : ''}" onclick="songRate('${r}');this.parentNode.querySelectorAll('.chip').forEach(b=>b.classList.toggle('on',b===this))">${r}&times;</button>`).join('')}
      <span class="muted">Slow it down while you learn the words.</span></div>
    <div class="micstat" id="songmsg"></div></div>
  <div id="songbody"></div>`;
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
// The parts chosen to practice (any mix, in song order), or null for the whole song.
// Parts next to each other play straight through; playback skips over the ones not chosen.
const songSel = () => (S.songSel || []).filter(pi => pi < SG.parts.length).sort((a, b) => a - b);
function partEnd(pi) {
  const next = SG.parts[pi + 1], last = SG.parts[pi].lines.at(-1);
  return next ? next.lines[0].t : last.t == null ? null : Math.min(pDur() || 1e9, last.t + 8);
}
function songRange() {
  const sel = songSel();
  if (!sel.length) return null;
  const runs = [];
  sel.forEach(pi => {
    const r = runs.at(-1);
    if (r && r.b === pi - 1) { r.b = pi; r.end = partEnd(pi); }
    else runs.push({a: pi, b: pi, start: SG.parts[pi].lines[0].t, end: partEnd(pi)});
  });
  return {sel, runs, has: pi => sel.includes(pi), timed: runs.every(r => r.start != null && r.end != null)};
}
const rangeName = r => !r ? 'Whole song' : r.sel.length === 1 ? SG.parts[r.sel[0]].name
  : r.sel.length <= 3 ? r.sel.map(pi => SG.parts[pi].name).join(' + ') : `${r.sel.length} parts`;
const wordsHTML = s => s ? s.split(/\s+/).map(w => {
  const m = w.match(/^([^\p{L}\p{N}]*[\p{L}\p{N}]?)(.*)$/u);
  return `<span class="w">${esc(m[1])}<span class="r">${esc(m[2])}</span></span>`;
}).join(' ') : '<span class="note">&#9834;</span>';

function singRender() {
  const r = songRange(), done = store.get('songDone', {}), synced = songSynced();
  const parts = SG.parts.map((p, pi) => [p, pi]).filter(([, pi]) => !r || r.has(pi));
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
      ${SG.parts.map((p, pi) => `<button class="chip ${r?.has(pi) ? 'on' : ''} ${done[pi] ? 'done' : ''}" onclick="songToggle(${pi})" aria-pressed="${!!r?.has(pi)}">${pi + 1}. ${esc(p.name)}</button>`).join('')}
    </div>
  </div>
  ${!synced ? `<div class="panel song-note"><b>The words aren't timed to the music yet.</b> Tap along once and they'll follow the song from then on.
     <div class="row" style="margin-top:8px"><button class="btn" onclick="songView('sync')">Sync the lyrics</button></div></div>` : ''}
  <div class="panel lyrics m-${words} ${synced ? '' : 'unsynced'}" id="lyrics">
    <div class="row lyr-top"><b>${esc(rangeName(r))}</b><span class="muted" id="songcue"></span><span class="spacer"></span>
      ${r && synced ? `<label class="toggle"><input type="checkbox" ${S.songLoop !== false ? 'checked' : ''} onchange="S.songLoop=this.checked;save()"> Loop</label>` : ''}</div>
    ${parts.map(([p, pi], j) => `${j && parts[j - 1][1] !== pi - 1 ? '<div class="skip">skips ahead</div>' : ''}<h4>${pi + 1}. ${esc(p.name)}${done[pi] ? ' <span class="badge ok">Learned</span>' : ''}</h4>
      ${p.lines.map(l => `<div class="ln" data-k="${SG.lines.indexOf(l)}" onclick="songLine(${SG.lines.indexOf(l)})">${wordsHTML(l.text)}</div>`).join('')}`).join('')}
    ${r ? songActs(r, done) : ''}
  </div>
  <div class="panel"><h3>How to learn it</h3><ol class="plan">
    <li>Pick <b>Part 1</b>. Sing along a few loops with the <b>Words</b> showing. Tap more parts to practice several at once; tap a part again to drop it.</li>
    <li>Switch to <b>Hints</b> (first letters only), then <b>Hidden</b>. Lines show once they've been sung so you can check yourself.</li>
    <li>When you can sing it hidden, tap <b>I know this part</b> and go to the next one.</li>
    <li>After each new part, tap <b>Sing it from the start</b> to join it to the parts before. Finish with the whole song, hidden.</li></ol>
    <p class="muted">${nDone} of ${SG.parts.length} parts learned. ${keyHint('Keys: <kbd>Space</kbd> play/pause, <kbd>&larr;</kbd> <kbd>&rarr;</kbd> previous/next line, <kbd>1</kbd>&ndash;<kbd>9</kbd> add/drop a part, <kbd>0</kbd> whole song, <kbd>H</kbd> words/hints/hidden.', 'Tap a line to jump to it.')}</p>
    <details class="more"><summary>Lyrics and timing</summary><div class="more-body">
      ${synced ? `<div class="row"><span class="muted">Words come in</span>
        <button class="btn alt" onclick="songShift(-0.1)">Earlier</button><button class="btn alt" onclick="songShift(0.1)">Later</button>
        <span class="muted" id="songoff">${songOff()}</span></div>` : ''}
      <div class="row"><button class="btn alt" onclick="songView('edit')">Edit the lyrics</button>
        <button class="btn alt" onclick="songView('sync')">${synced ? 'Re-sync' : 'Sync'} ${!r ? 'the lyrics' : r.sel.length === 1 ? 'this part' : 'these parts'}</button>
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
function songActs(r, done) {
  const one = r.sel.length === 1 ? r.sel[0] : null, hi = r.sel.at(-1), last = SG.parts.length - 1;
  const fromStart = r.sel.length === hi + 1;
  return `<div class="row lyr-acts">
    ${one != null ? `<button class="btn ${done[one] ? 'alt' : ''}" onclick="songDone(${one})">${done[one] ? 'Not learned yet' : 'I know this part'}</button>` : ''}
    ${!fromStart ? `<button class="btn alt" onclick="songSet([...Array(${hi + 1}).keys()])">Sing it from the start</button>` : ''}
    ${hi < last ? one != null ? `<button class="btn alt" onclick="songSet([${hi + 1}])">Next part</button>`
      : `<button class="btn alt" onclick="songSet([...songSel(), ${hi + 1}])">Add the next part</button>` : ''}</div>`;
}
// Choose these parts and play from the first of them
function songSet(sel) {
  S.songSel = [...new Set(sel)].sort((a, b) => a - b); save();
  singRender();
  const r = songRange();
  if (songSynced()) pSeek(r ? r.runs[0].start - LEAD : 0, true);
  window.scrollTo({top: 0, behavior: 'smooth'});
}
function songPick(pi) { songSet(pi < 0 ? [] : [pi]); }
// Tapping a part adds it to the parts being practiced, or drops it. Keep playing where you are when you can.
function songToggle(pi) {
  const sel = songSel(), on = sel.includes(pi);
  S.songSel = on ? sel.filter(x => x !== pi) : [...sel, pi].sort((a, b) => a - b); save();
  const t = pNow() + (S.songOffset || 0), r = songRange(), playing = !pPaused();
  singRender();
  if (!songSynced()) return;
  const inside = r && r.runs.some(x => t >= x.start - LEAD - .5 && t <= x.end);
  if (!r) return;
  if (!playing) pSeek(r.runs[0].start - LEAD, false);
  else if (!inside) pSeek((r.runs.find(x => x.start > t) || r.runs[0]).start - LEAD, true);
}
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
  const sc = $('#scrub');
  if (sc && !SG.scrubbing) { if (pDur() && +sc.max !== Math.round(pDur())) sc.max = Math.round(pDur()); sc.value = raw; }
  if (SG.view === 'sync') return syncTick(raw, playing);
  if (SG.view !== 'sing') return;
  const t = raw + (S.songOffset || 0);
  const r = songRange();
  // Outside the chosen parts: skip ahead to the next one, or at the end go round again (or stop)
  if (r && r.timed && playing && performance.now() > P.hold && !r.runs.some(x => t >= x.start - LEAD - .5 && t <= x.end + .2)) {
    const next = r.runs.find(x => x.start > t);
    if (next) pSeek(next.start - (t > r.runs[0].start ? 1 : LEAD), true);
    else if (S.songLoop !== false) pSeek(r.runs[0].start - LEAD, true);
    else { pPause(); P.hold = performance.now() + 900; }
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
  const idx = SG.lines.filter(l => !r || r.has(l.p)).map(l => SG.lines.indexOf(l));
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
  S.songSel = songSel();
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
  else if (/^[1-9]$/.test(k) && +k <= SG.parts.length) songToggle(+k - 1);
  else return;
  return true;
}
