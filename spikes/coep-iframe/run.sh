#!/usr/bin/env bash
# Drives every isolation case through headless Chromium and prints a verdict table.
# On macOS point CHROME at your real Chrome:
#   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ./run.sh
set -euo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}"
APP_PORT="${APP_PORT:-8801}"

node server.mjs &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
until curl -sf --noproxy '*' "http://127.0.0.1:$APP_PORT/results.json" >/dev/null 2>&1; do sleep 0.2; done

PROFILE="$(mktemp -d)"
for CASE in control-no-isolation coep-require-corp coep-credentialless coep-credentialless-attr document-isolation-policy; do
  "$CHROME" --headless --no-sandbox --disable-gpu \
    --user-data-dir="$PROFILE/$CASE" \
    --no-proxy-server \
    --timeout=8000 --virtual-time-budget=6000 --dump-dom \
    "http://127.0.0.1:$APP_PORT/$CASE.html" >/dev/null 2>&1 || true
done

curl -sf --noproxy '*' "http://127.0.0.1:$APP_PORT/results.json" > results.json
node report.mjs results.json
