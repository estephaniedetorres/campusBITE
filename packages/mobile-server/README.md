# CampusBITE Mobile Server (Android Host)

This package is the **React Native Android wrapper** that turns an Android phone into the CampusBITE server via Wi-Fi Hotspot.

## What it does (Learning)

1. **Foreground Service** (`android/app/src/main/java/com/campusbite/ServerForegroundService.java`):
   - Starts a sticky Android `Service` with a persistent notification: *"CampusBITE Server Active — 192.168.43.1:3000"*
   - Acquires a `PARTIAL_WAKE_LOCK` so Node.js keeps running when screen is off.
   - Returns `START_STICKY` so Android restarts it if killed.

2. **Node.js Mobile Bridge** (`src/bridge/nodeBridge.ts`):
   - Uses `nodejs-mobile-react-native` to spawn the `server-core` Express+SQLite engine inside the RN app.
   - Communicates via `rn-bridge` channel: lifecycle (pause/resume), IP broadcast, active connection count.

3. **Server Status UI** (`src/components/ServerStatus.tsx`):
   - Shows Hotspot IP, QR code (other phones scan to join), connected clients, uptime.
   - Toggle to start/stop foreground service.

## Quick setup (when you have Android Studio)

```bash
# inside packages/mobile-server
npx react-native init CampusBITE --skip-install  # already done
npm install
npm install nodejs-mobile-react-native react-native-network-info react-native-device-info react-native-qrcode-svg

# Then configure android/app/src/main/AndroidManifest.xml:
# <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
# <uses-permission android:name="android.permission.WAKE_LOCK" />
# <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
# <service android:name=".ServerForegroundService" android:foregroundServiceType="dataSync" />

# Build APK:
cd android && ./gradlew assembleRelease
# APK at android/app/build/outputs/apk/release/app-release.apk
# Install on phone: adb install app-release.apk OR copy APK and tap to install
```

## Alternative: Quick test without building APK (Termux)

On any Android phone:
1. Install Termux from F-Droid
2. `pkg install nodejs git`
3. Copy `packages/server-core` + `packages/web-client/dist` to phone
4. `node packages/server-core/dist/server.js`  and turn on Hotspot
5. Other devices browse to `http://192.168.43.1:3000`

## Current Status

This folder is a **placeholder scaffold** so the monorepo is complete. The working system right now runs as:
- `packages/server-core` (Express + SQLite + WS) + `packages/web-client` (SPA)
- On dev: `npm run dev:server` + `npm run dev:client`
- On phone (Termux or future APK): `node dist/server.js` serves the built SPA from `web-client/dist`.

See root README for wiring details.
