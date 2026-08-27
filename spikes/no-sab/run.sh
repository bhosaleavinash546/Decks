#!/usr/bin/env bash
# Option 4 spike: derived playhead, transferred PCM, AnalyserNode meters, no SAB.
#
#   ./run.sh            # 10 minutes, the real answer
#   SEC=45 ./run.sh     # quick check
# On macOS point CHROME at your real Chrome:
#   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ./run.sh
#
# Never pass --virtual-time-budget: it warps the audio clock and every timing
# number becomes fiction.
set -euo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}"
PORT="${PORT:-8821}"
SEC="${SEC:-600}"

node server.mjs > run.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
until curl -sf --noproxy '*' "http://127.0.0.1:$PORT/" >/dev/null 2>&1; do sleep 0.2; done

echo "running ${SEC}s…"
timeout $((SEC + 90)) "$CHROME" --headless --no-sandbox --disable-gpu --no-proxy-server \
  --autoplay-policy=no-user-gesture-required --user-data-dir="$(mktemp -d)" \
  "http://127.0.0.1:$PORT/?sec=$SEC" >/dev/null 2>&1 || true

grep -o 'RESULT.*' run.log | tail -1 | sed 's/^RESULT //' > results.json
node report.mjs results.json
