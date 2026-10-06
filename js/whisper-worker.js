/* ---------- IN-BROWSER WHISPER ----------
 Runs OpenAI Whisper inside the browser with transformers.js, on the GPU through
 WebGPU when available (Apple Silicon Macs in Chrome, Edge and Safari 26), or on
 the CPU through WebAssembly otherwise. The model is downloaded once from
 Hugging Face and cached by the browser; audio never leaves the device.
 Used when the site is hosted (GitHub Pages) and the MLX server isn't running.
*/
import {pipeline, env} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0';

env.allowLocalModels = false;
let asr = null, loading = null;

async function load(model) {
  let device = 'wasm', dtype = 'q8';
  if (self.navigator.gpu) {
    try {
      const adapter = await self.navigator.gpu.requestAdapter();
      if (adapter) {
        device = 'webgpu';
        dtype = adapter.features.has('shader-f16')
          ? {encoder_model: 'fp16', decoder_model_merged: 'fp16'}
          : {encoder_model: 'fp32', decoder_model_merged: 'q4'};
      }
    } catch {}
  }
  const files = {};
  asr = await pipeline('automatic-speech-recognition', model, {
    device, dtype,
    progress_callback: p => {
      if (p.status === 'progress' && p.total && p.file.endsWith('.onnx')) {   // the model files are what take time
        files[p.file] = [p.loaded, p.total];
        const all = Object.values(files), got = all.reduce((s, f) => s + f[0], 0), tot = all.reduce((s, f) => s + f[1], 0);
        self.postMessage({type: 'progress', pct: Math.round(got / tot * 100), mb: Math.round(tot / 1e6)});
      }
    },
  });
  await asr(new Float32Array(16000), {language: 'english', task: 'transcribe'});   // compile shaders now, not on the first answer
  return device;
}

self.onmessage = async ({data}) => {
  try {
    if (data.type === 'load') {
      loading = loading || load(data.model);
      const device = await loading;
      self.postMessage({type: 'ready', device});
    } else if (data.type === 'run') {
      await loading;
      const t = performance.now();
      const out = await asr(data.audio, {language: 'english', task: 'transcribe'});
      self.postMessage({type: 'result', id: data.id, text: (out.text || '').trim(), ms: Math.round(performance.now() - t)});
    }
  } catch (e) {
    loading = null;
    self.postMessage({type: 'error', id: data.id, error: String(e?.message || e)});
  }
};
