# CampusBITE — Offline-first Canteen OS

> Your Android phone **is** the server. Wi-Fi Hotspot → Node.js + SQLite + WebSockets → any browser connects to `http://<hotspot-ip>:3000`. No internet required.

## Monorepo Structure

```
CampusBITE/
├── packages/server-core   # Express + SQLite (WAL) + WebSocket gateway + BOM atomic engine
├── packages/web-client    # React + Vite + Tailwind SPA (Kiosk / POS / KDS / Admin) - bundled & served by phone
└── packages/mobile-server # React Native wrapper (Foreground Service + WakeLock + Node Mobile bridge) [placeholder scaffold]
```

## How It Works (Learn This)

### 1. Phone as Server (Hotspot)
- Turn on **Portable Wi-Fi Hotspot** on the Android host phone (Settings → Hotspot).
- That phone runs `node packages/server-core/dist/server.js` — Express listens on `0.0.0.0:3000`, so any device on the same hotspot LAN can reach it via the hotspot gateway IP (typically `192.168.43.1`).
- Clients need **nothing installed** — just a browser and `http://192.168.43.1:3000`.

### 2. Foreground Service + WakeLock (Why not just a normal app?)
- Android Doze kills background tasks when screen off. 
- **Foreground Service** shows ongoing notification (`CampusBITE Active`) — Android treats it as user-visible, won't kill.
- **Partial WakeLock** keeps CPU awake so SQLite/WS still process orders with screen locked.

### 3. Atomic BOM Deductions (SQLite TRANSACTION)
- `recipe_bom` maps each menu item → ingredients (e.g., Classic Burger → 1 bun, 1 patty, 20g sauce).
- When order goes `PENDING_PAYMENT → CONFIRMED`, we run:
  ```sql
  BEGIN TRANSACTION;
  -- sum all needs per ingredient, check stock, then
  UPDATE ingredients SET current_stock = current_stock - :need WHERE id=:ing;
  INSERT INTO stock_logs ... 'BOM_DEDUCTION';
  COMMIT; -- or ROLLBACK if any ingredient insufficient
  ```
- On `CANCELLED` after deduction, the same quantities are **rolled back** (`current_stock + need`).

### 4. Real-time WebSockets (Rooms)
- Single WS endpoint `/ws`. Client sends `{type:'JOIN', room:'kds'}` or `{type:'JOIN_ORDER', orderId}`.
- Server broadcasts `ORDER_CREATED` and `ORDER_STATUS_UPDATED` to rooms `kds`, `pos`, `admin`, and `order:<id>`.
- KDS chimes via Web Audio API when a new ticket arrives.

### 5. SPA Bundling
- `web-client` builds to `dist/` (static HTML/JS/CSS). `server-core` serves it via `express.static`.
- So the phone serves **both API and UI** from one process.

## Quick Start (Development on Windows)

```bash
# 1. Install deps (root + workspaces)
npm install

# 2. Seed database (creates data/campusbite.db with stalls, menu, ingredients, BOM)
npm run seed --workspace=server-core

# 3. Run server (Express + WS + SQLite) -> http://localhost:3000
npm run dev --workspace=server-core

# 4. In another terminal, run SPA dev (Vite) -> http://localhost:5173 (proxies /api to 3000)
npm run dev --workspace=web-client

# 5. Build SPA for phone bundling
npm run build --workspace=web-client
# Now server-core also serves the SPA at http://localhost:3000/
```

## Running on Android Phone as Server (REQUIRED — phone is the server via Hotspot, Termux)

> **Requirement: Phone as Server** — the Android phone runs Node + SQLite and serves all clients via its Wi-Fi Hotspot at `http://192.168.43.1:3000`. No internet, no PC server.

**One-tap script (handles stuck `pkg upgrade`, Node version, better-sqlite3 fallback):**
```bash
# In Termux (install Termux ONLY from F-Droid, not Play Store):
git clone https://github.com/estephaniedetorres/campusBITE.git
cd campusBITE
bash scripts/phone-server.sh
# Script does: pkg update → install nodejs → check Node >=22.5 → npm install → build → seed → node dist/server.js
# KEEP TERMUX OPEN + Hotspot ON — server dies if Termux is swiped away
```

**Manual steps if script hangs:**
1. **Stuck at 3% on `pkg upgrade`?** Press `Ctrl+C`, then skip upgrade:
   ```bash
   pkg update -y
   pkg install nodejs -y   # NOT pkg upgrade -y
   # if still stuck: termux-change-repo → pick another mirror → pkg update -y
   ```
2. **Check Node:**
   ```bash
   node -v  # need v22.5+ for built-in node:sqlite
   # If v20.x → fallback compile:
   pkg install python clang make -y
   npm install better-sqlite3
   ```
3. **Build & run:**
   ```bash
   npm install
   npm run build --workspace=web-client
   npm run build --workspace=server-core
   node packages/server-core/dist/server.js
   # must show: Network: http://192.168.43.1:3000  Health: http://localhost:3000/api/health
   ```
4. **Turn on phone Hotspot** (Settings → Portable Hotspot) **before** starting server or right after — keep it ON.
5. **Clients:** Other phones/laptops → WiFi → join **phone's hotspot** → browser → `http://192.168.43.1:3000` → Kiosk is **only public** page (`/kiosk?stall=stall-001` via QR). Staff pages `/pos`, `/kds`, `/admin` require login (`admin/admin123`, `grill/grill123`, `brew/brew123`) — server enforces `403` if stall owner tries other stall.

## Running as APK (later, needs Android Studio + JDK 17)

See `packages/mobile-server/README.md` for Foreground Service setup and `./gradlew assembleRelease`.

## Testing the Flow

1. `/kiosk` — select Campus Grill, add Double Cheeseburger ×2, Checkout → note code e.g., `A3X9`
2. `/pos` — enter `A3X9`, confirm cash (triggers BOM deduction, check `/admin` stock decreased)
3. `/kds` — watch Kanban: New → Preparing → Ready
4. `/admin` → Ingredients: try Stock-In, Wastage, and EOD Audit (variance = physical − system)

## API Endpoints

- `GET /api/health` — IPs, uptime, WS URL
- `GET /api/stalls`, `GET /api/menu?stallId=...`, `GET /api/categories?stallId=...`
- `POST /api/orders` `{stallId, items:[{menuItemId, quantity}]}` → 201 with `pickup_code`
- `GET /api/orders/by-code/:code`, `PATCH /api/orders/:id/status` `{status}`
- `GET /api/inventory`, `POST /api/inventory/:id/stock-in` `{quantity}`, `GET /api/recipe-bom`
- `POST /api/audits/bulk` `{auditDate, entries:[{ingredientId, physicalActualStock}]}`
- `WS /ws` — send `{"type":"JOIN","room":"kds"}` then listen for `ORDER_CREATED` / `ORDER_STATUS_UPDATED`
