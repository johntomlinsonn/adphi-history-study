"""ADPhi Study server.

Serves the static study site and a local speech-to-text endpoint backed by
MLX Whisper, which runs on the Apple Silicon GPU. Audio never leaves the Mac.

    uv run server.py            # http://localhost:8000
    uv run server.py --model mlx-community/whisper-small-mlx --port 8080

POST /api/transcribe
    body: raw little-endian float32 PCM, mono, 16 kHz
    returns: {"text": "...", "ms": 312}
GET /api/health
    returns: {"ok": true, "model": "...", "ready": true}

The GitHub Pages copy of the site (https://johntomlinsonn.github.io) may call this
API on http://localhost:8000, so it can use your Mac's model too.
"""

import argparse
import json
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent

# Vocabulary hint so Whisper spells the fraternity's names correctly.
PROMPT = (
    "Alpha Delta Phi. Manus Multae Cor Unum. Many hands, one heart. "
    "Star, crescent, sword and spear, monument, lily of the valley. White, green, black. "
    "Alpha, Beta, Gamma, Delta, Epsilon, Zeta, Eta, Theta, Iota, Kappa, Lambda, Mu, "
    "Nu, Xi, Omicron, Pi, Rho, Sigma, Tau, Upsilon, Phi, Chi, Psi, Omega."
)

MODEL = "mlx-community/whisper-large-v3-turbo"
# Sites allowed to call the API from another origin, e.g. the GitHub Pages copy of
# this site using your Mac's model. Add more with --allow-origin.
ALLOWED_ORIGINS = {"https://johntomlinsonn.github.io"}
_lock = threading.Lock()
_ready = False


def transcribe(audio: np.ndarray) -> str:
    import mlx_whisper

    with _lock:  # MLX is not re-entrant; serialize requests
        result = mlx_whisper.transcribe(
            audio,
            path_or_hf_repo=MODEL,
            language="en",
            initial_prompt=PROMPT,
            condition_on_previous_text=False,
            temperature=0.0,
        )
    return result.get("text", "").strip()


def warm_up():
    global _ready
    t = time.time()
    print(f"Loading {MODEL} (first run downloads it from Hugging Face)...", flush=True)
    transcribe(np.zeros(16000, dtype=np.float32))
    _ready = True
    print(f"Model ready in {time.time() - t:.1f}s", flush=True)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)

    def _cors(self):
        origin = self.headers.get("Origin", "")
        local = origin.startswith(("http://localhost:", "http://127.0.0.1:"))
        if origin in ALLOWED_ORIGINS or local:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            # Chrome asks before a public site may talk to localhost
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/health":
            return self._json(200, {"ok": True, "model": MODEL, "ready": _ready})
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/transcribe":
            return self._json(404, {"error": "not found"})
        n = int(self.headers.get("Content-Length", 0))
        if n <= 0 or n % 4 or n > 16000 * 4 * 120:
            return self._json(400, {"error": "expected float32 PCM, 16 kHz, up to 2 min"})
        audio = np.frombuffer(self.rfile.read(n), dtype="<f4").copy()
        t = time.time()
        try:
            text = transcribe(audio)
        except Exception as e:  # surface model errors to the page
            return self._json(500, {"error": str(e)})
        return self._json(200, {"text": text, "ms": round((time.time() - t) * 1000)})


def main():
    global MODEL
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--model", default=MODEL, help="any mlx-community Whisper repo")
    ap.add_argument("--allow-origin", action="append", default=[], help="extra site allowed to use the API")
    args = ap.parse_args()
    MODEL = args.model
    ALLOWED_ORIGINS.update(o.rstrip("/") for o in args.allow_origin)

    try:
        srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    except OSError as e:
        if e.errno != 48:
            raise
        raise SystemExit(
            f"Port {args.port} is already in use. ADPhi Study may already be running "
            f"at http://localhost:{args.port}. Otherwise run: uv run server.py --port 8001"
        )
    threading.Thread(target=warm_up, daemon=True).start()
    print(f"ADPhi Study: http://localhost:{args.port}", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
