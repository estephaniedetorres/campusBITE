# CampusBITE Demo — Offline on a Phone Hotspot

**Setup:** the phone provides the Wi-Fi hotspot (no internet). The PC joins it and runs CampusBITE on `:8081`, which serves both the app and the API. Students and staff open it in the phone browser (iPhone or Android).

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
2. Turn the hotspot on, set **WPA2** with a strong password, band 2.4 GHz, **AP isolation off**.

## Demo day

You need: 1 phone (hotspot), 1 PC (server), staff phones and student phones (any browser).

1. **Hotspot on.** PC joins it (Windows says "No internet", keep connected).
2. **PC:** from the repo root:
   ```bash
   npm run serve
   ```
   This builds the app once (about 1–2 minutes) and then serves the fast production version. Keep the window open.
   Find the PC's address: open `http://localhost:8081/api/health` on the PC; the `"ip"` value (e.g. `192.168.43.23`) is what phones use.
3. **Staff phones:** join the hotspot → open `http://<PC-IP>:8081/login` in the browser → log in. Add it to the home screen for quick access.
4. **Stall QR codes:** Admin → Menu → QR Codes shows one QR per stall (`http://<PC-IP>:8081/kiosk?stall=stall-001`). Show or print them. The PC's IP can change between sessions, so regenerate the QRs on the day.
5. **Students:** join the hotspot → camera → scan the stall QR → order in the browser.

> **Demo logins** (remove before production — see README): `admin / admin123` (all stalls), `potato / potato123` (Potato Corner), `matees / matees123` (Matees). New accounts and reset passwords must be 8+ characters.

After changing any code, stop the server (Ctrl+C) and run `npm run serve` again so the build is refreshed.

### Optional: staff in Expo Go (Android)

`npm run demo` runs the development server instead, which Expo Go needs. It's much slower to load in browsers (pages are built on first visit, 30–60s each), so use either `serve` or `demo`, not both on the same port. Expo Go must be the SDK 52 build: connect the phone by USB, run `npm run demo` while online and press `a`, or get the APK from https://expo.dev/go.

## 5-minute script

1. **Order (60s):** Student scans the Potato Corner QR → adds Cheese Fries → Checkout → gets a pickup code like `A3X9`. Tap **Orders** to show it's tracked on this device, with no account.
2. **Pay (60s):** Cashier logs in as `potato` → **POS** → enters `A3X9` → **Confirm cash**. Stock is deducted from the recipe BOM in one transaction.
3. **Cook (60s):** **Kitchen** shows the ticket within ~3s and chimes → Start cooking → Mark ready. The student's phone updates to "Ready for pickup".
4. **Monitoring & permissions (60s):** As `potato`, show **Admin → Ingredients / Recipe BOM / EOD Audits / Analytics**: only Potato Corner's stock and sales. The Matees menu can't be edited and Users is admin-only. As `admin`, show all stalls and **Users → Reset password**.
5. **Offline (30s):** Everything, including photos, is served from the PC; there's no internet on the hotspot.

## Troubleshooting

- **A phone can't open the page:** same hotspot? Open `http://<PC-IP>:8081/api/health` in its browser; expect `{"ok":true,...}`. If it times out, turn AP isolation off and allow Node.js through Windows Firewall for the network profile the hotspot uses (often "Public"). Type `http://`, not `https://`.
- **Pages load slowly:** you're probably on `npm run demo` (dev server). Use `npm run serve`.
- **`fetch failed` when starting Expo:** there's no internet; `serve` doesn't need it, and for `npx expo start` add `--offline`.
- **QR opens the wrong address:** the PC's IP changed; reopen Admin → QR Codes to regenerate.
- **"Too many attempts":** wrong passwords add a short wait (up to 30s). Wait and retry.
- **Admin forgot the password:** on the PC, `npm run reset-admin` prints a one-time password.
- **Port 8081 in use:** close the other Expo window, or `npx kill-port 8081`.
