#!/data/data/com.termux/files/usr/bin/bash
# CampusBITE Phone as Server — one-tap Termux launcher
# Runs Node + Express + SQLite on Android phone, serves via Hotspot at http://192.168.43.1:3000
# Handles: stuck pkg upgrade, Node version check, better-sqlite3 fallback

set -e
echo "=== CampusBITE Phone Server ==="

# 1. Fix stuck pkg upgrade — only update index, skip full upgrade if it hangs
echo "[1/5] Updating package index (skip full upgrade if stuck)..."
pkg update -y || { echo "Try: termux-change-repo → pick another mirror"; exit 1; }

# 2. Install Node (need >=22.5 for built-in node:sqlite)
if ! command -v node >/dev/null 2>&1; then
  echo "[2/5] Installing Node.js..."
  pkg install nodejs -y || pkg install nodejs-lts -y
fi
echo "Node: $(node -v)  npm: $(npm -v)"

# Check Node version for node:sqlite support (need 22.5+)
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
NODE_MINOR=$(node -p "process.versions.node.split('.')[1]")
echo "Node $NODE_MAJOR.$NODE_MINOR"
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 5 ]; }; then
  echo "Node <22.5 → node:sqlite missing. Installing better-sqlite3 fallback..."
  pkg install python clang make -y
  npm install better-sqlite3 || echo "better-sqlite3 build failed — will try sql.js fallback"
fi

# 3. Install deps and build (if not already built)
if [ ! -f "packages/server-core/dist/server.js" ]; then
  echo "[3/5] Installing dependencies..."
  npm install
  echo "Building web client..."
  npm run build --workspace=web-client
  echo "Building server..."
  npm run build --workspace=server-core
fi

# 4. Seed DB if empty
if [ ! -f "packages/server-core/data/campusbite.db" ]; then
  echo "[4/5] Seeding database (admin/admin123, grill/grill123, brew/brew123)..."
  npx tsx packages/server-core/src/db/seed.ts
fi

# 5. Start server — keep Termux foreground!
echo "[5/5] Starting CampusBITE — KEEP TERMUX OPEN!"
echo "→ Turn ON phone Hotspot NOW (Settings → Portable Hotspot)"
echo "→ Server will listen on 0.0.0.0:3000 → Hotspot IP is usually 192.168.43.1"
echo "→ Customers scan QR: http://192.168.43.1:3000/kiosk?stall=stall-001"
echo "→ Staff login: http://192.168.43.1:3000/login (admin/admin123)"
echo ""
node packages/server-core/dist/server.js
