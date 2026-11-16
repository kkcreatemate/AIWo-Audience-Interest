#!/usr/bin/env bash
# KK Verse Studio · one-time setup. Safe to run again; it only installs what is missing.
#   KKV_SKIP_MODELS=1 bash studio/setup.sh    skip pre-downloading the speech + tracking models
set -euo pipefail
cd "$(dirname "$0")"
say() { printf '\n▸ %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
SUDO=""; if [ "$(id -u 2>/dev/null || echo 0)" != 0 ] && have sudo; then SUDO="sudo"; fi

if ! have ffmpeg || ! have ffprobe; then
  say "Installing ffmpeg"
  if have brew; then brew install ffmpeg
  elif have apt-get; then $SUDO apt-get update -qq && $SUDO apt-get install -y -qq ffmpeg
  elif have winget; then winget install -e --id Gyan.FFmpeg
  else echo "Please install ffmpeg first: https://ffmpeg.org/download.html"; exit 1; fi
fi
have node || { echo "Node.js 18 or newer is needed: https://nodejs.org"; exit 1; }
PY="$(command -v python3 || command -v python || true)"
[ -n "$PY" ] || { echo "Python 3.9 or newer is needed: https://www.python.org/downloads/"; exit 1; }

say "Fonts and browser driver"
npm install --no-audit --no-fund --loglevel=error

say "Speech and tracking tools"
[ -d .venv ] || "$PY" -m venv .venv
VPY=".venv/bin/python"; [ -x "$VPY" ] || VPY=".venv/Scripts/python.exe"
"$VPY" -m pip install -q --disable-pip-version-check -r requirements.txt

# Linux servers often lack the graphics library the tracker loads.
if [ "$(uname -s)" = "Linux" ] && have apt-get && ! ldconfig -p 2>/dev/null | grep -q 'libEGL.so.1'; then
  say "Graphics library for tracking"
  ($SUDO apt-get update -qq && $SUDO apt-get install -y -qq libegl1 libgles2) || echo "  (could not install libegl1; behind-the-head effects may not work until it is installed)"
fi

say "Browser for drawing the graphics"
if ! node -e "require('./src/layers').launchBrowser().then(b=>b.close()).catch(()=>process.exit(1))" 2>/dev/null; then
  npx --yes playwright-core install chromium
fi

if [ -z "${KKV_SKIP_MODELS:-}" ]; then
  say "Models (one-time download; skipped quietly if offline)"
  HF_HUB_DISABLE_XET=1 "$VPY" - <<'PY' || echo "  (models will download on first use instead)"
import os, sys
sys.path.insert(0, "py")
import track
for name in track.MODELS:
    track.model_path(name)
try:
    from faster_whisper import WhisperModel
    WhisperModel(os.environ.get("KKV_WHISPER_MODEL", "small"), device="cpu", compute_type="int8")
    print("  speech model ready")
except Exception as e:
    print("  speech model not downloaded yet:", str(e).splitlines()[0][:120])
PY
fi

echo
node bin/kkv doctor
