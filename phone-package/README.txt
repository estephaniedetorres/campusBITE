CampusBITE Phone Server — Offline Package (NO glibc Node, use Termux pkg)
==============================================================
Requirement: Phone IS the server via Hotspot at http://192.168.43.1:3000
FIX: glibc Node tar (node-v22-linux-arm64 from nodejs.org) FAILS on Termux with "No such file" — Termux needs Bionic build via pkg, not glibc.

This folder now has ONLY prebuilt dist — NO Node tar. Use Termux pkg to get Node 22.

Contents:
- server-core-dist/  → built server (Express + SQLite + WS)
- web-client-dist/   → built SPA (Kiosk/POS/KDS/Admin)
- phone-server.sh    → helper (use Termux pkg method below)

One-time setup on Samsung (Termux from F-Droid ONLY):
-------------------------------------------------
1. Install Termux ONLY from F-Droid https://f-droid.org/en/packages/com.termux/ — Play Store version is broken and gives "cannot bind netlink" + "No such file".

2. Copy this phone-package folder to phone via USB, OR just git pull (dist now on GitHub, no build needed):
   PC already pushed: packages/server-core/dist + packages/web-client/dist are now in repo (f1d2c3e+).

3. In Termux (needs internet ONCE for pkg):
   pkg update -y
   pkg install nodejs git -y
   node -v  # must be v22.5+ (v22.23.1 or v24) — if v20.x, do: pkg install nodejs-lts -y
   node -e 'require("node:sqlite"); console.log("sqlite ok")'  # must print ok

   cd ~/CampusBITE
   git pull
   # NO npm install / build needed now (dist already in repo)
   # If you copied via USB: cp -r /storage/emulated/0/CampusBITE-phone/phone-package/server-core-dist/* packages/server-core/dist/

   # Verify dist exists:
   ls packages/server-core/dist/server.js
   ls packages/web-client/dist/index.html
   ls packages/server-core/dist/db/schema.sql

4. Turn ON Hotspot BEFORE starting server (Samsung: Settings → Connections → Mobile Hotspot → ON, Band 2.4GHz).
   Termux:
   node packages/server-core/dist/server.js
   # keep OPEN — must show Hotspot: http://192.168.43.1:3000
   # Hint now shows hotspotIp fallback even if 100.101.218.190 in log

5. Keep Termux OPEN (swipe away kills server). Use termux-wake-lock.

Clients:
  Other phones → WiFi → join phone hotspot (No internet → Keep) → browser:
  http://192.168.43.1:3000/kiosk?stall=stall-001
  http://192.168.43.1:3000/login → admin/admin123

If "cannot execute required file not found" on node dist/server.js:
  You ran glibc Node tar (wrong) or ran from wrong dir. Use pkg Node only: which node → must be /data/data/com.termux/files/usr/bin/node
  pwd → must be ~/CampusBITE, then node packages/server-core/dist/server.js

If still "nothing show" / "stuck trying 192.168.43.1":
  - Samsung hotspot AP isolation ON → Configure → Advanced → AP isolation OFF
  - Client try: http://192.168.43.1:3000/api/health → must be {"ok":true}
  - Termux new session: curl http://192.168.43.1:3000/api/health

If pkg mirrors "none accessible": Hotspot OFF, use mobile data/WiFi with internet for pkg, then turn hotspot ON to serve.
