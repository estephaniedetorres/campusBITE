# CampusBITE Demo — Offline on a Phone Hotspot

**Setup:** the phone provides the Wi-Fi hotspot (no internet). The PC joins it and runs the Expo server on `:8081`, which serves both the app and the API. Students order in the browser; staff use Expo Go on Android.

**Pitch:** "CampusBITE is offline-first on a phone hotspot. One PC on the hotspot runs the app and its SQLite database; students just scan a QR."

## One-time prep (with internet)

1. On the PC:
   ```bash
   git clone https://github.com/estephaniedetorres/campusBITE.git
   cd campusBITE
   npm install
   npm run seed
   npm test            # should be all green
   ```
2. On each **Android** staff phone, install the Expo Go build that matches SDK 52 (the Play Store version only supports the latest SDK and won't open this project). Either connect the phone by USB with USB debugging on, run `npm run demo` while online and press `a` (Expo CLI installs the right Expo Go), or download the SDK 52 Expo Go APK from https://expo.dev/go.
3. Turn the hotspot on, set **WPA2** with a strong password, band 2.4 GHz, **AP isolation off**.

## Demo day

You need: 1 phone (hotspot), 1 PC (server), 1+ Android staff phones with Expo Go, 1+ student phones (any browser).

1. **Hotspot on.** PC joins it (Windows says "No internet", keep connected).
2. **PC:** from the repo root:
   ```bash
   npm run demo
   ```
   Note the LAN address it prints, e.g. `exp://192.168.43.23:8081` → the PC's IP is `192.168.43.23`. Keep this window open.
3. **Staff phones:** join the hotspot → open Expo Go → scan the QR code in the PC terminal → Log in.
4. **Stall QR codes:** Admin → Menu → QR Codes shows one QR per stall (`http://<PC-IP>:8081/kiosk?stall=stall-001`). Show or print them. The PC's IP can change between sessions, so regenerate the QRs on the day.
5. **Students:** join the hotspot → camera → scan the stall QR → order in the browser.

> **Demo logins** (remove before production — see README): `admin / admin123` (all stalls), `potato / potato123` (Potato Corner), `matees / matees123` (Matees). New accounts and reset passwords must be 8+ characters.

## 5-minute script

1. **Order (60s):** Student scans the Potato Corner QR → adds Cheese Fries → Checkout → gets a pickup code like `A3X9`. Tap **Orders** to show it's tracked on this device, with no account.
2. **Pay (60s):** Cashier (Expo Go) → `potato` → **POS** → enters `A3X9` → **Confirm cash**. Stock is deducted from the recipe BOM in one transaction.
3. **Cook (60s):** **Kitchen** shows the ticket within ~3s and chimes → Start cooking → Mark ready. The student's phone updates to "Ready for pickup".
4. **Permissions (60s):** As `potato`, the Matees menu can't be edited; Inventory, Audits and Users are admin-only. As `admin`, show **Users → Reset password**: a one-time password that must be changed at next login.
5. **Offline (30s):** Everything, including photos, is served from the PC; there's no internet on the hotspot.

## Troubleshooting

- **Staff phone can't load the app:** same hotspot? Open `http://<PC-IP>:8081/api/health` in its browser; expect `{"ok":true,...}`. If it times out, turn AP isolation off and allow Node.js through Windows Firewall for the network profile the hotspot uses (often "Public").
- **"Project is incompatible with this version of Expo Go":** install the SDK 52 Expo Go (prep step 2).
- **QR opens the wrong address:** the PC's IP changed; reopen Admin → QR Codes to regenerate.
- **"Too many attempts":** wrong passwords add a short wait (up to 30s). Wait and retry.
- **Admin forgot the password:** on the PC, `npm run reset-admin` prints a one-time password.
- **Port 8081 in use:** close the other Expo/Metro window, or `npx kill-port 8081`.
