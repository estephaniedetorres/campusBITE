# CampusBITE Mobile — Expo Go (UI) + Phone Server (Termux)

This package is the **Expo** wrapper for CampusBITE. It runs in **Expo Go** for quick UI testing, and as a **Dev Build/APK** for the final Foreground Service + embedded Node.

## Structure

```
packages/mobile-server
├── app.json              # Expo config (name, slug, package com.campusbite.app, expo-router)
├── app/
│   ├── _layout.tsx       # Stack + StatusBar
│   └── index.tsx         # Server Status + QR + Quick Open (Kiosk/POS/KDS/Admin)
├── constants/api.ts      # API base (default http://192.168.43.1:3000 hotspot)
├── assets/               # icon.png / splash.png (1x1 placeholders — replace)
├── babel.config.js       # babel-preset-expo + expo-router
└── metro.config.js
```

## What it does

1. **Expo Go UI (current, no build):**
   - Fetches `/api/health` and `/api/stalls` from phone server at `http://192.168.43.1:3000` (or dev PC `http://192.168.1.104:3000`).
   - Shows server Online/Offline, IPs, port, WS URL.
   - Generates stall QR `http://<hotspot-ip>:3000/kiosk?stall=stall-001` (customers scan → Kiosk filtered). Kiosk is **only public** page.
   - Tiles to open Kiosk/POS/KDS/Admin in system browser via `Linking.openURL`. POS/KDS/Admin require login (`admin/admin123`) — server enforces 403 otherwise.

2. **Phone as Server (still Termux):**
   - Expo Go **cannot** run embedded Node — that needs `nodejs-mobile-react-native` + Dev Build.
   - Node server still runs in **Termux** on same phone: `bash scripts/phone-server.sh` → `node dist/server.js` at `192.168.43.1:3000`.
   - Expo Go and Termux both run on same phone, share `192.168.43.1`.

3. **Foreground Service + Embedded Node (final APK, not Expo Go):**
   - Requires `npx expo prebuild` + `nodejs-mobile-react-native` + `ServerForegroundService.java` with `FOREGROUND_SERVICE` + `WAKE_LOCK`.
   - Build: `npx expo run:android` or `cd android && ./gradlew assembleRelease`.

## Quick Start — Expo Go

```bash
# On PC (same repo, after git clone):
npm install --workspace=mobile-server
npx --workspace=mobile-server expo start
# → Terminal shows QR: exp://192.168.1.104:8081

# On Android phone: Install Expo Go from Play Store → Open → Scan QR → CampusBITE App opens
# In app: set Server URL to http://192.168.43.1:3000 (hotspot) or dev PC IP, tap Refresh Health
```

## Phone Server + Expo Go together (hotspot)

```bash
# Phone Termux: start Node server (keep Termux open + Hotspot ON)
bash scripts/phone-server.sh
# Phone Expo Go: scan PC's exp:// QR (PC and phone on same WiFi/hotspot) → App shows health Online
# Other phones: join phone hotspot → browser http://192.168.43.1:3000/kiosk?stall=stall-001 or scan QR from Expo app
```

## Build APK (later)

```bash
npx expo prebuild
# add nodejs-mobile-react-native, configure AndroidManifest.xml per docs/phone-server.sh
npx expo run:android
# or: cd android && ./gradlew assembleRelease → app-release.apk
```

See root README for Termux phone-server and API docs.
