#!/bin/bash
# Claude Shortform Video Editor: one-time setup (macOS; Linux supported via apt-get).
#
#   ./setup.sh           install everything that's missing, then check it all works
#   ./setup.sh --check   only check, change nothing
#
# Installs: Homebrew packages (ffmpeg, node, python), a private Python environment (.venv)
# with Whisper for transcription and yt-dlp for downloading reference videos, and Remotion for rendering (engine/node_modules).
# Safe to run again any time: it skips whatever is already there.

set -u
cd "$(dirname "$0")"
ROOT=$(pwd)
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
bad()  { printf "  \033[31m✗\033[0m %s\n" "$1"; FAILED=1; }
step() { printf "\n\033[1m%s\033[0m\n" "$1"; }
FAILED=0

step "1. Your computer"
OS=$(uname)
ARCH=$(uname -m)
if [ "$OS" = "Darwin" ]; then
  ok "macOS $(sw_vers -productVersion) ($ARCH)"
elif [ "$OS" = "Linux" ] && command -v apt-get >/dev/null 2>&1; then
  ok "Linux $(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-}") ($ARCH)"
else
  bad "This editor runs on macOS, or on Linux with apt-get."
  exit 1
fi

# Install a package with the platform's package manager
pkg_install() { # pkg_install <brew formula> <apt package>
  if [ "$OS" = "Darwin" ]; then
    brew install "$1" >/dev/null
  else
    SUDO=""; [ "$(id -u)" != 0 ] && SUDO="sudo"
    { $SUDO apt-get update -qq && DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y -qq "$2"; } >/dev/null
  fi
}

if [ "$OS" = "Darwin" ]; then
step "2. Homebrew"
if ! command -v brew >/dev/null 2>&1; then
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$b" ] && eval "$("$b" shellenv)"
  done
fi
if command -v brew >/dev/null 2>&1; then
  ok "Homebrew $(brew --version | head -1 | awk '{print $2}')"
else
  bad "Homebrew is not installed. It needs your Mac password, so run this one yourself in Terminal:"
  echo '      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  echo "    Then run ./setup.sh again."
  exit 1
fi
else
step "2. Package manager"
ok "apt-get"
fi

step "3. Tools (ffmpeg, Node, Python)"
need() { # need <command> <brew formula> <apt package>
  if command -v "$1" >/dev/null 2>&1; then
    ok "$1"
  elif [ $CHECK_ONLY = 1 ]; then
    bad "$1 is missing"
  else
    echo "  installing $2..."
    pkg_install "$2" "$3" && ok "$1 (installed)" || bad "could not install $2"
  fi
}
need ffmpeg ffmpeg ffmpeg
need ffprobe ffmpeg ffmpeg
need node node nodejs
need npm node npm

# Python 3.10+ for Whisper (the one built into macOS is too old)
PY=""
for c in python3.12 python3.11 python3.13 python3.10 python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
    PY=$(command -v "$c"); break
  fi
done
if [ -z "$PY" ] && [ $CHECK_ONLY = 0 ]; then
  echo "  installing python@3.12..."
  if [ "$OS" = "Darwin" ]; then
    brew install python@3.12 >/dev/null && PY="$(brew --prefix python@3.12)/bin/python3.12"
  else
    pkg_install python@3.12 "python3 python3-venv" && PY=$(command -v python3)
  fi
fi
[ -n "$PY" ] && ok "Python $("$PY" -c 'import platform; print(platform.python_version())')" || bad "Python 3.10+ is missing"

NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/')
if [ -n "$NODE_MAJOR" ] && [ "$NODE_MAJOR" -lt 18 ]; then
  bad "Node $NODE_MAJOR is too old (Remotion needs 18+). Upgrade Node (macOS: brew upgrade node)"
fi

step "4. Transcription (Whisper) + downloads (yt-dlp)"
if [ "$OS" = "Darwin" ] && [ "$ARCH" = "arm64" ]; then WPKG="mlx-whisper"; WMOD="mlx_whisper"; else WPKG="openai-whisper"; WMOD="whisper"; fi
if [ -x .venv/bin/python ] && .venv/bin/python -c "import $WMOD, numpy, yt_dlp" 2>/dev/null; then
  ok "$WPKG"
  # Instagram and TikTok change often and an old yt-dlp stops downloading them, so keep it current
  if [ $CHECK_ONLY = 0 ]; then .venv/bin/pip install -q --upgrade yt-dlp >/dev/null 2>&1; fi
  ok "yt-dlp $(.venv/bin/yt-dlp --version 2>/dev/null)"
elif [ $CHECK_ONLY = 1 ]; then
  bad "$WPKG or yt-dlp is not installed"
elif [ -n "$PY" ]; then
  echo "  creating .venv and installing $WPKG (a few minutes the first time)..."
  # On Linux, use CPU-only PyTorch (the default wheel pulls several GB of CUDA libraries)
  TORCH_CPU=true
  [ "$OS" = "Linux" ] && TORCH_CPU='.venv/bin/pip install -q --retries 1 torch --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 || echo "  (CPU-only PyTorch unavailable, using the standard build)"'
  "$PY" -m venv .venv && .venv/bin/pip install -q --upgrade pip && eval "$TORCH_CPU" && .venv/bin/pip install -q "$WPKG" numpy yt-dlp \
    && ok "$WPKG + yt-dlp (installed)" || bad "could not install $WPKG"
fi

step "5. Rendering (Remotion)"
if [ -d engine/node_modules/remotion ] && [ -d engine/node_modules/@remotion/renderer ]; then
  ok "Remotion $(node -p "require('./engine/node_modules/remotion/package.json').version" 2>/dev/null)"
elif [ $CHECK_ONLY = 1 ]; then
  bad "Remotion is not installed"
else
  echo "  installing Remotion (about a minute)..."
  (cd engine && npm install --no-audit --no-fund --loglevel=error) && ok "Remotion (installed)" || bad "npm install failed in engine/"
fi

if [ $CHECK_ONLY = 0 ] && [ $FAILED = 0 ]; then
  step "6. First-run downloads"
  echo "  fetching the Whisper speech model (about 1.5 GB, one time only)..."
  .venv/bin/python tools/asr.py --warmup && ok "Whisper model ready" || bad "could not download the Whisper model"
  echo "  fetching Remotion's rendering browser (one time only)..."
  (cd engine && npx --no-install remotion browser ensure >/dev/null 2>&1) && ok "render browser ready" || ok "render browser will download on the first render"
fi

echo
if [ $FAILED = 0 ]; then
  printf "\033[32mAll set.\033[0m Open Claude Code in this folder and type /get-video or /edit-video\n"
else
  printf "\033[31mSomething above needs fixing.\033[0m Paste this output to Claude and it will sort it out.\n"
  exit 1
fi
