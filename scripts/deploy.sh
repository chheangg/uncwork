#!/usr/bin/env bash
# Boot the whole stack (backend + ngrok + frontend) for a public demo.
# Two ngrok tunnels: api -> backend :3000, web -> frontend :5173.
# Cleanup on exit / Ctrl+C.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
NGROK_CONFIG="$ROOT/scripts/.ngrok.yml"
LOG_DIR="$ROOT/scripts/logs"
mkdir -p "$LOG_DIR"

red()   { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
cyan()  { printf "\033[36m%s\033[0m\n" "$*"; }
dim()   { printf "\033[2m%s\033[0m\n" "$*"; }

require() {
  command -v "$1" >/dev/null 2>&1 || { red "missing dep: $1"; exit 1; }
}
require cargo
require pnpm
require ngrok
require jq
require curl

PIDS=()
cleanup() {
  echo
  cyan "stopping..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  pkill -f "target/release/listener" 2>/dev/null || true
  pkill -f "target/release/sender" 2>/dev/null || true
  pkill -f "ngrok start" 2>/dev/null || true
  pkill -f "vite " 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cyan "freeing ports 3000 / 9999 / 5173 / 4040"
for port in 3000 9999 5173 4040; do
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
done

[ -f "$FRONTEND/.env" ] || {
  red "frontend/.env not found; copy from .env.example and set VITE_MAPBOX_TOKEN"
  exit 1
}

green "[1/5] building backend..."
( cd "$BACKEND" && cargo build --release --bins ) > "$LOG_DIR/cargo.log" 2>&1 || {
  red "cargo build failed; see $LOG_DIR/cargo.log"
  tail -30 "$LOG_DIR/cargo.log"
  exit 1
}

green "[2/5] starting listener (ws :3000, udp :9999)..."
"$BACKEND/target/release/listener" > "$LOG_DIR/listener.log" 2>&1 &
PIDS+=($!)
for i in {1..40}; do
  grep -q "HTTP/WS server" "$LOG_DIR/listener.log" 2>/dev/null && break
  sleep 0.25
done
grep -q "HTTP/WS server" "$LOG_DIR/listener.log" || {
  red "listener did not come up; see $LOG_DIR/listener.log"
  exit 1
}

green "[3/5] starting sender (opensky -> cot xml)..."
"$BACKEND/target/release/sender" > "$LOG_DIR/sender.log" 2>&1 &
PIDS+=($!)

green "[4/5] starting ngrok tunnels..."
NGROK_DEFAULT="$HOME/Library/Application Support/ngrok/ngrok.yml"
[ -f "$NGROK_DEFAULT" ] || {
  red "ngrok authtoken not configured."
  red "run:  ngrok config add-authtoken <your-token>"
  exit 1
}

cat > "$NGROK_CONFIG" <<EOF
version: "2"
tunnels:
  api:
    proto: http
    addr: 3000
  web:
    proto: http
    addr: 5173
EOF

ngrok start --all \
  --config "$NGROK_DEFAULT" \
  --config "$NGROK_CONFIG" \
  --log stdout > "$LOG_DIR/ngrok.log" 2>&1 &
PIDS+=($!)

dim "    waiting for ngrok api..."
for i in {1..40}; do
  curl -sf http://localhost:4040/api/tunnels >/dev/null 2>&1 && break
  sleep 0.5
done
curl -sf http://localhost:4040/api/tunnels >/dev/null 2>&1 || {
  red "ngrok did not come up; see $LOG_DIR/ngrok.log"
  tail -30 "$LOG_DIR/ngrok.log"
  exit 1
}

API_URL=""
WEB_URL=""
for i in {1..30}; do
  TUNNELS=$(curl -s http://localhost:4040/api/tunnels)
  API_URL=$(echo "$TUNNELS" | jq -r '.tunnels[] | select(.name=="api") | .public_url' | grep '^https' | head -1)
  WEB_URL=$(echo "$TUNNELS" | jq -r '.tunnels[] | select(.name=="web") | .public_url' | grep '^https' | head -1)
  [ -n "$API_URL" ] && [ -n "$WEB_URL" ] && break
  sleep 0.5
done

[ -n "$API_URL" ] && [ -n "$WEB_URL" ] || {
  red "tunnels did not register URLs in time"
  curl -s http://localhost:4040/api/tunnels | jq .
  exit 1
}

API_HOST=${API_URL#https://}
WEB_HOST=${WEB_URL#https://}

green "[5/5] starting frontend (vite)..."
cyan ""
cyan "  api  $API_URL"
cyan "  web  $WEB_URL"
cyan ""
dim  "  logs:        $LOG_DIR/{listener,sender,ngrok,cargo}.log"
dim  "  ngrok ui:    http://localhost:4040"
dim  "  /ws probe:   wscat -c $API_URL/ws"
cyan "  ctrl+c to stop everything"
cyan ""

cd "$FRONTEND"
VITE_API_HOST="$API_HOST" VITE_HMR_HOST="$WEB_HOST" pnpm dev
