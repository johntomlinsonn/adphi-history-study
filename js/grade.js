/* ---------- GRADING ----------
 Spoken answers come back from Whisper with filler words, number words and
 small misspellings, so grading is by coverage of the answer's key words,
 with fuzzy matching per word. Typed answers use the same grader.
*/
const Grade = (() => {
  const STOP = new Set('a an the of to and or in on at by for with is are was were be been it its that this which our we us as um uh umm uhh er hmm like so i think answer my your their they them just okay ok well'.split(' '));
  const ONES = {zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,
    first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10,eleventh:11,twelfth:12,thirteenth:13,fourteenth:14,fifteenth:15,sixteenth:16,seventeenth:17,eighteenth:18,nineteenth:19};
  const TENS = {twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,twentieth:20,thirtieth:30};

  const clean = s => String(s).toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  // "eighteen thirty two" -> 1832, "twenty ninth" -> 29, "29th" -> 29
  function numbers(toks) {
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      let t = toks[i].replace(/^(\d+)(st|nd|rd|th)$/, '$1');
      if (t in TENS) {
        let v = TENS[t];
        if (toks[i + 1] in ONES && ONES[toks[i + 1]] < 10) v += ONES[toks[++i]];
        out.push({n: v, w: true});
      } else if (t in ONES) out.push({n: ONES[t], w: true});
      else if (t === 'hundred' && out.length && out[out.length - 1].w) out[out.length - 1].h = true;
      else if (/^\d+$/.test(t)) out.push({n: +t, w: false, s: t});
      else out.push(t);
    }
    const res = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i], b = out[i + 1];
      if (typeof a === 'string') { res.push(a); continue; }
      if (a.h) { // eighteen hundred thirty two
        let v = a.n * 100;
        if (b && typeof b === 'object' && b.n < 100) { v += b.n; i++; }
        res.push(String(v));
      } else if (a.w && b && typeof b === 'object' && b.w && a.n >= 10 && a.n <= 20 && b.n >= 10 && b.n < 100) {
        res.push(String(a.n * 100 + b.n)); i++; // year: eighteen thirty-two
      } else if (a.n >= 20 && a.n < 100 && a.n % 10 === 0 && b && typeof b === 'object' && b.n > 0 && b.n < 10) {
        res.push(String(a.n + b.n)); i++;       // "20th, 9th" -> 29
      } else res.push(a.s ?? String(a.n));
    }
    return res;
  }

  // Greek letter names are matched exactly (Epsilon must not pass for Upsilon),
  // allowing the ways Whisper tends to spell them when said alone
  const SAYS = {alpha:'alfa',beta:'bayta beeta bata',gamma:'gama',delta:'',epsilon:'',zeta:'zayta zeeta zita',eta:'ayta aita ita ate',
    theta:'thayta theeta',iota:'yota eota',kappa:'capa cappa kapa',lambda:'lamda',mu:'mew moo myu mue',nu:'new knew noo nue gnu',
    xi:'zai zi ksi ksee xai zy zye see sea sai',omicron:'omnicron omikron omacron',pi:'pie pye',rho:'row roe rowe ro',sigma:'',tau:'taw tao tow',
    upsilon:'oopsilon ipsilon upsalon',phi:'fee fi fie fy phy',chi:'kai ky kye chai khi kie',psi:'sigh sy psy si sie',omega:'omaga'};
  const GREEKW = Object.fromEntries(Object.entries(SAYS).map(([k, v]) => [k, new Set([k, ...v.split(' ').filter(Boolean)])]));

  const tokens = s => numbers(clean(s).split(' ').filter(Boolean));
  const content = s => tokens(s).filter(t => !STOP.has(t));
  const stem = t => t.length > 4 ? t.replace(/(ing|ed|es|s)$/, '') : t;

  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 3) return 9;
    let p = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const q = [i];
      for (let j = 1; j <= b.length; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      p = q;
    }
    return p[b.length];
  }

  function same(a, b) {
    if (GREEKW[a]) return GREEKW[a].has(b);
    if (a === b || stem(a) === stem(b)) return true;
    if (/^\d+$/.test(a) || /^\d+$/.test(b)) return false; // numbers must match exactly
    const m = Math.min(a.length, b.length);
    if (m >= 3 && (a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 1) return true;
    const d = lev(a, b);
    return m >= 9 ? d <= 3 : m >= 6 ? d <= 2 : m >= 4 ? d <= 1 : false;   // the in-browser model misspells long words more
  }

  // Longest run of answer words said in the right order
  function inOrder(want, said) {
    const L = want.map(() => Array(said.length + 1).fill(0));
    const at = (i, j) => i < 0 ? 0 : L[i][j];
    want.forEach((w, i) => { for (let j = 1; j <= said.length; j++) L[i][j] = same(w, said[j - 1]) ? at(i - 1, j - 1) + 1 : Math.max(at(i - 1, j), L[i][j - 1]); });
    const hits = new Set();
    for (let i = want.length - 1, j = said.length; i >= 0 && j > 0;) {
      if (same(want[i], said[j - 1]) && L[i][j] === at(i - 1, j - 1) + 1) { hits.add(want[i]); i--; j--; }
      else if (at(i - 1, j) >= L[i][j - 1]) i--; else j--;
    }
    return hits;
  }

  // Score one target answer against the response
  function against(resp, target, c = {}) {
    const rt = tokens(resp);
    const pool = rt.concat(rt.slice(1).map((t, i) => rt[i] + t)); // "saltire wise" -> "saltirewise"
    const want = content(target);
    if (!want.length) return {ok: clean(resp) === clean(target), hits: new Set(), score: 0, target};
    const hits = c.ordered ? inOrder(want, rt) : new Set(want.filter(w => pool.some(r => same(w, r))));
    const thr = c.thr || (want.length > 12 ? .75 : .8);
    const need = Math.ceil(want.length * thr);
    return {ok: hits.size >= need, hits, score: hits.size / want.length, target};
  }

  // Grade a response against a card in a direction ("td": say the definition, "dt": say the term)
  function check(resp, c, dir) {
    if (!String(resp || '').trim()) return {ok: false, hits: new Set(), score: 0, target: dir === 'td' ? c.def : c.term, empty: true};
    const targets = dir === 'td' ? [c.def.replace(/\s*\([^)]*\)/g, ''), c.def, ...(c.alt || [])] : [c.term.replace(/\s*\([^)]*\)/g, ''), c.term];
    const results = targets.map(t => against(resp, t, c));
    return results.find(r => r.ok) || results.sort((a, b) => b.score - a.score)[0];
  }

  // Wrap each word of the answer in hit/miss marks for feedback
  function marked(g, esc) {
    return g.target.split(/(\s+)/).map(w => {
      const t = tokens(w).filter(x => !STOP.has(x));
      if (!t.length) return esc(w);
      return `<mark class="${t.every(x => g.hits.has(x)) ? 'hit' : 'miss'}">${esc(w)}</mark>`;
    }).join('');
  }

  // Hint: first letter of each word (level 1) or the first half of each word (level 2)
  function hint(text, level) {
    return text.split(/(\s+)/).map(w => {
      if (!/[A-Za-z]/.test(w)) return w;
      const n = level > 1 ? Math.ceil(w.replace(/[^A-Za-z]/g, '').length / 2) : 1;
      let k = 0;
      return w.replace(/[A-Za-z]/g, ch => k++ < n ? ch : '_');
    }).join('');
  }

  return {check, marked, clean, hint};
})();
