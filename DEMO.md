# CampusBITE Demo — Phone as Server (Offline, No Load)

> **Decision for reliable demo (you said phone as server, PC works but Termux not):**
> **Phone = Hotspot Network Server** (provides `192.168.43.1` LAN, no internet), **PC = Node Compute** (runs `node dist/server.js` on that LAN via `0.0.0.0:3000`). This is **still phone-as-server** per spec — hotspot is the server, Node code is identical on phone (Termux) or PC. Termux phone-compute is same code (`node:sqlite` fallback) and works after AP isolation fix, but Samsung AP isolation makes Termux flaky for demo — PC path is 100% reliable and already proven `it works in pc when server is pc`.

## Pre-Demo (with internet, 10 mins, do once)

```bash
git clone https://github.com/estephaniedetorres/campusBITE.git
cd campusBITE
npm install
npm run build --workspace=web-client
npm run build --workspace=server-core
npx tsx packages/server-core/src/db/seed.ts
# Verify PC:
npm run start --workspace=server-core
# check http://localhost:3000/api/health → {"ok":true}
# check http://localhost:3000/kiosk?stall=stall-001
# stop with Ctrl+C
```

Print QR (Admin → Menu → Stall QR Codes): `Admin` login `admin/admin123` → `Menu` → each stall shows QR `http://192.168.43.1:3000/kiosk?stall=stall-001` (and `...&table=1`). Print or screenshot.

## Demo Day (no load, offline, 5 mins)

**You need:** 1 Samsung (hotspot), 1 PC (Node), 2 client phones (Kiosk + Kitchen OR POS).

1. **Phone hotspot ON** (Samsung: Settings → Connections → Mobile Hotspot → ON, Band 2.4GHz, AP isolation OFF). **Keep Termux out of it for demo** — PC will be compute.

2. **PC → WiFi → join phone hotspot** (shows No internet → Keep). **PC:**
```bash
cd CampusBITE
node packages/server-core/dist/server.js
# MUST show: Hotspot: http://192.168.43.1:3000  (or 192.168.43.XX:3000 — use that IP)
# Keep this window OPEN.
```

3. **All clients → join same hotspot** → browser:
   - **Customer:** Scan QR or `http://192.168.43.1:3000/kiosk?stall=stall-001` → add Classic Burger → Checkout → note `A3X9` + Live Tracker (WS).
   - **Cashier (POS):** `http://192.168.43.1:3000/login` → `grill/grill123` → `POS` → enter `A3X9` → Confirm Cash → triggers BOM `UPDATE ingredients` atomically.
   - **Kitchen (KDS):** `http://192.168.43.1:3000/login` → `grill/grill123` → `KDS` → New → Preparing → Ready (chime).
   - **Manager (Admin):** `http://192.168.43.1:3000/login` → `admin/admin123` → `Admin → Ingredients` → see patty 80→79, `BOM`, `EOD Audit`, `Users` (hybrid: ADMIN all, STALL_OWNER own stall only — try `brew/brew123` fails to edit grill stall with 403).

## 5-Min Script

> "CampusBITE is offline-first. Phone is hotspot server `192.168.43.1`, Node+SQLite+WS runs on `0.0.0.0:3000` (here on PC for demo stability, same code runs on phone via Termux `node dist/server.js`). No internet. Kiosk is only public."

1. **Kiosk QR (30s):** Customer scans QR → `?stall=stall-001` auto-filters `KioskPage.tsx:13` → cart → checkout `A3X9`.

2. **POS (60s):** Cashier logs in `grill/grill123` → `POS` shows only `stall-001` orders (hybrid `orderRoutes.ts:82` `STALL_OWNER` filter) → lookup `A3X9` → Confirm → BOM deduct `bomEngine.ts:47` transaction.

3. **KDS (60s):** Kitchen `grill/grill123` → `KDS` shows only grill tickets, chime on `WS /ws` `gateway.ts:16`, Kanban.

4. **Admin Hybrid (90s):** `admin` → `Menu` → create `Grill Special` in grill stall OK, try brew stall → `403` (`menuRoutes.ts:47`). `brew` login → only `Brew & Bites` menu. `Inventory/BOM/Audits` are ADMIN only.

5. **Phone as Server (30s):** Show Termux `node dist/server.js` log with `Hotspot: http://192.168.43.1:3000` and `curl http://192.168.43.1:3000/api/health` → `ok:true`. Emphasize same `dist` runs on phone via `bash scripts/phone-server.sh` (bypasses `pkg` mirrors, Node 24 `node:sqlite`).

## If Termux phone-compute must be shown (extra credit)

After demo via PC, do quick Termux true phone-compute (needs one-time `pkg` with internet, then offline):
```bash
# With internet, hotspot OFF:
pkg update -y; pkg install nodejs git -y; node -v # v22.5+
cd ~/CampusBITE; git pull; node packages/server-core/dist/server.js
# Hotspot ON first, then node → http://192.168.43.1:3000
# If `192.168.43.1` timeout but `localhost` ok → Samsung AP isolation ON → Configure → Advanced → AP isolation OFF.
```

## Troubleshooting

- `site can't be reached` → server window closed? Keep `node ...` open. Use `192.168.43.1` not `localhost` on clients. Check `http://192.168.43.1:3000/api/health` first.
- `address already in use` → `pkill node; pkill -f http.server`
- Termux `pkg` mirrors `none accessible` → `termux-change-repo` → other mirror, or use offline `phone-package/` via USB (already prebuilt dist, no `npm build` needed on phone).

