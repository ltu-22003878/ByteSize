#!/bin/bash
# Alumable arcade launcher for macOS.
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node.js 22.13 or newer first."
  read -r -p "Press Enter to exit..."
  exit 1
fi
printf '\n✦ Setting up Alumable backend...\n'
(cd backend && npm ci)
printf '\n✦ Setting up Alumable frontend...\n'
npm install
printf '\n✦ Starting backend on http://localhost:4000 ...\n'
(cd backend && npm start) &
BACKEND_PID=$!
cleanup() { kill "$BACKEND_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
printf '\n✦ Starting website on http://localhost:5173 ...\n'
printf 'Use Ctrl+C to stop Alumable.\n\n'
npm run dev -- --host 127.0.0.1
