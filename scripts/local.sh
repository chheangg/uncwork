#!/usr/bin/env bash
# Boot the whole stack locally (no ngrok). Frontend talks to backend
# via localhost defaults. Cleanup on exit / Ctrl+C.
#
# Secrets:
#   backend/.env       (gitignored) — sourced before launching the
#                                     listener. Stuff like
#                                     GEMINI_API_KEY belongs here.
#   backend/.env.example                             — template, tracked.
#   frontend/.env      (gitignored) — VITE_MAPBOX_TOKEN etc. Vite
#                                     loads this directly; nothing to
#                                     do here besides existence-check.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
LOG_DIR="$ROOT/scripts/logs"
mkdir -p "$LOG_DIR"

red()   { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
cyan()  { printf "\033[36m%s\033[0m\n" "$*"; }
dim()   { printf "\033[2m%s\033[0m\n" "$*"; }

require() {
  command -v "$1" >/dev/null 2>&1 || { red "missing dep: $1"; exit 1; }
}
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
require cargo
require pnpm

# Source backend/.env if present so secrets like GEMINI_API_KEY land
# in this shell's environment and get inherited by the listener
# subprocess. `set -a` auto-exports anything assigned while it's on.
if [ -f "$BACKEND/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$BACKEND/.env"
  set +a
  dim "  loaded backend/.env"
else
  dim "  no backend/.env (cp backend/.env.example backend/.env to enable Gemini)"
fi

PIDS=()
cleanup() {
  echo
  cyan "stopping..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  pkill -f "target/release/listener" 2>/dev/null || true
  pkill -f "target/release/sender" 2>/dev/null || true
  pkill -f "vite " 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cyan "freeing ports 3000 / 9999 / 5173"
for port in 3000 9999 5173; do
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
done

[ -f "$FRONTEND/.env" ] || {
  red "frontend/.env not found; copy from .env.example and set VITE_MAPBOX_TOKEN"
  exit 1
}

green "[1/4] building backend..."
( cd "$BACKEND" && cargo build --release --bins ) > "$LOG_DIR/cargo.log" 2>&1 || {
  red "cargo build failed; see $LOG_DIR/cargo.log"
  tail -30 "$LOG_DIR/cargo.log"
  exit 1
}

green "[2/4] starting listener (ws :3000, udp :9999)..."
# FR-03 neighbor radius: 500m matches the Donetsk-tactical demo and
# threshold-defense.md spec (Q&A card 7). Override via NEIGHBOR_RADIUS_M
# in backend/.env or by exporting before invoking this script.
NEIGHBOR_RADIUS_M="${NEIGHBOR_RADIUS_M:-500}" \
GEMINI_API_KEY="${GEMINI_API_KEY:-}" \
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

if [ -n "${GEMINI_API_KEY:-}" ]; then
  dim "  Gemini: enabled (key length ${#GEMINI_API_KEY})"
else
  dim "  Gemini: disabled (set GEMINI_API_KEY in backend/.env to enable)"
fi

green "[3/4] starting sender (ndxml -> cot xml)..."
"$BACKEND/target/release/sender" > "$LOG_DIR/sender.log" 2>&1 &
PIDS+=($!)

green "[4/4] starting frontend (vite)..."
cyan ""
cyan "  web   http://localhost:5173"
cyan "  api   http://localhost:3000"
cyan "  ws    ws://localhost:3000/ws"
cyan ""
dim  "  logs:    $LOG_DIR/{listener,sender,cargo}.log"
dim  "  senders: curl -s localhost:3000/senders | jq"
cyan "  ctrl+c to stop everything"
cyan ""

cd "$FRONTEND"
pnpm dev
