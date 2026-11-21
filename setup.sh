#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================================"
echo "  Smart Darts MVP — Dependency & Environment Setup"
echo "========================================================"

# 1. Ensure .env exists
if [ ! -f "$ROOT_DIR/.env" ] && [ -f "$ROOT_DIR/.env.example" ]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  echo "[setup] Created .env from .env.example"
fi

# 2. Install Backend Dependencies
echo ""
echo "[setup] Installing backend dependencies (/backend)..."
cd "$ROOT_DIR/backend"
npm install

# 3. Install Frontend Dependencies
echo ""
echo "[setup] Installing frontend dependencies (/frontend)..."
cd "$ROOT_DIR/frontend"
npm install
if [ -f "node_modules/esbuild/install.js" ]; then
  node node_modules/esbuild/install.js || true
fi

echo ""
echo "========================================================"
echo "  Setup complete! Run ./start.sh to launch the app."
echo "========================================================"
