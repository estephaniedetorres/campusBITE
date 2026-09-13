CampusBITE Phone Server — Offline Package (no pkg install needed)
==============================================================
Requirement: Phone IS the server via Hotspot at http://192.168.43.1:3000

This folder bypasses Termux "none of mirrors accessible" / "pkg upgrade stuck" — no pkg install needed.

Contents:
- node-v22.23.1-linux-arm64.tar.xz  → Node 22 for Termux ARM64 (bypass pkg)
- server-core-dist/  → built server (Express + SQLite + WS)
- web-client-dist/   → built SPA (Kiosk/POS/KDS/Admin)
- phone-server.sh    → old script (ignore, use steps below)

One-time setup on Samsung (Termux from F-Droid):
-------------------------------------------------
1. Install Termux ONLY from F-Droid (https://f-droid.org/en/packages/com.termux/) — Play Store version is broken.

2. Copy this phone-package folder to phone:
   - PC: copy phone-package via USB to Internal storage/CampusBITE-phone
   - Or: git pull already has it if you pushed

3. In Termux:
   cd /storage/emulated/0/CampusBITE-phone
   # OR if via git: cd ~/CampusBITE

   # Extract Node without pkg:
   tar -xf node-v22.23.1-linux-arm64.tar.xz
   export PATH=$HOME/CampusBITE/phone-package/node-v22.23.1-linux-arm64/bin:$PATH
   # OR if in phone-package:
   # tar -xf node-v22.23.1-linux-arm64.tar.xz
   # export PATH=$(pwd)/node-v22.23.1-linux-arm64/bin:$PATH

   node -v  # must show v22.23.1

   # Run server offline (no npm install, no build):
   mkdir -p /data/data/com.termux/files/usr/tmp/campusbite
   # Point server to our prebuilt dist:
   # Option A: run directly from phone-package:
   node phone-package/server-core-dist/server.js
   # Option B: copy dist to expected location:
   # mkdir -p /data/data/com.termux/files/home/CampusBITE/packages/server-core/dist
   # cp -r phone-package/server-core-dist/* /data/data/com.termux/files/home/CampusBITE/packages/server-core/dist/

4. Turn ON Hotspot BEFORE starting server (Samsung: Settings → Connections → Mobile Hotspot → ON, Band 2.4GHz).
   Then: node phone-package/server-core-dist/server.js
   Must show: Hotspot (try even if not listed): http://192.168.43.1:3000

5. Keep Termux OPEN (swipe away kills server). Use termux-wake-lock if needed.

Clients:
  Other phones → WiFi → join phone hotspot (No internet → Keep) → browser:
  http://192.168.43.1:3000/kiosk?stall=stall-001   (customers, only public)
  http://192.168.43.1:3000/login → admin/admin123 → POS/KDS/Admin (staff, 403 if wrong stall)

If still "nothing show" / "stuck trying 192.168.43.1":
  - Samsung hotspot AP isolation ON → Settings → Mobile Hotspot → Configure → Advanced → AP isolation OFF
  - Try client: http://192.168.43.1:3000/api/health → must be {"ok":true,"hotspotIp":"192.168.43.1"}
  - Try Termux new session: curl http://192.168.43.1:3000/api/health
  - If Termux curl hangs but localhost works, hotspot not sharing → Hotspot OFF → ON → start node again

This package needs NO pkg, NO npm install, NO load for hotspot (offline). pkg install only needed once with internet to get this package via git.
