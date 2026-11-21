#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables if .env exists
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

BACKEND_PORT="${PORT:-3001}"
FRONTEND_PORT="5173"
ODB_URL="${OPENDARTBOARD_WS_URL:-ws://localhost:13520}"

cleanup() {
  echo ""
  echo "[start] Shutting down Smart Darts MVP services..."
  if [ -n "${BACKEND_PID:-}" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "${FRONTEND_PID:-}" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  echo "[start] Stopped cleanly."
}

trap cleanup EXIT INT TERM

echo "========================================================"
echo "  Smart Darts MVP (Calibration & Score Tester)"
echo "========================================================"
echo "  Backend API & Socket.IO : http://localhost:${BACKEND_PORT}"
echo "  OpenDartboard Target    : ${ODB_URL}"
echo "  TV Browser Display URL  : http://localhost:${FRONTEND_PORT}"
echo "========================================================"

cd "$ROOT_DIR/backend"
npm start &
BACKEND_PID=$!

cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo ">>> Open http://localhost:${FRONTEND_PORT} on your TV browser <<<"
echo "Press Ctrl+C to stop both servers."
echo ""

wait
