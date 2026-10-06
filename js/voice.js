/* ---------- VOICE ----------
 Captures the mic, detects when you start and stop talking, and transcribes
 with one of three engines:

  mac      MLX Whisper on the Apple Silicon GPU, through server.py
           (same origin, or http://localhost:8000 when the site is on GitHub Pages)
  browser  Whisper inside the browser (transformers.js on WebGPU, or WebAssembly),
           downloaded once and cached; nothing to install
  speech   the browser's own speech recognition (Web Speech API); no download,
           but Chrome sends the audio to Google (Safari uses Apple's recognizer)

 "auto" picks mac if the server answers, then in-browser Whisper on WebGPU,
 then browser speech, then in-browser Whisper on the CPU.
*/
const Voice = (() => {
  const RATE = 16000;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const LOCAL = 'http://localhost:8000';
  const E = {
    mac: {status: 'unknown', base: '', model: ''},                 // unknown | up | loading | down
    browser: {status: 'idle', pct: 0, mb: 0, device: '', model: 'onnx-community/whisper-base'},  // idle | loading | ready | error
    speech: {status: SR ? 'ready' : 'unsupported'},
  };
  const NAMES = {mac: 'Mac (MLX Whisper)', browser: 'In-browser Whisper', speech: 'Browser speech'};
  let pref = 'auto', engine = null;
  let ctx, stream, src, node, sink, rec, worker, jobs = {}, jobId = 0;
  let state = 'off';          // off | idle | waiting | recording | busy
  let chunks = [], pre = [], noise = .004, level = 0;
  let tStart = 0, tVoice = 0, tSpeech = 0, opts = {}, done = null;
  const subs = new Set();
  const emit = () => subs.forEach(f => f(state, info()));

  /* ----- engines ----- */
  function choose() {
    const prev = engine;
    if (pref !== 'auto') engine = pref;
    else if (E.mac.status === 'up' || E.mac.status === 'loading') engine = 'mac';
    else if (E.mac.status === 'unknown') engine = null;            // still checking
    else if (navigator.gpu) engine = 'browser';
    else if (SR) engine = 'speech';
    else engine = 'browser';
    if (engine !== prev) emit();
  }
  function info() {
    const i = {engine, pref, name: NAMES[engine] || 'Voice', ready: false, loading: false, msg: '', engines: E};
    if (engine === 'mac') Object.assign(i, {ready: E.mac.status === 'up', loading: E.mac.status === 'loading' || E.mac.status === 'unknown', down: E.mac.status === 'down', model: E.mac.model});
    else if (engine === 'browser') Object.assign(i, {ready: E.browser.status === 'ready', loading: E.browser.status === 'loading', idle: E.browser.status === 'idle', error: E.browser.error, pct: E.browser.pct, mb: E.browser.mb, device: E.browser.device});
    else if (engine === 'speech') Object.assign(i, {ready: E.speech.status === 'ready', down: !SR});
    else i.loading = true;
    return i;
  }

  async function probeMac() {
    const bases = [];
    if (location.protocol.startsWith('http')) bases.push('');
    if (location.origin !== LOCAL) bases.push(LOCAL);
    for (const base of bases) {
      try {
        const r = await fetch(base + '/api/health', {cache: 'no-store', signal: AbortSignal.timeout(2000)});
        const j = await r.json();
        Object.assign(E.mac, {status: j.ready ? 'up' : 'loading', base, model: j.model});
        if (!j.ready) setTimeout(probeMac, 2000);
        choose(); emit();
        return;
      } catch {}
    }
    E.mac.status = 'down'; choose(); emit();
  }

  function use(name) { pref = name; choose(); emit(); if (engine === 'browser') prepare(); }

  // Start downloading in-browser Whisper ahead of the first answer
  function prepare() {
    if (engine !== 'browser' || E.browser.status === 'loading' || E.browser.status === 'ready') return;
    if (!worker) {
      worker = new Worker('js/whisper-worker.js', {type: 'module'});
      worker.onmessage = ({data}) => {
        if (data.type === 'progress') { Object.assign(E.browser, {pct: data.pct, mb: data.mb}); emit(); }
        else if (data.type === 'ready') { Object.assign(E.browser, {status: 'ready', device: data.device, error: ''}); emit(); }
        else if (data.type === 'result') { jobs[data.id]?.({text: data.text, ms: data.ms}); delete jobs[data.id]; }
        else if (data.type === 'error') {
          if (data.id && jobs[data.id]) { jobs[data.id]({error: data.error}); delete jobs[data.id]; }
          else { Object.assign(E.browser, {status: 'error', error: data.error}); emit(); }
        }
      };
    }
    Object.assign(E.browser, {status: 'loading', error: ''}); emit();
    worker.postMessage({type: 'load', model: E.browser.model});
  }

  async function transcribe(pcm) {
    if (engine === 'mac') {
      try {
        const r = await fetch(E.mac.base + '/api/transcribe', {method: 'POST', headers: {'Content-Type': 'application/octet-stream'}, body: pcm.buffer});
        const j = await r.json();
        return j.error ? {error: j.error} : {text: j.text, ms: j.ms};
      } catch {
        E.mac.status = 'down'; choose(); emit();
        return {error: 'Could not reach the voice server. Is `uv run server.py` running?'};
      }
    }
    if (engine === 'browser') {
      prepare();
      const id = ++jobId;
      return new Promise(r => { jobs[id] = r; worker.postMessage({type: 'run', id, audio: pcm}, [pcm.buffer]); });
    }
    return {error: 'No speech engine is available.'};
  }

  /* ----- microphone ----- */
  async function ensureMic() {
    if (ctx && stream && stream.active) { if (ctx.state !== 'running') await ctx.resume(); return; }
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no microphone access here. Open the site over https or http://localhost.');
    stream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true}});
    ctx = new AudioContext();
    const code = `class Cap extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(1024);this.n=0}
      process(i){const c=i[0]&&i[0][0];if(!c)return true;for(let k=0;k<c.length;k++){this.b[this.n++]=c[k];if(this.n===1024){this.port.postMessage(this.b.slice(0));this.n=0}}return true}}
      registerProcessor('cap',Cap)`;
    await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([code], {type: 'application/javascript'})));
    src = ctx.createMediaStreamSource(stream);
    node = new AudioWorkletNode(ctx, 'cap');
    sink = ctx.createGain(); sink.gain.value = 0;
    src.connect(node); node.connect(sink); sink.connect(ctx.destination);
    node.port.onmessage = e => onChunk(e.data);
    state = 'idle'; emit();
    prepare();
  }

  function release() {
    cancel();
    stream?.getTracks().forEach(t => t.stop());
    ctx?.close();
    ctx = stream = null; state = 'off'; emit();
  }

  function onChunk(buf) {
    let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    const rms = Math.sqrt(s / buf.length);
    level = level * .6 + rms * .4;
    if (rec) return;                                               // browser speech does its own detection
    const now = performance.now();
    const thr = Math.max(.012, noise * 3.5);
    if (state === 'waiting') {
      pre.push(buf); if (pre.length > 8) pre.shift();          // ~170 ms pre-roll
      if (rms < thr) noise = noise * .95 + rms * .05;
      if (rms > thr) { state = 'recording'; chunks = pre.slice(); tVoice = tSpeech = now; emit(); }
      else if (now - tStart > opts.waitMs) finish({nospeech: true});
    } else if (state === 'recording') {
      chunks.push(buf);
      if (rms > thr * .7) tVoice = now;
      if (now - tVoice > opts.silenceMs && now - tSpeech > 350) stop();
      else if (now - tSpeech > opts.maxMs) stop();
    }
  }

  /* ----- listening ----- */
  // Resolves with {text, ms} | {nospeech} | {cancelled} | {error}
  function listen(o = {}) {
    cancel();
    opts = {silenceMs: 900, waitMs: 12000, maxMs: 45000, ...o};
    chunks = []; pre = []; tStart = performance.now();
    state = 'waiting'; emit();
    const p = new Promise(r => { done = r; });
    if (engine === 'speech') listenSpeech();
    return p;
  }

  function listenSpeech() {
    const r = rec = new SR();
    r.lang = 'en-US'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    let text = '', heard = 0;
    const t = setInterval(() => {                                  // stop on our own pause rule, like the other engines
      if (rec !== r) return clearInterval(t);
      const now = performance.now();
      if (heard && now - heard > opts.silenceMs + 250) r.stop();
      else if (!heard && now - tStart > opts.waitMs) r.stop();
    }, 150);
    r.onresult = e => {
      text = [...e.results].map(x => x[0].transcript).join(' ').trim();
      heard = performance.now();
      if (state === 'waiting') { state = 'recording'; emit(); }
    };
    r.onerror = e => { if (rec === r && !['no-speech', 'aborted'].includes(e.error)) { rec = null; finish({error: 'Browser speech: ' + e.error}); } };
    r.onend = () => { clearInterval(t); if (rec !== r) return; rec = null; finish(text ? {text, ms: 0} : {nospeech: true}); };
    r.start();
  }

  // Stop recording now and transcribe what was heard
  async function stop() {
    if (rec) { state = 'busy'; emit(); rec.stop(); return; }
    if (state === 'waiting') return finish({nospeech: true});
    if (state !== 'recording') return;
    state = 'busy'; emit();
    const pcm = resample(chunks, ctx.sampleRate);
    chunks = [];
    if (pcm.length < RATE * .25) return finish({nospeech: true});
    const resolve = done;
    const res = await transcribe(pcm);
    if (done !== resolve) return;                                  // cancelled meanwhile
    finish(res);
  }

  function finish(res) {
    const r = done; done = null;
    if (state !== 'off') state = 'idle';
    emit(); r?.(res);
  }
  function cancel() {
    if (rec) { const r = rec; rec = null; try { r.abort(); } catch {} }
    if (done) finish({cancelled: true});
  }

  // Box-filter downsample to 16 kHz mono float32
  function resample(parts, rate) {
    const n = parts.reduce((s, p) => s + p.length, 0), all = new Float32Array(n);
    let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
    const k = rate / RATE, out = new Float32Array(Math.floor(n / k));
    for (let i = 0; i < out.length; i++) {
      const a = Math.floor(i * k), b = Math.min(n, Math.max(a + 1, Math.floor((i + 1) * k)));
      let s = 0; for (let j = a; j < b; j++) s += all[j];
      out[i] = s / (b - a);
    }
    return out;
  }

  return {
    probe: probeMac, use, prepare, ensureMic, release, listen, stop, cancel, info, NAMES,
    hasSpeech: !!SR, hasGPU: !!navigator.gpu,
    get state() { return state; },
    get level() { return level; },
    on: f => (subs.add(f), () => subs.delete(f)),
  };
})();
