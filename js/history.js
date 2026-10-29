/* ---------- history modes ----------
 The history cards (Greek Life History, ADPhi Founding, Illinois Chapter) work in every study mode.
 These three modes suit the kinds of facts they hold:
   Timeline     put events in order (dates and "what came first")
   Sort         put names into the group they belong to (houses, people, presidents' terms)
   List Recall  name every item of a list from memory (founders, refounders, presidents, houses)
 Data lives in data.js: TIMELINE, SORTS, LISTS.
*/
const HIST_MODES = ['tl', 'sort', 'recall'];
function histSwitch() {
  const t = {tl: ['Timeline', ICON.clock], sort: ['Sort', ICON.sort], recall: ['Recall', ICON.recall]};
  return `<div class="via three" role="tablist">${HIST_MODES.map(k => `<button class="${mode === k ? 'on' : ''}" onclick="go('${k}')">${t[k][1]}${t[k][0]}</button>`).join('')}</div>`;
}
const histChips = (items, on, fn) => `<div class="chips hchips">${items.map(([k, l]) => `<button class="chip ${on(k) ? 'on' : ''}" onclick="${fn}('${k}')">${esc(l)}</button>`).join('')}</div>`;
const shakeEl = el => { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };

/* ---------- Timeline ----------
 Five or so events are shuffled. Tap them in the order they happened. Check shows the dates.
 Events you place wrongly come up more often.
*/
let TL = {};
const tlKey = e => e.y + (e.m || 0) / 13;
const tlWhen = e => e.y + '';
function tlGroups() { const all = TL_GROUPS.map((_, i) => i), g = (S.tlg || all).filter(i => all.includes(i)); return g.length ? g : all; }
function tlStart() {
  TL = {n: S.tln || 5};
  tlRound();
}
function tlRound(same) {
  if (!same) {
    const pool = TIMELINE.filter(e => tlGroups().includes(e.g));
    const weak = e => { const s = STATS['tl-' + e.id]; return (!s ? 1.5 : s.box) + Math.random() * 2.5; };
    const picked = [];
    for (const e of pool.map(e => [e, weak(e)]).sort((a, b) => a[1] - b[1]).map(x => x[0])) {
      if (picked.length >= TL.n) break;
      if (!picked.some(p => Math.abs(tlKey(p) - tlKey(e)) < .001)) picked.push(e);
    }
    TL.events = picked;
  }
  TL.order = [];
  TL.checked = false;
  TL.pile = shuffle(TL.events);
  tlRender();
}
function tlRender() {
  const n = TL.events.length, right = TL.checked ? TL.events.slice().sort((a, b) => tlKey(a) - tlKey(b)) : null;
  const row = (e, i) => {
    const ok = TL.checked && right[i] === e;
    return `<li class="tl-row ${TL.checked ? (ok ? 'ok' : 'no') : ''}"><span class="n">${i + 1}</span>
      <button class="tl-ev" ${TL.checked ? 'disabled' : `onclick="tlUnplace(${i})"`}>${esc(e.t)}</button>${TL.checked ? `<b class="tl-yr">${esc(tlWhen(e))}</b>` : ''}</li>`;
  };
  const slots = TL.order.map(row).join('') + Array.from({length: n - TL.order.length}, (_, i) => `<li class="tl-row empty"><span class="n">${TL.order.length + i + 1}</span><span class="tl-blank">${i ? '' : 'Tap the event that came first'}</span></li>`).join('');
  const got = TL.checked ? TL.order.filter((e, i) => right[i] === e).length : 0;
  $('#app').innerHTML = `${histSwitch()}
  <div class="panel setup tl-set"><div><div class="flabel">Topics</div>${histChips(TL_GROUPS.map((g, i) => [i, g]), i => tlGroups().includes(+i), 'tlToggle')}</div>
    <div><div class="flabel">Events per round</div>${histChips([4, 5, 6, 8].map(k => [k, k]), k => TL.n === +k, 'tlSize')}</div></div>
  <div class="card tl-card"><div class="tag">Timeline &middot; earliest first</div>
    <ol class="tl-list">${slots}</ol>
    ${TL.checked ? `<div class="fb ${got === n ? 'ok' : 'no'}"><b class="v">${got === n ? 'Perfect order' : `${got} of ${n} in the right place`}</b>${got === n ? '' : 'The dates are shown on the right. Wrong ones come up more often.'}</div>` : ''}
    <div class="tl-pile">${TL.pile.map((e, i) => `<button class="tl-ev pile" onclick="tlPlace(${i})">${esc(e.t)}</button>`).join('')}</div>
    <div class="row" style="justify-content:center;margin-top:12px">
      ${TL.checked ? `<button class="btn" id="tlnext" onclick="tlRound()">Next round <kbd>Enter</kbd></button><button class="btn alt" onclick="tlRound(true)">Try these again</button>`
        : `<button class="btn" onclick="tlCheck()" ${TL.pile.length ? 'disabled' : ''}>Check <kbd>Enter</kbd></button><button class="btn ghost" onclick="tlReset()" ${TL.order.length ? '' : 'disabled'}>Clear</button>`}
    </div></div>`;
  if (TL.checked) $('#tlnext')?.focus({preventScroll: true});
}
function tlToggle(i) {
  const g = tlGroups().includes(+i) ? tlGroups().filter(x => x !== +i) : [...tlGroups(), +i];
  S.tlg = g.length ? g : tlGroups(); save(); TL.n = Math.min(TL.n, TIMELINE.filter(e => S.tlg.includes(e.g)).length); tlRound();
}
function tlSize(k) { S.tln = TL.n = +k; save(); tlRound(); }
function tlPlace(i) { if (TL.checked) return; TL.order.push(TL.pile.splice(i, 1)[0]); tlRender(); }
function tlUnplace(i) { if (TL.checked) return; TL.pile.push(...TL.order.splice(i)); TL.pile = shuffle(TL.pile); tlRender(); }
function tlReset() { TL.pile = shuffle(TL.events); TL.order = []; tlRender(); }
function tlCheck() {
  if (TL.pile.length || TL.checked) return;
  const right = TL.events.slice().sort((a, b) => tlKey(a) - tlKey(b));
  TL.order.forEach((e, i) => stat('tl-' + e.id, right[i] === e));
  TL.checked = true; tlRender(); reveal('#tlnext');
}
function tlKeyDown(k) {
  if (k === 'enter') { TL.checked ? tlRound() : tlCheck(); return true; }
  if (/^[1-9]$/.test(k) && !TL.checked && +k <= TL.pile.length) { tlPlace(+k - 1); return true; }
  if (k === 'backspace' && !TL.checked && TL.order.length) { tlUnplace(TL.order.length - 1); return true; }
}

/* ---------- Sort ----------
 Tap an item (the next one is already picked), then tap the group it belongs to. A right
 answer drops it into the group; a wrong one shakes and counts as a miss.
*/
let SO = {};
function soStart(id) {
  const def = SORTS.find(s => s.id === (id || S.soId)) || SORTS[0];
  S.soId = def.id; save();
  let items = def.items.map((it, i) => ({text: it[0], b: it[1], i}));
  if (def.pickN) {                       // a few from each group, then fill up at random
    const first = def.buckets.map((_, b) => pick(items.filter(x => x.b === b)));
    items = [...first, ...shuffle(items.filter(x => !first.includes(x))).slice(0, def.pickN - first.length)];
  }
  SO = {def, missed: new Set(), pile: shuffle(items), sel: 0, put: def.buckets.map(() => []), miss: 0, t0: 0, done: false, total: items.length};
  soRender();
}
function soRender() {
  const d = SO.def, placed = SO.total - SO.pile.length;
  $('#app').innerHTML = `${histSwitch()}
  <div class="chips hchips sortpick">${SORTS.map(s => `<button class="chip ${s.id === d.id ? 'on' : ''}" onclick="soStart('${s.id}')">${esc(s.title)}</button>`).join('')}</div>
  <div class="top"><span>${placed} / ${SO.total}</span><div class="bar"><i style="width:${placed / SO.total * 100}%"></i></div><span id="somiss">${SO.miss} miss${SO.miss === 1 ? '' : 'es'}</span></div>
  <div class="card so-card"><div class="tag">Sort</div><div class="so-ask">${esc(d.ask)}</div>
    ${SO.done ? '' : `<div class="so-pile" id="sopile">${SO.pile.map((x, k) => `<button class="so-item ${k === SO.sel ? 'sel' : ''}" onclick="soSel(${k})">${esc(x.text)}</button>`).join('')}</div>`}
    <div class="so-buckets" style="--cols:${d.buckets.length > 3 ? 2 : d.buckets.length}">${d.buckets.map((b, j) => `<button class="so-bucket" id="sob${j}" onclick="soDrop(${j})" ${SO.done ? 'disabled' : ''}>
      <b><span class="n">${j + 1}</span>${esc(b)}</b><div class="so-in">${SO.put[j].map(x => `<span class="so-got">${esc(x.text)}</span>`).join('')}</div></button>`).join('')}</div>
    ${SO.done ? soDoneHTML() : `<div class="muted" style="margin-top:10px">${keyHint('Press <kbd>1</kbd>&ndash;<kbd>' + d.buckets.length + '</kbd> to drop the highlighted item in that group.', 'Tap an item, then tap its group.')}</div>`}
  </div>`;
}
function soDoneHTML() {
  const best = store.get('soBest', {}), id = SO.def.id;
  const rec = !SO.miss && !best[id];
  if (SO.miss < (best[id] ?? 99)) { best[id] = SO.miss; store.set('soBest', best); }
  const next = SORTS[(SORTS.findIndex(s => s.id === id) + 1) % SORTS.length];
  return `<div class="fb ${SO.miss ? 'no' : 'ok'}" style="margin-top:12px"><b class="v">${SO.miss ? `Done, with ${SO.miss} miss${SO.miss === 1 ? '' : 'es'}` : rec ? 'Clean sort. First time!' : 'Clean sort'}</b>${SO.missed.size ? `Tricky: ${[...SO.missed].map(esc).join(', ')}` : 'Every item went in the right group on the first try.'}</div>
    <div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="soagain" onclick="soStart('${id}')">Again <kbd>Enter</kbd></button>
    <button class="btn alt" onclick="soStart('${next.id}')">Next: ${esc(next.title)}</button></div>`;
}
function soSel(k) { if (SO.done) return; SO.sel = k; document.querySelectorAll('.so-item').forEach((b, i) => b.classList.toggle('sel', i === k)); }
function soDrop(j) {
  if (SO.done || !SO.pile.length) return;
  const x = SO.pile[SO.sel];
  if (x.b === j) {
    SO.put[j].push(x); SO.pile.splice(SO.sel, 1); SO.sel = Math.min(SO.sel, SO.pile.length - 1);
    if (!SO.pile.length) { SO.done = true; }
    soRender();
    if (SO.done) $('#soagain')?.focus({preventScroll: true});
  } else {
    SO.miss++; SO.missed.add(x.text);
    shakeEl($('#sob' + j)); $('#somiss').textContent = `${SO.miss} miss${SO.miss === 1 ? '' : 'es'}`;
  }
}
function soKeyDown(k) {
  if (k === 'enter' && SO.done) { soStart(SO.def.id); return true; }
  if (/^[1-9]$/.test(k) && +k <= SO.def.buckets.length) { soDrop(+k - 1); return true; }
  if ((k === 'arrowright' || k === 'arrowdown') && SO.pile.length) { soSel((SO.sel + 1) % SO.pile.length); return true; }
  if ((k === 'arrowleft' || k === 'arrowup') && SO.pile.length) { soSel((SO.sel - 1 + SO.pile.length) % SO.pile.length); return true; }
}

/* ---------- List Recall ----------
 Name every item of a list from memory, in any order. Each correct answer fills in its slot
 (grading is the same forgiving key-word match as the other modes). Lists with a clue
 (presidents by year, houses by years) fill in beside it. Hint shows first letters.
*/
let RC = {};
function rcStart(id) {
  clearInterval(RC.tick);
  const def = LISTS.find(l => l.id === (id || S.rcId)) || LISTS[0];
  S.rcId = def.id; save();
  RC = {def, items: def.items, got: def.items.map(() => false), t0: 0, miss: 0, hints: false, revealed: false, done: false, said: []};
  rcRender();
}
function rcRender() {
  const d = RC.def, found = RC.got.filter(Boolean).length, best = store.get('rcBest', {})[d.id];
  $('#app').innerHTML = `${histSwitch()}
  <div class="chips hchips sortpick">${LISTS.map(l => `<button class="chip ${l.id === d.id ? 'on' : ''}" onclick="rcStart('${l.id}')">${esc(l.title)}</button>`).join('')}</div>
  <div class="top"><span id="rcpos">${found} / ${RC.items.length}</span><div class="bar"><i id="rcbar" style="width:${found / RC.items.length * 100}%"></i></div><span id="rctime">${RC.t0 ? fmtTime(performance.now() - RC.t0) : '0.0s'}</span></div>
  <div class="card rc-card"><div class="tag">List recall${best ? ` &middot; best ${fmtTime(best)}` : ''}</div><div class="so-ask">${esc(d.ask)}</div>
    ${RC.done ? '' : `<input type="text" id="rcin" class="abc-in rc-in" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Type one, press Enter&hellip;">
      <div class="micstat" id="rcmsg"></div>`}
    <div class="rc-grid ${RC.items.some(it => it.clue) ? 'clued' : ''}">${RC.items.map((it, i) => `<div class="rc-slot ${RC.got[i] ? 'got' : RC.revealed ? 'rev' : ''}"><span class="n">${i + 1}</span>
      <span class="rc-body">${it.clue ? `<small>${esc(it.clue)}</small>` : ''}<b>${RC.got[i] || RC.revealed ? esc(it.a) : RC.hints ? `<span class="rc-hint">${esc(Grade.hint(it.a, 1))}</span>` : '<span class="rc-q">?</span>'}</b></span></div>`).join('')}</div>
    ${RC.done ? rcDoneHTML() : `<div class="row" style="justify-content:center;margin-top:12px"><button class="btn alt" onclick="rcHint()">${RC.hints ? 'Hide hints' : 'Hint'} <kbd>Tab</kbd></button><button class="btn ghost" onclick="rcReveal()">Show the rest</button></div>`}
  </div>`;
  const el = $('#rcin');
  if (el) { el.focus(); el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); rcSubmit(); } else if (e.key === 'Tab') { e.preventDefault(); rcHint(); } }); }
  if (RC.done) $('#rcagain')?.focus({preventScroll: true});
}
function rcDoneHTML() {
  const ms = RC.ms, clean = !RC.revealed;
  return `<div class="fb ${clean && !RC.miss ? 'ok' : 'no'}" style="margin-top:12px"><b class="v">${clean ? `All ${RC.items.length} in ${fmtTime(ms)}` : `${RC.got.filter(Boolean).length} of ${RC.items.length} from memory`}</b>
    ${clean ? `${RC.miss ? RC.miss + ' wrong guess' + (RC.miss === 1 ? '' : 'es') + '.' : 'No wrong guesses.'}${RC.rec ? ' New best time!' : ''}` : 'The ones in the dashed boxes were shown to you. Try again to get them all.'}</div>
    <div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="rcagain" onclick="rcStart('${RC.def.id}')">Again <kbd>Enter</kbd></button>
    <button class="btn alt" onclick="rcStart('${LISTS[(LISTS.findIndex(l => l.id === RC.def.id) + 1) % LISTS.length].id}')">Next list</button></div>`;
}
function rcClock() { const t = $('#rctime'); if (t) t.textContent = fmtTime(performance.now() - RC.t0); }
function rcSubmit() {
  const el = $('#rcin'), v = el?.value.trim();
  if (!v || RC.done) return;
  if (!RC.t0) { RC.t0 = performance.now(); RC.tick = setInterval(rcClock, 100); }
  let hit = -1;
  RC.items.forEach((it, i) => { if (hit < 0 && !RC.got[i] && Grade.check(v, {def: it.a, alt: it.alt}, 'td').ok) hit = i; });
  if (hit < 0) {
    const dup = RC.items.some((it, i) => RC.got[i] && Grade.check(v, {def: it.a, alt: it.alt}, 'td').ok);
    RC.miss += dup ? 0 : 1; shakeEl(el);
    $('#rcmsg').innerHTML = `<span style="color:${dup ? 'var(--muted)' : 'var(--bad)'}">${dup ? 'You already have that one.' : `&ldquo;${esc(v)}&rdquo; isn&rsquo;t on the list.`}</span>`;
    el.select(); return;
  }
  RC.got[hit] = true; el.value = '';
  if (RC.got.every(Boolean)) return rcFinish();
  const keep = $('#rcin').value; rcRender(); $('#rcin').value = keep;
  $('#rcmsg').innerHTML = `<span style="color:var(--good)">&#10003; ${esc(RC.items[hit].a)}</span>`;
}
function rcFinish() {
  clearInterval(RC.tick);
  RC.done = true; RC.ms = performance.now() - RC.t0;
  if (!RC.revealed && !RC.miss) {
    const best = store.get('rcBest', {}), id = RC.def.id;
    if (!best[id] || RC.ms < best[id]) { RC.rec = !!best[id] || true; best[id] = RC.ms; store.set('rcBest', best); }
  }
  rcRender();
}
function rcHint() { if (RC.done) return; RC.hints = !RC.hints; const keep = $('#rcin')?.value || ''; rcRender(); if ($('#rcin')) $('#rcin').value = keep; }
function rcReveal() { if (RC.done) return; RC.revealed = true; rcFinish(); }
function rcKeyDown(k) {
  if (k === 'enter' && RC.done) { rcStart(RC.def.id); return true; }
}
