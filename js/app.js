/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('adphi.' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('adphi.' + k, JSON.stringify(v)); } catch {} },
};

const ICON = {
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/></svg>',
  learn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M7 10.5V16c3 2 7 2 10 0v-5.5"/></svg>',
  test: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 4h6M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><path d="M8 13l3 3 5-6"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
  keyboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  abc: '<svg viewBox="0 0 24 24"><text x="12" y="18.5" text-anchor="middle" font-size="18" font-family="Times New Roman,serif" fill="currentColor">\u03a9</text></svg>',
  speaker: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
};
const micIcon = n => ICON.mic.replace('<svg', `<svg width="${n}" height="${n}"`);

/* ---------- settings ---------- */
const CATS = [...new Set(CARDS.map(c => c.cat))];
const S = Object.assign({
  cats: CATS, engine: 'auto', dir: 'td', autoListen: true, autoAdvance: true, patient: false, preview: true, readAloud: false,
  testN: 15, types: {mc: true, tf: true, w: true, match: true}, stN: 10, fb: 'instant', sfb: 'instant',
}, store.get('settings', {}));
S.cats = S.cats.filter(c => CATS.includes(c));
if (!S.cats.length) S.cats = CATS;
const save = () => store.set('settings', S);

/* ---------- memory across sessions ----------
 Each card has a Leitner box 0-5: up one on a right answer, back to 0 on a miss.
 Learn sessions start with the weakest cards, then new ones, then the strong ones.
*/
const STATS = store.get('stats', {});
function stat(id, ok, undo) {
  const s = STATS[id] || (STATS[id] = {r: 0, w: 0, box: 0});
  if (undo) { s[ok ? 'r' : 'w']--; s.box = s.pb ?? s.box; }
  else { s[ok ? 'r' : 'w']++; s.pb = s.box || 0; s.box = ok ? Math.min(5, (s.box || 0) + 1) : 0; }
  s.seen = Date.now();
  store.set('stats', STATS);
}
function markSeen(id) { if (!STATS[id]) { STATS[id] = {r: 0, w: 0, box: 0, seen: Date.now()}; store.set('stats', STATS); } }
const isNew = id => !STATS[id];

const pool = () => CARDS.filter(c => S.cats.includes(c.cat));
// kind: 'mc' | 'w' (written) | 'say'
const pickDir = (c, kind) => c.fwd || c.part || (c.glyph && kind !== 'mc') ? 'td' : S.dir === 'mixed' ? pick(['td', 'dt']) : S.dir;
const answerOf = (c, dir) => dir === 'td' ? c.def : c.term;

/* ---------- learning schedule ----------
 Long answers (parts) are learned piece by piece: each part is its own card and the
 whole answer unlocks once the parts are mastered. Within a session, at most 6 cards
 are in play; a missed card comes back after 2 others, a right one after 3.
*/
const SUBS = {};
const lastWords = s => s.replace(/[,:.]$/, '').split(' ').slice(-4).join(' ');
function subCards(c) {
  return SUBS[c.id] || (SUBS[c.id] = c.parts.map((p, k) => ({
    id: `${c.id}#${k + 1}`, cat: c.cat, def: p, fwd: true, part: true, parent: c.id, ordered: c.ordered, thr: c.thr,
    term: k === 0 ? `${c.term}: how does it start?` : `${c.term}: what comes after “…${lastWords(c.parts[k - 1])}”?`,
  })));
}
function studyOrder(cards) {
  const key = c => { const s = STATS[c.id]; return !s || s.r + s.w === 0 ? 1.5 : s.box; };
  return shuffle(cards).map(c => [c, key(c), CARDS.indexOf(c)])
    .sort((a, b) => a[1] - b[1] || (a[1] === 1.5 ? a[2] - b[2] : 0)).map(x => x[0]);
}
function Sched(cards) {
  const items = studyOrder(cards).flatMap(c => c.parts ? [...subCards(c), c] : [c]);
  return {
    items, m: Object.fromEntries(items.map(c => [c.id, 0])), due: {}, turn: 0, last: null, missed: new Set(), right: 0, wrong: 0,
    mastered() { return items.filter(c => this.m[c.id] >= 2).length; },
    next() {
      const rem = items.filter(c => this.m[c.id] < 2);
      if (!rem.length) return null;
      const open = c => !c.parts || subCards(c).every(s => this.m[s.id] === undefined || this.m[s.id] >= 2);
      const active = rem.filter(open).slice(0, 6);
      const list = active.length > 1 ? active.filter(c => c.id !== this.last) : active;
      const ready = list.filter(c => (this.due[c.id] ?? 0) <= this.turn);
      const c = (ready.length ? ready : list).reduce((a, b) => (this.due[b.id] ?? 0) < (this.due[a.id] ?? 0) ? b : a);
      this.turn++; this.last = c.id;
      return c;
    },
    // res: 'right' | 'wrong' | 'soft' (seen, hinted or previewed: no mastery change)
    record(c, res) {
      this.prev = {id: c.id, m: this.m[c.id]};
      if (res === 'right') { this.m[c.id]++; this.right++; this.due[c.id] = this.turn + 3; }
      else if (res === 'wrong') { this.m[c.id] = 0; this.wrong++; this.due[c.id] = this.turn + 2; this.missed.add(c.id); }
      else this.due[c.id] = this.turn + 2;
    },
    override(c) { // "I was right" after a miss
      this.m[c.id] = Math.min(2, this.prev.m + 1); this.wrong--; this.right++; this.missed.delete(c.id); this.due[c.id] = this.turn + 3;
    },
  };
}
function segs(sc) { return `<div class="bar segs">${sc.items.map(c => `<i class="m${Math.min(2, sc.m[c.id])}"></i>`).join('')}</div>`; }

/* ---------- shared UI ---------- */
function filterUI(open) {
  const n = pool().length;
  return `<details class="set" ${open ? 'open' : ''}><summary>Study set &middot; ${n} card${n === 1 ? '' : 's'}</summary><div class="filter">
    <div><div class="flabel">Topics</div><div class="chips">${CATS.map(c => `<button class="chip ${S.cats.includes(c) ? 'on' : ''}" onclick="togCat('${c}')">${esc(c)}</button>`).join('')}</div></div>
  </div></details>`;
}
function togCat(c) { S.cats = S.cats.includes(c) ? S.cats.filter(x => x !== c) : [...S.cats, c]; save(); refresh(); }
const img = c => c.img ? `<img class="qimg" src="${c.img}" alt="" onerror="this.remove()">` : '';
const sw = c => c.hex ? `<span class="sw" style="background:${c.hex}"></span>` : '';
const termHTML = c => c.glyph ? `<span class="glyph">${esc(c.term)}</span>` : sw(c) + esc(c.term);
const promptHTML = (c, dir) => dir === 'td' ? termHTML(c) : esc(c.def);
const optHTML = (o, c, dir) => c.glyph && dir === 'dt' ? `<span class="glyph-sm">${esc(o)}</span>` : esc(o);
const tagHTML = c => `<div class="tag">${esc(c.cat)}${c.part ? ' &middot; building it up' : ''}</div>`;
const longCls = (c, dir) => (dir === 'dt' ? c.def : c.term).length > 110 ? 'long' : '';
const empty = () => { $('#app').innerHTML = filterUI(true) + '<div class="panel">No cards in this study set. Turn on a topic above.</div>'; };
const countdown = s => S.autoAdvance ? `<div class="countdown" style="--d:${s}s"></div>` : '';
const hearBtn = fn => 'speechSynthesis' in window ? `<button class="btn ghost" onclick="${fn}">${ICON.speaker} Hear it <kbd>L</kbd></button>` : '';
// Settings that most people leave alone: folded away on phones, open on wide screens
const moreOptions = html => `<details class="more" ${innerWidth >= 720 ? 'open' : ''}><summary>Options</summary><div class="more-body">${html}</div></details>`;
function toggle(k, l) { return `<label class="toggle"><input type="checkbox" ${S[k] ? 'checked' : ''} onchange="S.${k}=this.checked;save()"> ${l}</label>`; }
function seg(key, items) {
  return `<div class="seg">${items.map(([k, l]) => `<button class="${S[key] === k ? 'on' : ''}" onclick="S.${key}='${k}';save();this.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===this))">${l}</button>`).join('')}</div>`;
}
const dirSeg = () => seg('dir', [['td', 'Term → definition'], ['dt', 'Definition → term'], ['mixed', 'Mixed']]);

// Read text aloud with the Mac's built-in voice
const Speech = {
  say(text) {
    return new Promise(r => {
      if (!('speechSynthesis' in window)) return r();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[:;]/g, ','));
      u.lang = 'en-US'; u.onend = u.onerror = () => r();
      speechSynthesis.speak(u);
    });
  },
  stop() { if ('speechSynthesis' in window) speechSynthesis.cancel(); },
};

/* ---------- routing ---------- */
const MODES = [
  ['home', 'Overview'], ['flash', 'Flashcards', ICON.cards], ['learn', 'Learn', ICON.learn], ['slearn', 'Spoken Learn', ICON.mic],
  ['test', 'Test', ICON.test], ['stest', 'Spoken Test', ICON.mic], ['abc', 'Alphabet Drill', ICON.abc], ['ref', 'Reference', ICON.list],
];
const VOICE_MODES = ['slearn', 'stest'];
// Phone tab bar: Learn and Test each cover a typed and a spoken mode (switch at the top of the page)
const TABS = [['home', 'Home', 'home'], ['flash', 'Cards', 'cards'], ['learn', 'Learn', 'learn', ['learn', 'slearn']], ['test', 'Test', 'test', ['test', 'stest']], ['abc', 'Alphabet', 'abc']];
const TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches;
document.documentElement.classList.toggle('touch', TOUCH);
let mode = 'home';
const KEYS = {};
function nav() {
  $('#nav').innerHTML = MODES.slice(1).map(([k, l, ic]) => `<button class="${mode === k ? 'on' : ''}" onclick="go('${k}')">${ic || ''}${l}</button>`).join('');
  $('#tabbar').innerHTML = TABS.map(([k, l, ic, group]) => {
    const on = (group || [k]).includes(mode);
    return `<button class="${on ? 'on' : ''}" onclick="tab('${k}')" aria-label="${l}">${ICON[ic]}<span>${l}</span></button>`;
  }).join('');
}
// Learn/Test tabs reopen whichever of the typed or spoken version you used last
function tab(k) {
  if (k === 'learn') return go(S.learnVia || 'learn');
  if (k === 'test') return go(S.testVia || 'test');
  go(k);
}
function viaSwitch(group) {
  const [typed, spoken] = group === 'learn' ? ['learn', 'slearn'] : ['test', 'stest'];
  return `<div class="via" role="tablist">
    <button class="${mode === typed ? 'on' : ''}" onclick="go('${typed}')">${ICON.keyboard}Type</button>
    <button class="${mode === spoken ? 'on' : ''}" onclick="go('${spoken}')">${ICON.mic}Say it</button></div>`;
}
// Bring the answer feedback and its button into view (it can be below the fold on a phone)
function reveal(sel) { const el = $(sel); if (el && innerWidth < 720) setTimeout(() => el.scrollIntoView({block: 'nearest', behavior: 'smooth'}), 30); }
// Keyboard hints only on devices with a keyboard; touch devices get tap hints
const keyHint = (keys, touch) => TOUCH ? touch : keys;
// arg: a list of cards to study instead of the whole study set
function go(m, arg) {
  clearTimeout(SL.timer); clearTimeout(ST.timer); clearTimeout(T.timer); clearTimeout(L.timer); clearInterval(A.tick);
  Voice.cancel(); Speech.stop();
  if (!VOICE_MODES.includes(m) && Voice.state !== 'off') Voice.release();
  mode = m; nav(); window.scrollTo(0, 0);
  if (m === 'learn' || m === 'slearn') { S.learnVia = m; save(); }
  if (m === 'test' || m === 'stest') { S.testVia = m; save(); }
  if (location.hash !== '#' + m) history.replaceState(null, '', '#' + m);
  ({home, flash: flashStart, learn: learnStart, slearn: slStart, test: testSetup, stest: stSetup, abc: abcStart, ref})[m](arg);
}
function refresh() { go(mode); const d = document.querySelector('details.set'); if (d) d.open = true; }
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { if (e.key === 'Escape') document.activeElement.blur(); return; }
  if (KEYS[mode]?.(e.key.toLowerCase(), e) === true) e.preventDefault();
});

/* ---------- voice UI ---------- */
const ENGINE_SHORT = {mac: 'Mac', browser: 'In-browser', speech: 'Browser speech'};
function voicePill(v) {
  const p = $('#vpill');
  const cls = v.ready ? 'up' : v.loading ? 'loading' : v.down || v.error ? 'down' : '';
  const txt = !v.engine ? 'Checking voice'
    : v.ready ? `Voice: ${ENGINE_SHORT[v.engine]}`
    : v.engine === 'browser' && v.loading ? `Downloading model ${v.pct || 0}%`
    : v.engine === 'browser' && v.idle ? 'Voice: In-browser'
    : v.loading ? 'Loading model' : 'Voice offline';
  p.className = 'vpill ' + cls;
  p.title = v.engine === 'mac' ? 'MLX Whisper on this Mac: ' + (v.model || '') : v.engine === 'browser' ? 'Whisper running in this browser' + (v.device ? ' (' + v.device + ')' : '') : v.engine === 'speech' ? "The browser's built-in speech recognition" : '';
  p.innerHTML = `<i></i>${txt}`;
}
function bannerHTML() {
  const v = Voice.info(), sw = `<button class="btn ghost" onclick="pickEngine('speech')">Use browser speech instead</button>`;
  if (v.engine === 'mac' && v.down) return `<div class="banner bad">The Mac voice server isn't running. In the project folder run <code>uv run server.py</code>, or pick another voice engine. You can still type answers.</div>`;
  if (v.engine === 'mac' && v.loading) return `<div class="banner">Loading MLX Whisper on your Mac's GPU&hellip;</div>`;
  if (v.engine === 'browser' && v.loading) return `<div class="banner">Downloading Whisper into this browser (one time, about ${v.mb || 145} MB): <b>${v.pct || 0}%</b>. You can start talking; answers are transcribed once it's ready. ${Voice.hasSpeech ? sw : ''}</div>`;
  if (v.engine === 'browser' && v.error) return `<div class="banner bad">In-browser Whisper couldn't load: ${esc(v.error)} ${Voice.hasSpeech ? sw : ''}</div>`;
  if (v.engine === 'speech' && v.down) return `<div class="banner bad">This browser has no built-in speech recognition. Pick another voice engine.</div>`;
  if (v.engine === 'speech') return `<div class="banner muted-banner">Using the browser's speech recognition. In Chrome the audio goes to Google's servers; for fully on-device voice pick <b>In-browser Whisper</b>.</div>`;
  return '';
}
const voiceBanner = () => `<div id="vbanner">${bannerHTML()}</div>`;
function engineSeg() {
  const v = Voice.info();
  const opts = [['auto', 'Auto'], ['mac', 'Mac (MLX)'], ['browser', 'In-browser Whisper'], ...(Voice.hasSpeech ? [['speech', 'Browser speech']] : [])];
  return `<div><div class="flabel">Voice engine</div><div class="seg grid2" id="engseg">${opts.map(([k, l]) => `<button class="${(S.engine || 'auto') === k ? 'on' : ''}" onclick="pickEngine('${k}')">${l}</button>`).join('')}</div>
    <div class="muted" id="enginfo" style="margin-top:4px">${engineNote(v)}</div></div>`;
}
function engineNote(v) {
  return {mac: 'MLX Whisper on your Mac\u2019s GPU through <code>server.py</code>. Fastest and most accurate.',
    browser: 'Whisper running inside this browser' + (Voice.hasGPU ? ' on the GPU (WebGPU)' : ' on the CPU') + '. Fully on-device; downloads about 145 MB once.',
    speech: 'The browser\u2019s own recognizer. No download. Chrome sends audio to Google; Safari uses Apple\u2019s.'}[v.engine] || 'Checking which engines are available&hellip;';
}
function pickEngine(k) {
  S.engine = k; save(); Voice.use(k);
  document.querySelectorAll('#engseg button').forEach(b => b.classList.toggle('on', b.getAttribute('onclick') === `pickEngine('${k}')`));
}
const STATUS = {waiting: 'Listening&hellip; say it now', recording: 'Hearing you&hellip;', busy: 'Transcribing&hellip;'};
function micZone(hint) {
  return `<div class="mic-zone"><button class="mic ${Voice.state}" id="mic" onclick="micClick()" aria-label="Microphone">${ICON.mic}</button>
    <div class="micstat" id="micstat">${STATUS[Voice.state] || ''}</div>
    <div class="michint">${hint}</div></div>`;
}
function micMsg(html, bad) { const m = $('#micstat'); if (m) m.innerHTML = bad ? `<span style="color:var(--bad)">${html}</span>` : html; }
function typeBox() {
  return `<div class="typebox" style="margin:10px auto 0"><input type="text" id="typed" placeholder="Or type it&hellip;" autocomplete="off"
    onfocus="Voice.cancel()" onkeydown="if(event.key==='Enter'&&this.value.trim())submitTyped()"><button class="btn alt" onclick="submitTyped()">Check</button></div>`;
}
function submitTyped() {
  const v = $('#typed')?.value.trim(); if (!v) return;
  Voice.cancel(); $('#typed').value = ''; $('#typed').blur();
  mode === 'slearn' ? slAnswer(v) : stAnswer(v);
}
function micClick() {
  if (Voice.state === 'waiting' || Voice.state === 'recording') return Voice.stop();
  if (Voice.state === 'busy') return;
  mode === 'slearn' ? slSpace() : stSpace();
}
let lastState;
Voice.on((state, v) => {
  voicePill(v);
  const b = $('#vbanner'); if (b) b.innerHTML = bannerHTML();
  const n = $('#enginfo'); if (n) n.innerHTML = engineNote(v);
  const m = $('#mic'); if (!m || state === lastState) return;
  lastState = state;
  m.className = 'mic ' + state;
  micMsg(state !== 'idle' ? STATUS[state] || '' : '');
});
(function meter() {
  const m = $('#mic');
  if (m) m.style.setProperty('--lv', Voice.state === 'recording' || Voice.state === 'waiting' ? Math.min(1, Voice.level * 14).toFixed(3) : 0);
  requestAnimationFrame(meter);
})();
function listenOpts(c, dir) {
  const long = answerOf(c, dir).length > 80;
  return {silenceMs: (S.patient ? 1600 : 950) + (long ? 700 : 0), maxMs: long ? 75000 : 25000};
}
async function micReady() {
  if (Voice.state !== 'off') return true;
  try { await Voice.ensureMic(); return true; }
  catch (e) { micMsg(esc(e.name === 'NotAllowedError' ? 'Microphone permission was blocked. Allow it in the address bar and try again.' : e.message), true); return false; }
}

/* ---------- home ---------- */
let HOME_WEAK = [];
function home() {
  const ids = pool().map(c => c.id);
  const seen = ids.filter(id => STATS[id] && STATS[id].r + STATS[id].w);
  const r = seen.reduce((s, id) => s + STATS[id].r, 0), w = seen.reduce((s, id) => s + STATS[id].w, 0);
  const strong = ids.filter(id => STATS[id]?.box >= 3).length;
  const weak = HOME_WEAK = seen.filter(id => STATS[id].box === 0 && STATS[id].w).map(id => CARDS.find(c => c.id === id)).slice(0, 8);
  const tile = (k, t, d, voice, tagline) => `<button class="mode ${voice ? 'voice' : ''}" onclick="go('${k}')"><div class="ic">${MODES.find(m => m[0] === k)[2]}</div><b>${t}${tagline ? `<em>${tagline}</em>` : ''}</b><span>${d}</span></button>`;
  $('#app').innerHTML = `
  <div class="hero"><h2>Know it cold. Say it out loud.</h2>
    <p>The symbols, colors, flower, motto, mission and Greek alphabet. <span class="motto">Manus Multae Cor Unum &mdash; many hands, one heart.</span></p></div>
  <div class="modes">
    ${tile('slearn', 'Spoken Learn', 'See it, say it. New cards are previewed, misses are said back.', true, 'fastest')}
    ${tile('stest', 'Spoken Test', 'Answer out loud, with a verdict after each one or at the end.', true)}
    ${tile('learn', 'Learn', 'Multiple choice, then written, with hints. Weakest cards first.')}
    ${tile('test', 'Test', 'Instant feedback after every question, or a full exam.', false, 'instant')}
    ${tile('abc', 'Alphabet Drill', 'Type the Greek alphabet in order, against the clock.')}
    ${tile('flash', 'Flashcards', 'Flip through the set at your own pace.')}
    ${tile('ref', 'Reference', 'Every card on one page.')}
  </div>
  ${filterUI(false)}
  <div class="panel"><h3>Your progress</h3>
    <div class="stats"><div class="stat"><b>${strong}/${ids.length}</b><span>cards strong (3+ right in a row)</span></div>
      <div class="stat"><b>${r + w ? Math.round(r / (r + w) * 100) + '%' : '&ndash;'}</b><span>answers correct</span></div>
      <div class="stat"><b>${r + w}</b><span>answers given</span></div></div>
    ${weak.length ? `<p class="muted"><b>Missed last time:</b> ${weak.map(c => termHTML(c)).join(' &middot; ')}</p>
      <div class="row"><button class="btn" onclick="go('slearn', HOME_WEAK)">${micIcon(16)} Practice these</button></div>` : ''}
    ${r + w ? `<button class="btn ghost" onclick="if(confirm('Reset progress?')){for(const k in STATS)delete STATS[k];store.set('stats',STATS);home()}">Reset progress</button>` : ''}
  </div>
  <div class="panel"><h3>Study plan</h3><ol class="plan">
    <li>Spoken Learn on <b>Symbols</b> and <b>Colors</b> until you can say each meaning without looking.</li>
    <li>Spoken Learn on <b>Greek Alphabet</b>, then the Alphabet Drill until you can type it with no mistakes.</li>
    <li>Spoken Learn on <b>Motto &amp; Mission</b>. The mission is taught a piece at a time, then as a whole.</li>
    <li>Test with instant feedback until you score 100%, then a Spoken Test with feedback at the end.</li></ol></div>`;
}

/* ---------- flashcards ---------- */
let F = {};
function flashStart() { const d = pool(); if (!d.length) return empty(); F = {deck: shuffle(d), i: 0, flip: false, known: new Set()}; flashRender(); }
function flashRender() {
  const c = F.deck[F.i];
  $('#app').innerHTML = `${filterUI()}
  <div class="top"><span>${F.i + 1} / ${F.deck.length}</span><div class="bar"><i style="width:${(F.i + 1) / F.deck.length * 100}%"></i></div><span>Known ${F.known.size}</span></div>
  <div class="flash ${F.flip ? 'flip' : ''}" id="flash">
    <div class="in"><div class="face">${tagHTML(c)}${img(c)}<div>${termHTML(c)}</div></div>
    <div class="face back">${esc(c.def)}</div></div></div>
  <div class="row"><button class="btn alt" onclick="fNav(-1)">&larr;</button>
    <button class="btn alt" onclick="fKnow(false)">Still learning <kbd>1</kbd></button>
    <button class="btn" onclick="fKnow(true)">Know it <kbd>2</kbd></button>
    <button class="btn alt" onclick="fNav(1)">&rarr;</button><span class="spacer"></span>
    ${hearBtn('Speech.say(F.deck[F.i].def)')}<button class="btn ghost" onclick="flashStart()">Shuffle</button></div>
  <p class="muted">${keyHint('Click the card or press <kbd>Space</kbd> to flip. Arrow keys move.', 'Tap to flip. Swipe right if you know it, left if you\u2019re still learning.')}</p>`;
  swipeable($('#flash'));
}
function swipeable(el) {
  let x0 = null, y0 = 0, dx = 0;
  el.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; dx = 0; el.setPointerCapture(e.pointerId); el.style.transition = 'none'; });
  el.addEventListener('pointermove', e => {
    if (x0 === null) return;
    dx = e.clientX - x0;
    if (Math.abs(dx) > Math.abs(e.clientY - y0)) { el.style.transform = `translateX(${dx}px) rotate(${dx / 25}deg)`; el.dataset.swipe = dx > 40 ? 'know' : dx < -40 ? 'learning' : ''; }
  });
  const end = () => {
    if (x0 === null) return;
    x0 = null; el.style.transition = ''; el.dataset.swipe = '';
    if (Math.abs(dx) > 80) { el.style.transform = `translateX(${dx > 0 ? 120 : -120}%) rotate(${dx > 0 ? 12 : -12}deg)`; setTimeout(() => fKnow(dx > 0), 160); }
    else { el.style.transform = ''; if (Math.abs(dx) < 6) { F.flip = !F.flip; el.classList.toggle('flip'); } }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', () => { x0 = null; el.style.transform = ''; el.style.transition = ''; });
}
function fNav(d) { F.i = (F.i + d + F.deck.length) % F.deck.length; F.flip = false; flashRender(); }
function fKnow(k) { const id = F.deck[F.i].id; k ? F.known.add(id) : F.known.delete(id); fNav(1); }
KEYS.flash = k => {
  if (k === ' ') { F.flip = !F.flip; $('.flash').classList.toggle('flip'); }
  else if (k === 'arrowright') fNav(1); else if (k === 'arrowleft') fNav(-1);
  else if (k === '1') fKnow(false); else if (k === '2') fKnow(true);
  else if (k === 'l') Speech.say(F.deck[F.i].def);
  else return;
  return true;
};

/* ---------- multiple choice options ---------- */
function opts(c, dir) {
  const ans = answerOf(c, dir);
  const sib = c.part ? shuffle(CARDS.find(x => x.id === c.parent).parts) : [];
  const near = shuffle(CARDS.filter(x => x.id !== c.id && x.cat === c.cat && !x.parts)).map(x => answerOf(x, dir));
  const far = shuffle(CARDS.filter(x => x.id !== c.id && !x.parts)).map(x => answerOf(x, dir));
  const others = [...sib, ...near, ...far].filter((v, i, a) => v !== ans && a.indexOf(v) === i);
  return shuffle([ans, ...others.slice(0, 3)]);
}

/* ---------- learn (typed) ---------- */
let L = {};
function learnStart(cards) {
  cards = cards || pool(); if (!cards.length) return empty();
  L = Sched(cards);
  learnNext();
}
function learnNext() {
  clearTimeout(L.timer);
  const c = L.next();
  if (!c) return learnDone();
  const type = L.m[c.id] === 0 && !c.parts ? 'mc' : 'w';
  Object.assign(L, {cur: c, type, dir: pickDir(c, type), phase: 'ask', hint: 0, options: null});
  learnRender();
}
function learnRender() {
  const c = L.cur, ans = answerOf(c, L.dir);
  let body;
  if (L.type === 'mc') {
    L.options = opts(c, L.dir);
    body = `<div class="opts">${L.options.map((o, i) => `<button class="opt" id="o${i}" onclick="learnMC(${i})"><span class="n">${i + 1}</span>${optHTML(o, c, L.dir)}</button>`).join('')}</div>`;
  } else {
    body = (ans.length > 60 ? `<textarea id="wa" placeholder="Type the answer"></textarea>` : `<input type="text" id="wa" placeholder="Type the answer" autocomplete="off">`) +
      `<div class="row" style="margin-top:10px"><button class="btn" onclick="learnW()">Check</button><button class="btn alt" onclick="learnHint()">Hint <kbd>H</kbd></button><button class="btn ghost" onclick="learnSkip()">Don't know</button></div>`;
  }
  $('#app').innerHTML = `${viaSwitch('learn')}${filterUI()}
  <div class="top"><span>${L.mastered()}/${L.items.length} mastered</span>${segs(L)}<span id="tally">${L.right}&#10003; ${L.wrong}&#10007;</span></div>
  <div class="card">${tagHTML(c)}${L.dir === 'td' ? img(c) : ''}
    <div class="prompt ${longCls(c, L.dir)}">${promptHTML(c, L.dir)}</div>
    <div class="askline">${L.type === 'mc' ? 'Choose the ' : 'Write the '}${L.dir === 'td' ? (c.glyph ? 'letter name' : 'definition') : 'term'}</div>
    <div class="hint" id="hint"></div></div>
  <div id="body">${body}</div><div id="fb"></div>`;
  const w = $('#wa');
  if (w) { w.focus(); w.addEventListener('keydown', e => { if (e.key === 'Enter' && (w.tagName === 'INPUT' || e.metaKey)) { e.preventDefault(); learnW(); } }); }
}
function learnHint() {
  if (L.phase !== 'ask' || L.type !== 'w') return;
  L.hint = Math.min(2, L.hint + 1);
  $('#hint').textContent = Grade.hint(answerOf(L.cur, L.dir), L.hint);
  $('#wa')?.focus();
}
function learnMC(i) {
  if (L.phase !== 'ask') return;
  const ans = answerOf(L.cur, L.dir), ok = L.options[i] === ans;
  L.options.forEach((o, j) => { const b = $('#o' + j); if (o === ans) b.classList.add('ok'); else if (j === i) b.classList.add('no'); });
  learnResult(ok, {target: ans, hits: new Set(), ok});
}
function learnW() {
  if (L.phase !== 'ask') return;
  const g = Grade.check($('#wa').value, L.cur, L.dir);
  learnResult(g.ok, g, true);
}
function learnSkip() { if (L.phase === 'ask') learnResult(false, {target: answerOf(L.cur, L.dir), hits: new Set()}, false); }
function learnResult(ok, g, written) {
  const c = L.cur, hinted = ok && L.hint > 0;
  L.phase = 'shown';
  if (hinted) L.record(c, 'soft');
  else { L.record(c, ok ? 'right' : 'wrong'); stat(c.id, ok); }
  if (!ok && S.readAloud) Speech.say(g.target);
  const copy = !ok && L.type === 'w';
  if (copy) L.phase = 'copy';
  $('#body .row')?.remove();                                       // Check / Hint / Don't know are done
  $('#fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'no'}"><b class="v">${hinted ? 'Correct, with a hint' : ok ? 'Correct' : 'Not quite'}</b>${ok && !written ? '' : 'Answer: ' + (written ? Grade.marked(g, esc) : esc(g.target))}${hinted ? '<div class="muted">It will come back once more without the hint.</div>' : ''}</div>
    ${copy ? `<div class="echo">Type it correctly to lock it in<div class="typebox" style="margin:8px auto 0"><input type="text" id="copy" autocomplete="off" placeholder="Type the answer"><button class="btn alt" onclick="learnCopy()">Check</button></div><div id="copyfb" class="muted" style="font-weight:400"></div></div>` : ''}
    <div class="row" style="margin-top:12px"><button class="btn" id="nx" onclick="learnNext()">${copy ? 'Skip' : 'Continue'} <kbd>Enter</kbd></button>
    ${written && !ok && !g.empty ? `<button class="btn alt" onclick="learnOverride()">I was right</button>` : ''}${hearBtn('Speech.say(L.cur&&answerOf(L.cur,L.dir))')}</div>
    ${ok && !hinted ? countdown(1) : ''}`;
  $('#tally').innerHTML = `${L.right}&#10003; ${L.wrong}&#10007;`;
  if (copy) { const ci = $('#copy'); ci.focus(); ci.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ci.value.trim() ? learnCopy() : learnNext(); } }); }
  else $('#nx').focus({preventScroll: true});
  reveal('#fb .row');
  if (ok && !hinted && S.autoAdvance) L.timer = setTimeout(learnNext, 1000);
}
function learnCopy() {
  const g = Grade.check($('#copy').value, L.cur, L.dir);
  if (g.ok) { $('#copyfb').innerHTML = '<b style="color:var(--good)">Locked in.</b>'; L.phase = 'shown'; L.timer = setTimeout(learnNext, 700); }
  else { $('#copyfb').innerHTML = 'Not yet: ' + Grade.marked(g, esc); $('#copy').select(); }
}
function learnOverride() { const c = L.cur; L.override(c); stat(c.id, false, true); stat(c.id, true); learnNext(); }
function learnDone() {
  const missed = L.items.filter(c => L.missed.has(c.id) && !c.part);
  $('#app').innerHTML = `<div class="panel"><h2>${L.items.length === 1 ? 'Card' : 'All ' + L.items.length + ' cards'} mastered</h2><p>Right ${L.right}, missed ${L.wrong}.</p>
  ${missed.length ? `<p class="muted"><b>Trickiest this time:</b> ${missed.map(c => termHTML(c)).join(' &middot; ')}</p>` : ''}
  <div class="row"><button class="btn" onclick="go('slearn')">${micIcon(16)} Now say them out loud</button>${missed.length ? `<button class="btn alt" onclick="learnStart(L.items.filter(c=>L.missed.has(c.id)&&!c.part))">Study the tricky ones</button>` : ''}
  <button class="btn alt" onclick="go('test')">Take a test</button></div></div>`;
}
KEYS.learn = k => {
  if (L.phase === 'ask' && L.type === 'mc' && /^[1-4]$/.test(k)) learnMC(+k - 1);
  else if (L.phase !== 'ask' && k === 'enter') learnNext();
  else if (k === 'h') learnHint();
  else if (k === 'l' && L.phase !== 'ask') Speech.say(answerOf(L.cur, L.dir));
  else return;
  return true;
};

/* ---------- spoken learn ---------- */
let SL = {};
function slStart(cards) {
  cards = cards || pool(); if (!cards.length) return empty();
  SL = Object.assign(Sched(cards), {token: 0, phase: 'intro'});
  if (Voice.state !== 'off') return slNext();
  $('#app').innerHTML = `${viaSwitch('learn')}${filterUI()}${voiceBanner()}
  <div class="card"><h2>Spoken Learn</h2>
    <p>Each card shows a term. <b>Say the answer out loud.</b> The mic listens on its own and stops when you pause.</p>
    <div class="row start-row"><button class="btn" onclick="slBegin()">${micIcon(18)} Start speaking <kbd>Space</kbd></button></div>
    <div id="micstat" class="micstat"></div>
    <p class="muted">New cards are shown first so you can read them aloud. Get a card right twice to master it. Miss one and you say it back, and it returns two cards later. Stuck? ${TOUCH ? 'Tap <b>Hint</b>.' : 'Press <kbd>H</kbd> for a hint.'}</p>
    ${moreOptions(`${dirSeg()}${engineSeg()}<div class="toggles">${toggle('preview', 'Preview new cards')}${toggle('autoListen', 'Listen automatically')}${toggle('autoAdvance', 'Auto-advance')}${toggle('readAloud', 'Read answers aloud after a miss')}${toggle('patient', 'Allow longer pauses')}</div>`)}</div>`;
}
async function slBegin() { if (await micReady()) slNext(); }
function slNext() {
  clearTimeout(SL.timer); Speech.stop();
  const c = SL.next();
  if (!c) return slDone();
  Object.assign(SL, {cur: c, dir: pickDir(c, 'say'), g: null, said: null, echo: null, tries: 0, hint: 0});
  SL.phase = S.preview && isNew(c.id) ? 'preview' : 'ask';
  slRender();
  if (SL.phase === 'preview') slShow();
  if (S.autoListen) slListen();
}
function slRender() {
  const c = SL.cur;
  $('#app').innerHTML = `${viaSwitch('learn')}${filterUI()}${voiceBanner()}
  <div class="top"><span>${SL.mastered()}/${SL.items.length} mastered</span>${segs(SL)}<span id="tally">${SL.right}&#10003; ${SL.wrong}&#10007;</span></div>
  <div class="card">${tagHTML(c)}${SL.dir === 'td' ? img(c) : ''}
    <div class="prompt ${longCls(c, SL.dir)}">${promptHTML(c, SL.dir)}</div>
    <div class="askline">Say the ${SL.dir === 'td' ? (c.glyph ? 'letter name' : 'definition') : 'term'}</div>
    <div class="hint" id="hint"></div>
    <div id="res"></div>
    ${micZone(keyHint('<kbd>Space</kbd> talk / stop &middot; <kbd>H</kbd> hint &middot; <kbd>S</kbd> don\'t know &middot; <kbd>L</kbd> hear it &middot; <kbd>Enter</kbd> next', 'The mic listens on its own. Tap it to stop or start.'))}
    ${typeBox()}</div>
  <div class="row acts" id="acts">${TOUCH ? `<button class="btn alt" onclick="slHint()">Hint</button><button class="btn ghost" onclick="slSkipCard()">Don't know</button>` : ''}</div>`;
}
async function slListen() {
  clearTimeout(SL.timer);
  if (!(await micReady())) return;
  const tok = ++SL.token;
  const res = await Voice.listen(listenOpts(SL.cur, SL.dir));
  if (tok !== SL.token || mode !== 'slearn' || res.cancelled) return;
  if (res.nospeech) return micMsg("Didn't hear anything. Press <kbd>Space</kbd> to try again.");
  if (res.error) return micMsg(esc(res.error), true);
  slAnswer(res.text);
}
function slAnswer(text) {
  const c = SL.cur, g = Grade.check(text, c, SL.dir), p = SL.phase;
  if (p === 'preview') {
    SL.tries++; SL.echo = g; SL.echoSaid = text;
    if (g.ok || SL.tries >= 2) { SL.phase = 'previewed'; markSeen(c.id); SL.record(c, 'soft'); }
  } else if (p === 'ask') {
    SL.g = g; SL.said = text;
    if (g.ok && SL.hint) { SL.record(c, 'soft'); SL.phase = 'right'; }
    else { SL.record(c, g.ok ? 'right' : 'wrong'); stat(c.id, g.ok); SL.phase = g.ok ? 'right' : 'echo'; }
  } else if (p === 'echo') {
    SL.echo = g; SL.echoSaid = text; SL.tries++;
    if (g.ok) SL.phase = 'locked';
  } else return;
  slShow();
  const done = ['right', 'locked', 'previewed'].includes(SL.phase);
  if (done && S.autoAdvance) SL.timer = setTimeout(slNext, SL.phase === 'right' ? 1300 : 1000);
  else if (SL.phase === 'echo' && p === 'ask' && S.readAloud) Speech.say(g.target).then(() => { if (SL.cur === c && SL.phase === 'echo' && S.autoListen) slListen(); });
  else if ((SL.phase === 'echo' || SL.phase === 'preview') && S.autoListen && SL.tries < 2) SL.timer = setTimeout(slListen, p === 'ask' ? 900 : 500);
}
function slShow() {
  const g = SL.g, p = SL.phase, c = SL.cur, ans = answerOf(c, SL.dir);
  const said = s => s ? `<div class="said">${esc(s)}</div>` : '';
  const heard = SL.echo && !SL.echo.ok ? `<div class="muted" style="font-weight:400;margin-top:4px">Heard: <i>${esc(SL.echoSaid || '')}</i>. Try once more.</div>` : '';
  let h;
  if (p === 'preview' || p === 'previewed') {
    h = `<div class="fb new"><b class="v">New card</b>${esc(ans)}</div>` +
      (p === 'preview' ? `<div class="echo">Read it out loud${heard}</div>` : `<div class="echo" style="background:var(--good-bg);border-color:var(--good)">${SL.echo?.ok ? 'Got it. You’ll be asked for it in a moment.' : 'You’ll be asked for it in a moment.'}</div>`);
  } else if (p === 'right') {
    h = `<div class="fb ok"><b class="v">${SL.hint ? 'Correct, with a hint' : 'Correct'}</b>${said(SL.said)}${Grade.marked(g, esc)}${SL.hint ? '<div class="muted">It will come back once more without the hint.</div>' : ''}</div>`;
  } else {
    h = `<div class="fb ${p === 'locked' ? 'ok' : 'no'}"><b class="v">${SL.said ? 'Not quite' : 'Here it is'}</b>${said(SL.said)}Answer: ${Grade.marked(g, esc)}</div>` +
      (p === 'locked' ? `<div class="echo" style="background:var(--good-bg);border-color:var(--good)">Locked in. It comes back in two cards.</div>`
        : `<div class="echo">Now say it back out loud: &ldquo;${esc(g.target)}&rdquo;${heard}</div>`);
  }
  if (['right', 'locked', 'previewed'].includes(p)) h += countdown(p === 'right' ? 1.3 : 1);
  $('#res').innerHTML = h;
  $('#tally').innerHTML = `${SL.right}&#10003; ${SL.wrong}&#10007;`;
  $('#acts').innerHTML = `<button class="btn" onclick="slNext()">${p === 'preview' ? 'Skip' : 'Continue'} <kbd>Enter</kbd></button>` +
    (p === 'echo' && SL.said ? `<button class="btn alt" onclick="slOverride()">I was right <kbd>O</kbd></button>` : '') + hearBtn('slHear()');
  reveal('#acts');
}
function slHint() {
  if (SL.phase !== 'ask') return;
  SL.hint = Math.min(2, SL.hint + 1);
  $('#hint').textContent = Grade.hint(answerOf(SL.cur, SL.dir), SL.hint);
}
async function slHear() {
  const c = SL.cur, p = SL.phase;
  Voice.cancel();
  await Speech.say(answerOf(c, SL.dir));
  if (SL.cur === c && SL.phase === p && ['ask', 'echo', 'preview'].includes(p) && S.autoListen) slListen();
}
function slOverride() {
  if (SL.phase !== 'echo' || !SL.said) return;
  const c = SL.cur; SL.override(c); stat(c.id, false, true); stat(c.id, true); slNext();
}
function slSkipCard() {
  Voice.cancel();
  if (SL.phase === 'ask') slAnswer('');
  else if (SL.phase === 'preview') { markSeen(SL.cur.id); SL.record(SL.cur, 'soft'); slNext(); }
}
function slSpace() {
  if (SL.phase === 'intro') return slBegin();
  if (['ask', 'echo', 'preview'].includes(SL.phase)) slListen(); else slNext();
}
function slDone() {
  Voice.cancel();
  const missed = SL.items.filter(c => SL.missed.has(c.id) && !c.part);
  $('#app').innerHTML = `<div class="panel"><h2>${SL.items.length === 1 ? 'Card' : 'All ' + SL.items.length + ' cards'} mastered</h2>
  <p>Right the first time: ${SL.right}. Missed and said back: ${SL.wrong}.</p>
  ${missed.length ? `<p class="muted"><b>Trickiest this time:</b> ${missed.map(c => termHTML(c)).join(' &middot; ')}</p>` : ''}
  <div class="row">${missed.length ? `<button class="btn" onclick="slStart(SL.items.filter(c=>SL.missed.has(c.id)&&!c.part))">Say the tricky ones again</button>` : ''}
  <button class="btn ${missed.length ? 'alt' : ''}" onclick="slStart()">Go again</button><button class="btn alt" onclick="go('stest')">Take a spoken test</button></div></div>`;
}
KEYS.slearn = k => {
  if (k === ' ') micClick();
  else if (k === 'enter' && !['intro', 'ask'].includes(SL.phase)) slNext();
  else if (k === 's') slSkipCard();
  else if (k === 'o') slOverride();
  else if (k === 'h') slHint();
  else if (k === 'l' && SL.cur) slHear();
  else if (k === 't' && $('#typed')) $('#typed').focus();
  else return;
  return true;
};

/* ---------- test (typed) ---------- */
let T = {};
const QT = {mc: 'Multiple choice', tf: 'True / False', w: 'Written', match: 'Matching'};
function testSetup() {
  const max = pool().length; if (!max) return empty();
  S.testN = Math.min(S.testN, max) || max;
  T = {};
  $('#app').innerHTML = `${viaSwitch('test')}${filterUI()}<div class="panel setup"><h2>Test</h2>
  <div><div class="flabel">Feedback</div>${seg('fb', [['instant', 'Instant, after every question'], ['end', 'At the end, like an exam']])}</div>
  <div><div class="flabel">Questions</div><input type="number" id="tn" min="1" max="${max}" value="${S.testN}" style="width:110px"> <span class="muted">of ${max}</span></div>
  <div><div class="flabel">Question types</div><div class="chips">${Object.entries(QT).map(([k, l]) => `<button class="chip ${S.types[k] ? 'on' : ''}" onclick="S.types.${k}=!S.types.${k};save();this.classList.toggle('on')">${l}</button>`).join('')}</div></div>
  <div><div class="flabel">Direction</div>${dirSeg()}</div>
  <div class="row"><button class="btn" onclick="testBuild()">Start test</button><button class="btn alt" onclick="go('stest')">${micIcon(16)} Spoken test instead</button></div></div>`;
}
// cards: retake just these (all of them); otherwise draw from the study set
function testBuild(cards) {
  let n;
  if (cards) { cards = shuffle([...new Set(cards)]); n = cards.length; }
  else { cards = shuffle(pool()); n = S.testN = Math.max(1, Math.min(+($('#tn')?.value) || S.testN, cards.length)); save(); }
  const kinds = ['mc', 'tf', 'w'].filter(k => S.types[k]);
  const matchable = cards.filter(c => !c.parts);
  const wantMatch = S.types.match && matchable.length >= 3 && n >= 3;
  if (!kinds.length && !wantMatch) return alert('Pick at least one question type.');
  const matchN = wantMatch ? Math.min(6, Math.max(3, Math.floor(n / 3))) : 0;
  const qs = cards.slice(0, Math.max(0, n - (wantMatch ? 1 : 0))).map(c => {
    const k = c.parts ? 'w' : kinds.length ? pick(kinds) : 'mc';
    if (k === 'tf') {
      const truth = Math.random() < .5;
      const other = shuffle(CARDS.filter(x => x.id !== c.id && x.def !== c.def)).sort((a, b) => (b.cat === c.cat) - (a.cat === c.cat))[0];
      return {t: 'tf', c, shown: truth ? c.def : other.def, truth};
    }
    if (k === 'w') return {t: 'w', c, dir: c.def.length > 80 && !c.fwd ? 'dt' : pickDir(c, 'w')};
    const dir = pickDir(c, 'mc'); return {t: 'mc', c, dir, options: opts(c, dir)};
  });
  if (wantMatch) { const mc = shuffle(matchable).slice(0, matchN); qs.push({t: 'match', cards: mc, defs: shuffle(mc.map(c => c.def))}); }
  T = {qs: wantMatch ? [...shuffle(qs.slice(0, -1)), qs[qs.length - 1]] : shuffle(qs), fb: S.fb, i: 0, pts: 0, miss: 0};
  T.fb === 'instant' ? itRender() : testRender();
}

/* instant feedback: one question at a time */
function itRender() {
  clearTimeout(T.timer);
  const q = T.qs[T.i];
  q.done = false;
  let prompt, body;
  if (q.t === 'mc') {
    prompt = promptHTML(q.c, q.dir);
    body = `<div class="opts">${q.options.map((o, j) => `<button class="opt" id="o${j}" onclick="itMC(${j})"><span class="n">${j + 1}</span>${optHTML(o, q.c, q.dir)}</button>`).join('')}</div>`;
  } else if (q.t === 'tf') {
    prompt = `${termHTML(q.c)}<div class="tfdef">${esc(q.shown)}</div>`;
    body = `<div class="opts"><button class="opt" id="o0" onclick="itTF(true)"><span class="n">1</span>True</button><button class="opt" id="o1" onclick="itTF(false)"><span class="n">2</span>False</button></div>`;
  } else if (q.t === 'w') {
    prompt = promptHTML(q.c, q.dir);
    body = (answerOf(q.c, q.dir).length > 60 ? `<textarea id="wa" placeholder="Type the answer"></textarea>` : `<input type="text" id="wa" placeholder="Type the answer" autocomplete="off">`) +
      `<div class="row" style="margin-top:10px"><button class="btn" onclick="itW()">Check</button><button class="btn ghost" onclick="itW(true)">Don't know</button></div>`;
  } else {
    prompt = 'Match each term to its definition';
    body = `<div class="panel match" style="margin:0">${q.cards.map((c, k) => `<p><b>${termHTML(c)}</b><select id="m${k}"><option value="">Choose&hellip;</option>${q.defs.map((d, j) => `<option value="${j}">${esc(d.length > 110 ? d.slice(0, 107) + '...' : d)}</option>`).join('')}</select></p>`).join('')}</div>
      <div class="row" style="margin-top:10px"><button class="btn" onclick="itMatch()">Check</button></div>`;
  }
  $('#app').innerHTML = `
  <div class="top"><span>Question ${T.i + 1} of ${T.qs.length}</span><div class="bar"><i style="width:${T.i / T.qs.length * 100}%"></i></div><span id="tally">${T.pts}&#10003; ${T.miss}&#10007;</span></div>
  <div class="card"><div class="tag">${QT[q.t]}</div>${q.c && q.dir === 'td' ? img(q.c) : ''}<div class="prompt ${q.c ? longCls(q.c, q.dir) : ''}">${prompt}</div></div>
  <div id="body">${body}</div><div id="fb"></div>`;
  const w = $('#wa');
  if (w) { w.focus(); w.addEventListener('keydown', e => { if (e.key === 'Enter' && (w.tagName === 'INPUT' || e.metaKey)) { e.preventDefault(); itW(); } }); }
}
function itMC(j) {
  const q = T.qs[T.i]; if (q.done) return;
  const ans = answerOf(q.c, q.dir), ok = q.options[j] === ans;
  q.options.forEach((o, k) => { const b = $('#o' + k); if (o === ans) b.classList.add('ok'); else if (k === j) b.classList.add('no'); });
  itResult(ok, ok ? '' : 'Answer: ' + optHTML(ans, q.c, q.dir));
}
function itTF(v) {
  const q = T.qs[T.i]; if (q.done) return;
  const ok = v === q.truth;
  $('#o' + (v ? 0 : 1)).classList.add(ok ? 'ok' : 'no');
  if (!ok) $('#o' + (v ? 1 : 0)).classList.add('ok');
  itResult(ok, q.truth && ok ? '' : `${termHTML(q.c)} means: <b>${esc(q.c.def)}</b>`);
}
function itW(skip) {
  const q = T.qs[T.i]; if (q.done) return;
  const g = Grade.check(skip ? '' : $('#wa').value, q.c, q.dir);
  q.g = g;
  itResult(g.ok, g.ok ? Grade.marked(g, esc) : 'Answer: ' + Grade.marked(g, esc), !skip && !g.empty);
}
function itMatch() {
  const q = T.qs[T.i]; if (q.done) return;
  q.wrong = [];
  q.cards.forEach((c, k) => {
    const s = $('#m' + k), ok = s.value !== '' && q.defs[+s.value] === c.def;
    s.classList.add(ok ? 'ok' : 'no'); s.disabled = true;
    stat(c.id, ok); if (!ok) q.wrong.push(c);
  });
  const right = q.cards.length - q.wrong.length;
  itResult(!q.wrong.length, `${right}/${q.cards.length} matched.` + (q.wrong.length ? ' ' + q.wrong.map(c => `<b>${termHTML(c)}</b>: ${esc(c.def)}`).join('; ') : ''), false, true);
}
function itResult(ok, html, canOverride, statted) {
  const q = T.qs[T.i];
  q.done = true; q.ok = ok;
  ok ? T.pts++ : T.miss++;
  if (q.c && !statted) stat(q.c.id, ok);
  if (!ok && S.readAloud && q.c) Speech.say(answerOf(q.c, q.dir || 'td'));
  $('#tally').innerHTML = `${T.pts}&#10003; ${T.miss}&#10007;`;
  $('#fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'no'}"><b class="v">${ok ? 'Correct' : 'Not quite'}</b>${html}</div>
    <div class="row" style="margin-top:12px"><button class="btn" id="nx" onclick="itNext()">${T.i + 1 < T.qs.length ? 'Next' : 'See results'} <kbd>Enter</kbd></button>
    ${canOverride && !ok ? `<button class="btn alt" onclick="itOverride()">I was right <kbd>O</kbd></button>` : ''}${q.c ? hearBtn('itHear()') : ''}</div>
    ${ok ? countdown(1) : ''}`;
  $('#nx').focus({preventScroll: true});
  reveal('#fb .row');
  if (ok && S.autoAdvance) T.timer = setTimeout(itNext, 1000);
}
function itHear() { const q = T.qs[T.i]; if (q?.c) Speech.say(answerOf(q.c, q.dir || 'td')); }
function itOverride() {
  const q = T.qs[T.i]; if (!q.done || q.ok || q.t !== 'w') return;
  q.ok = true; T.pts++; T.miss--; stat(q.c.id, false, true); stat(q.c.id, true); itNext();
}
function itNext() { clearTimeout(T.timer); Speech.stop(); if (++T.i >= T.qs.length) itDone(); else itRender(); }
function itDone() {
  const missed = T.qs.flatMap(q => q.t === 'match' ? q.wrong || [] : q.ok ? [] : [q.c]);
  T.missed = missed;
  $('#app').innerHTML = `<div class="panel"><div class="score">${Math.round(T.pts / T.qs.length * 100)}%</div><p>${T.pts} of ${T.qs.length} questions right.</p>
    <div class="row">${missed.length ? `<button class="btn" onclick="testBuild(T.missed)">Retake ${missed.length} missed</button><button class="btn alt" onclick="go('learn', T.missed)">Learn the missed</button>` : ''}
    <button class="btn ${missed.length ? 'alt' : ''}" onclick="testBuild()">New test</button><button class="btn ghost" onclick="go('test')">Settings</button></div></div>
  ${missed.length ? `<div class="panel"><h3>Review what you missed</h3><table class="ref">${missed.map(c => `<tr><td>${termHTML(c)}</td><td>${esc(c.def)}</td></tr>`).join('')}</table></div>` : ''}`;
}

/* feedback at the end: the whole test on one page */
function testRender() {
  $('#app').innerHTML = `<div class="panel"><h2>Test &middot; ${T.qs.length} items</h2>${T.qs.map((q, i) => {
    let h = `<div class="q" id="q${i}"><div class="qnum">${i + 1} &middot; ${QT[q.t]}</div>`;
    if (q.t === 'mc') h += `<div class="prompt">${promptHTML(q.c, q.dir)}</div><div class="opts">${q.options.map((o, j) => `<label class="opt"><input type="radio" name="a${i}" value="${j}"> ${optHTML(o, q.c, q.dir)}</label>`).join('')}</div>`;
    else if (q.t === 'tf') h += `<div class="prompt"><b>${termHTML(q.c)}</b> &mdash; ${esc(q.shown)}</div><div class="opts"><label class="opt"><input type="radio" name="a${i}" value="1"> True</label><label class="opt"><input type="radio" name="a${i}" value="0"> False</label></div>`;
    else if (q.t === 'w') h += `<div class="prompt">${promptHTML(q.c, q.dir)}</div>` + (answerOf(q.c, q.dir).length > 60 ? `<textarea name="a${i}"></textarea>` : `<input type="text" name="a${i}" autocomplete="off">`);
    else h += `<div class="prompt">Match each term to its definition</div><div class="match">${q.cards.map((c, k) => `<p><b>${termHTML(c)}</b><select name="a${i}_${k}"><option value="">Choose&hellip;</option>${q.defs.map((d, j) => `<option value="${j}">${esc(d.length > 110 ? d.slice(0, 107) + '...' : d)}</option>`).join('')}</select></p>`).join('')}</div>`;
    return h + `<div class="rv"></div></div>`;
  }).join('')}<button class="btn" id="submit" onclick="testGrade()">Submit test</button></div>`;
}
function val(name) {
  const e = document.getElementsByName(name); if (!e.length) return '';
  if (e[0].type === 'radio') { const r = [...e].find(x => x.checked); return r ? r.value : ''; }
  return e[0].value;
}
function testGrade() {
  let pts = 0, tot = 0;
  const missed = [];
  T.qs.forEach((q, i) => {
    let ok = 0, max = 1, msg;
    if (q.t === 'mc') { const v = val('a' + i), ans = answerOf(q.c, q.dir); ok = v !== '' && q.options[+v] === ans ? 1 : 0; msg = 'Answer: ' + optHTML(ans, q.c, q.dir); }
    else if (q.t === 'tf') { const v = val('a' + i); ok = v !== '' && (v === '1') === q.truth ? 1 : 0; msg = `This was ${q.truth ? 'true' : 'false'}. ${termHTML(q.c)}: ${esc(q.c.def)}`; }
    else if (q.t === 'w') { const g = Grade.check(val('a' + i), q.c, q.dir); ok = g.ok ? 1 : 0; msg = 'Answer: ' + Grade.marked(g, esc); }
    else { max = q.cards.length; q.cards.forEach((c, k) => { const v = val(`a${i}_${k}`), r = v !== '' && q.defs[+v] === c.def; if (r) ok++; else missed.push(c); stat(c.id, r); }); msg = `${ok}/${max} matched. ` + q.cards.map(c => `<b>${termHTML(c)}</b>: ${esc(c.def)}`).join('; '); }
    if (q.c) { stat(q.c.id, ok === max); if (ok < max) missed.push(q.c); }
    pts += ok; tot += max;
    document.querySelector(`#q${i} .rv`).innerHTML = `<div class="fb ${ok === max ? 'ok' : 'no'}"><b class="v">${ok === max ? 'Correct' : 'Missed'}</b>${ok === max && q.t !== 'match' ? '' : msg}</div>`;
  });
  T.missed = missed;
  $('#submit')?.remove();
  const top = document.createElement('div'); top.className = 'panel';
  top.innerHTML = `<div class="score">${Math.round(pts / tot * 100)}%</div><p>${pts} of ${tot} correct</p>
    <div class="row">${missed.length ? `<button class="btn" onclick="testBuild(T.missed)">Retake ${missed.length} missed</button><button class="btn alt" onclick="go('learn', T.missed)">Learn the missed</button>` : ''}
    <button class="btn ${missed.length ? 'alt' : ''}" onclick="testBuild()">New test</button><button class="btn ghost" onclick="go('test')">Settings</button></div>`;
  $('#app').prepend(top); window.scrollTo(0, 0);
}
KEYS.test = k => {
  const q = T.qs?.[T.i]; if (T.fb !== 'instant' || !q) return;
  if (!q.done && q.t === 'mc' && /^[1-4]$/.test(k)) itMC(+k - 1);
  else if (!q.done && q.t === 'tf' && (k === '1' || k === '2')) itTF(k === '1');
  else if (q.done && k === 'enter') itNext();
  else if (q.done && k === 'o') itOverride();
  else if (q.done && k === 'l') itHear();
  else return;
  return true;
};

/* ---------- spoken test ---------- */
let ST = {};
function stSetup() {
  const max = pool().length; if (!max) return empty();
  S.stN = Math.min(S.stN, max) || max;
  ST = {phase: 'setup'};
  $('#app').innerHTML = `${viaSwitch('test')}${filterUI()}${voiceBanner()}<div class="panel setup"><h2>Spoken Test</h2>
  <p class="muted" style="margin:0">One card at a time. Say each answer out loud.</p>
  <div><div class="flabel">Feedback</div>${seg('sfb', [['instant', 'Instant, after every answer'], ['end', 'At the end, like an oral exam']])}</div>
  <div><div class="flabel">Questions</div><input type="number" id="stn" min="1" max="${max}" value="${S.stN}" style="width:110px"> <span class="muted">of ${max}</span></div>
  <div class="row start-row"><button class="btn" onclick="stBuild()">${micIcon(18)} Start spoken test <kbd>Space</kbd></button></div>
  <div id="micstat" class="micstat"></div>
  ${moreOptions(`<div><div class="flabel">Direction</div>${dirSeg()}</div>${engineSeg()}<div class="toggles">${toggle('autoListen', 'Listen automatically')}${toggle('autoAdvance', 'Auto-advance')}${toggle('readAloud', 'Read answers aloud after a miss')}${toggle('patient', 'Allow longer pauses')}</div>`)}</div>`;
}
async function stBuild(cards) {
  if (!cards) { S.stN = Math.max(1, Math.min(+($('#stn')?.value) || S.stN, pool().length)); save(); cards = shuffle(pool()).slice(0, S.stN); }
  else cards = shuffle(cards);
  ST = {qs: cards.map(c => ({c, dir: pickDir(c, 'say'), said: null, g: null, ov: null})), i: 0, token: 0, phase: 'ask', fb: S.sfb, right: 0, wrong: 0};
  if (!(await micReady())) { ST.phase = 'setup'; return; }
  stShow();
}
function stShow() {
  clearTimeout(ST.timer); Speech.stop();
  const q = ST.qs[ST.i], c = q.c;
  ST.phase = 'ask';
  $('#app').innerHTML = `${voiceBanner()}
  <div class="top"><span>Question ${ST.i + 1} of ${ST.qs.length}</span><div class="bar"><i style="width:${ST.i / ST.qs.length * 100}%"></i></div>${ST.fb === 'instant' ? `<span id="tally">${ST.right}&#10003; ${ST.wrong}&#10007;</span>` : ''}</div>
  <div class="card">${tagHTML(c)}${q.dir === 'td' ? img(c) : ''}
    <div class="prompt ${longCls(c, q.dir)}">${promptHTML(c, q.dir)}</div>
    <div class="askline">Say the ${q.dir === 'td' ? (c.glyph ? 'letter name' : 'definition') : 'term'}</div>
    <div id="res"></div>
    ${micZone(keyHint(`<kbd>Space</kbd> talk / stop &middot; ${ST.fb === 'instant' ? '' : '<kbd>R</kbd> redo &middot; '}<kbd>S</kbd> skip &middot; <kbd>Enter</kbd> next`, 'The mic listens on its own. Tap it to stop or start.'))}
    ${typeBox()}</div>
  <div class="row acts" id="acts"><button class="btn alt" onclick="stSkip()">Skip <kbd>S</kbd></button><span class="spacer"></span><button class="btn ghost" onclick="stDone()">End test</button></div>`;
  if (S.autoListen) stListen();
}
async function stListen() {
  clearTimeout(ST.timer);
  if (!(await micReady())) return;
  const tok = ++ST.token, q = ST.qs[ST.i];
  ST.phase = 'ask'; $('#res').innerHTML = '';
  const res = await Voice.listen(listenOpts(q.c, q.dir));
  if (tok !== ST.token || mode !== 'stest' || res.cancelled) return;
  if (res.nospeech) return micMsg("Didn't hear anything. Press <kbd>Space</kbd> to try again.");
  if (res.error) return micMsg(esc(res.error), true);
  stAnswer(res.text);
}
function stAnswer(text) {
  const q = ST.qs[ST.i];
  if (ST.phase !== 'ask') return;
  q.said = text; q.g = Grade.check(text, q.c, q.dir); ST.phase = 'heard';
  if (ST.fb === 'instant') {
    const ok = q.g.ok;
    stat(q.c.id, ok); q.recorded = true;
    ok ? ST.right++ : ST.wrong++;
    $('#tally').innerHTML = `${ST.right}&#10003; ${ST.wrong}&#10007;`;
    $('#res').innerHTML = `<div class="fb ${ok ? 'ok' : 'no'}"><b class="v">${ok ? 'Correct' : text ? 'Not quite' : 'Skipped'}</b>${text ? `<div class="said">${esc(text)}</div>` : ''}${ok ? '' : 'Answer: '}${Grade.marked(q.g, esc)}</div>` + (ok ? countdown(1.2) : '');
    $('#acts').innerHTML = `<button class="btn" onclick="stNext()">${ST.i + 1 < ST.qs.length ? 'Next' : 'See results'} <kbd>Enter</kbd></button>` +
      (!ok && text ? `<button class="btn alt" onclick="stOverride()">I was right <kbd>O</kbd></button>` : '') + hearBtn('stHear()') +
      `<span class="spacer"></span><button class="btn ghost" onclick="stDone()">End test</button>`;
    reveal('#acts');
    if (ok && S.autoAdvance) ST.timer = setTimeout(stNext, 1200);
    else if (!ok && S.readAloud) Speech.say(answerOf(q.c, q.dir));
    return;
  }
  $('#res').innerHTML = `<div class="fb" style="background:var(--cream)"><b class="v" style="color:var(--muted)">Recorded</b><div class="said">${esc(text) || '&mdash;'}</div></div>` + countdown(1.6);
  $('#acts').innerHTML = `<button class="btn alt" onclick="stRedo()">Redo <kbd>R</kbd></button><span class="spacer"></span><button class="btn" onclick="stNext()">Next <kbd>Enter</kbd></button>`;
  if (S.autoAdvance) ST.timer = setTimeout(stNext, 1600);
}
function stHear() { const q = ST.qs[ST.i]; Speech.say(answerOf(q.c, q.dir)); }
function stOverride() {
  const q = ST.qs[ST.i]; if (ST.phase !== 'heard' || q.g.ok || q.ov) return;
  q.ov = true; ST.right++; ST.wrong--; stat(q.c.id, false, true); stat(q.c.id, true); stNext();
}
function stRedo() { if (ST.fb === 'instant' && ST.phase === 'heard') return; clearTimeout(ST.timer); Voice.cancel(); stListen(); }
function stSkip() {
  Voice.cancel();
  if (ST.fb === 'instant') { if (ST.phase === 'ask') stAnswer(''); return; }
  const q = ST.qs[ST.i]; q.said = ''; q.g = Grade.check('', q.c, q.dir); stNext();
}
function stNext() { clearTimeout(ST.timer); Voice.cancel(); Speech.stop(); if (++ST.i >= ST.qs.length) stDone(); else stShow(); }
function stSpace() { if (ST.phase === 'setup') stBuild(); else if (ST.phase === 'ask') stListen(); else if (ST.phase === 'heard') stNext(); }
const stOk = q => q.ov ?? !!q.g?.ok;
function stDone() {
  clearTimeout(ST.timer); Voice.cancel(); Speech.stop();
  ST.phase = 'done';
  const qs = ST.qs.filter(q => q.g);                               // answered or skipped
  qs.forEach(q => { if (!q.recorded) { stat(q.c.id, q.g.ok); q.recorded = true; } });
  const pts = qs.filter(stOk).length, missed = qs.filter(q => !stOk(q)).map(q => q.c);
  ST.missed = missed;
  $('#app').innerHTML = `<div class="panel"><div class="score">${qs.length ? Math.round(pts / qs.length * 100) : 0}%</div>
    <p>${pts} of ${qs.length} said correctly${qs.length < ST.qs.length ? ` (${ST.qs.length - qs.length} not reached)` : ''}.</p>
    <div class="row">${missed.length ? `<button class="btn" onclick="stBuild(ST.missed)">Retake ${missed.length} missed</button><button class="btn alt" onclick="go('slearn', ST.missed)">Spoken Learn the missed</button>` : ''}
    <button class="btn ${missed.length ? 'alt' : ''}" onclick="go('stest')">New spoken test</button></div></div>
  <div class="panel"><h3>Review</h3><p class="muted">Green words were heard, red were missing. If the grader got it wrong, flip the verdict.</p><div class="review">${qs.map((q, i) => `
    <div class="rv-item ${stOk(q) ? 'ok' : 'no'}"><div class="row"><span class="qnum">${i + 1}</span><b>${promptHTML(q.c, q.dir)}</b><span class="spacer"></span>
      <span class="badge ${stOk(q) ? 'ok' : 'no'}">${stOk(q) ? 'Correct' : 'Missed'}</span>
      <button class="btn ghost" onclick="stFlip(${ST.qs.indexOf(q)})">Mark ${stOk(q) ? 'wrong' : 'right'}</button></div>
      ${q.said ? `<div class="said">${esc(q.said)}</div>` : '<div class="muted">Skipped</div>'}<div>${Grade.marked(q.g, esc)}</div></div>`).join('')}</div></div>`;
}
function stFlip(i) { const q = ST.qs[i], was = stOk(q); q.ov = !was; stat(q.c.id, was, true); stat(q.c.id, !was); stDone(); }
KEYS.stest = k => {
  if (k === ' ') { if (ST.phase === 'setup') stBuild(); else micClick(); }
  else if (k === 'enter' && ST.phase === 'heard') stNext();
  else if (k === 'r' && ['heard', 'ask'].includes(ST.phase)) stRedo();
  else if (k === 's' && ['heard', 'ask'].includes(ST.phase)) stSkip();
  else if (k === 'o' && ST.phase === 'heard') stOverride();
  else if (k === 'l' && ST.phase === 'heard') stHear();
  else if (k === 't' && $('#typed')) $('#typed').focus();
  else return;
  return true;
};

/* ---------- alphabet drill ----------
 Type the letter names in order. A letter locks in as soon as what you've typed
 can only be one letter name: "a" -> Alpha, but Epsilon needs "ep" (Eta also starts with e).
*/
let A = {};
const GK = CARDS.filter(c => c.glyph);
const fmtTime = ms => (ms / 1000).toFixed(1) + 's';
function abcStart() {
  clearInterval(A.tick);
  A = {i: 0, errs: GK.map(() => 0), total: 0, t0: 0, done: false};
  const best = store.get('abcBest', null);
  $('#app').innerHTML = `<div class="panel abc-intro"><h2>Alphabet Drill</h2>
    <p class="muted">Type the Greek letters in order. Just enough to tell each apart: <b>a</b> Alpha, <b>ep</b> Epsilon, <b>et</b> Eta. The clock starts on your first letter.</p>
    <label class="toggle"><input type="checkbox" ${S.abcGlyph ? 'checked' : ''} onchange="S.abcGlyph=this.checked;save();abcDraw();$('#abcin').focus()"> Show the next Greek letter as a cue</label></div>
  <div class="top"><span id="abcpos">0 / ${GK.length}</span><div class="bar"><i id="abcbar" style="width:0"></i></div><span id="abctime">0.0s</span>
    <button class="btn ghost" onclick="abcStart()" title="Restart">Restart <kbd>Esc</kbd></button></div>
  <div class="card abc-card">
    <div id="abccue" class="abc-cue"></div>
    <input type="text" id="abcin" class="abc-in" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="Type the next letter&hellip;">
    <div class="micstat" id="abcmsg">${best ? `Best clean run: ${fmtTime(best)}` : ''}</div>
    <div class="abc-grid" id="abcgrid"></div></div>`;
  const el = $('#abcin');
  el.addEventListener('input', abcInput);
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape' || (e.key === 'Enter' && A.done)) { e.preventDefault(); abcStart(); }
  });
  abcDraw(); el.focus();
}
function abcDraw() {
  $('#abcgrid').innerHTML = GK.map((c, k) => k < A.i
    ? `<div class="done ${A.errs[k] ? 'err' : ''}"><span class="glyph-sm">${esc(c.term)}</span>${esc(c.def)}</div>`
    : k === A.i && !A.done ? `<div class="cur">${S.abcGlyph ? `<span class="glyph-sm">${esc(c.term)}</span>` : ''}?</div>` : `<div class="todo">${k + 1}</div>`).join('');
  $('#abccue').innerHTML = S.abcGlyph && !A.done ? `<span class="glyph">${esc(GK[A.i].term)}</span>` : '';
  $('#abcpos').textContent = `${A.i} / ${GK.length}`;
  $('#abcbar').style.width = A.i / GK.length * 100 + '%';
}
function abcClock() { $('#abctime').textContent = fmtTime(performance.now() - A.t0); }
function abcInput(e) {
  const el = e.target;
  if (A.done) return;
  const sep = /[^a-z]$/i.test(el.value);
  let raw = el.value.toLowerCase().replace(/[^a-z]/g, '');
  el.value = raw;
  if (!raw) { if (sep) A.tail = ''; return; }                      // a space ends the last name
  if (!A.t0) { A.t0 = performance.now(); A.tick = setInterval(abcClock, 100); $('.abc-intro')?.classList.add('started'); }
  const starts = v => NAMES.some(n => n.toLowerCase().startsWith(v));
  const only = v => { const h = NAMES.filter(n => n.toLowerCase().startsWith(v)); return h.length === 1 ? h[0] : null; };
  let viaTail = false;
  // After a name locks in, the next keys may just finish typing it ("d" -> Delta, then "elta").
  if (A.tail) {
    if (A.tail.startsWith(raw)) {
      // "ta" -> Tau, then "u": finishing "tau", or Upsilon? Prefer the letter that comes next.
      if (only(raw) === NAMES[A.i]) viaTail = true;
      else {
        if (sep || (raw === A.tail && !starts(raw))) { A.tail = ''; el.value = ''; }
        return;
      }
    } else if (raw.startsWith(A.tail) && starts(raw.slice(A.tail.length))) raw = raw.slice(A.tail.length);  // "xio" -> "o"
    else if (!starts(raw)) { let k = 0; while (k < raw.length && raw[k] === A.tail[k]) k++; raw = raw.slice(k); }
    el.value = raw;
    A.tail = '';
    if (!raw) return;
  }
  let hits = NAMES.filter(n => n.toLowerCase().startsWith(raw));
  if (hits.length > 1) {
    const exact = hits.find(n => n.toLowerCase() === raw);
    if (!sep) return;                                              // keep typing
    if (!exact) { $('#abcmsg').innerHTML = `&ldquo;${esc(raw)}&rdquo; could be ${hits.join(' or ')}. Keep typing.`; return; }
    hits = [exact];
  }
  const want = NAMES[A.i], name = hits[0];
  el.value = '';
  A.tail = name ? name.toLowerCase().slice(raw.length) : '';
  // Typed "tau upsilon" in full: the "u" already counted as Upsilon, so the full word is not a mistake
  if (name && name !== want && A.amb === A.i - 1 && name === NAMES[A.i - 1]) { A.amb = null; return; }
  A.amb = name === want && viaTail ? A.i : null;
  if (name === want) {
    A.i++; $('#abcmsg').innerHTML = '';
    abcDraw();
    if (A.i === GK.length) abcDone();
    return;
  }
  A.errs[A.i]++; A.total++;
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  $('#abcmsg').innerHTML = `<span style="color:var(--bad)">${name ? `That's ${name}, not the next letter.` : `No letter starts with &ldquo;${esc(raw)}&rdquo;.`}</span>` +
    (A.errs[A.i] >= 2 ? ` Next is <b>${want}</b>.` : '');
}
function abcDone() {
  clearInterval(A.tick);
  A.done = true;
  const ms = performance.now() - A.t0;
  GK.forEach((c, k) => stat(c.id, !A.errs[k]));
  const best = store.get('abcBest', null), clean = !A.total, record = clean && (!best || ms < best);
  if (record) store.set('abcBest', ms);
  const missed = GK.filter((c, k) => A.errs[k]);
  $('#abctime').textContent = fmtTime(ms);
  $('#abcin').style.display = 'none';
  abcDraw();
  $('#abcmsg').innerHTML = `<div class="score" style="font-size:2.2rem">${fmtTime(ms)}</div>
    ${clean ? (record ? 'No mistakes. New best!' : `No mistakes. Best is ${fmtTime(best)}.`) : `${A.total} mistake${A.total === 1 ? '' : 's'} on ${missed.map(c => c.def).join(', ')}.`}
    <div class="row" style="justify-content:center;margin-top:10px"><button class="btn" id="abcagain" onclick="abcStart()">Again <kbd>Enter</kbd></button>
    ${missed.length ? `<button class="btn alt" onclick="go('slearn', GK.filter((c, k) => A.errs[k]))">${micIcon(16)} Practice the missed</button>` : ''}</div>`;
  $('#abcagain').focus();
}

/* ---------- reference ---------- */
function ref() {
  const greek = CARDS.filter(c => c.glyph);
  $('#app').innerHTML = `<div class="panel"><h2>All cards</h2>
  ${CATS.map(cat => cat === 'Greek Alphabet'
    ? `<h3 style="margin-top:18px">Greek Alphabet</h3><div class="greek">${greek.map(c => `<div><span class="glyph-sm">${esc(c.term)}</span>${esc(c.def)}</div>`).join('')}</div>`
    : `<h3 style="margin-top:18px">${esc(cat)}</h3><table class="ref">${CARDS.filter(c => c.cat === cat).map(c => `<tr><td>${sw(c)}${esc(c.term)}</td><td>${esc(c.def)}</td></tr>`).join('')}</table>`).join('')}</div>`;
}

/* ---------- boot ---------- */
Voice.use(S.engine || 'auto', false);
Voice.probe();
const start = location.hash.slice(1);
go(MODES.some(m => m[0] === start) ? start : 'home');
