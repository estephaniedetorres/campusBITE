# CampusBITE — Offline-first Canteen Ordering

A phone's Wi-Fi hotspot is the network; a PC on that hotspot runs one Expo server (`:8081`) that serves the app **and** its API (SQLite). No internet needed.

- **Students** scan a stall's QR with the phone camera and order in the browser: `http://<PC-IP>:8081/kiosk?stall=stall-001`. Orders are tracked per device (no accounts).
- **Staff** (POS, Kitchen, Admin) use the same app in **Expo Go** on Android phones.

See [DEMO.md](DEMO.md) for the demo-day runbook.

## Layout

```
packages/mobile-server
├── app/                 # Expo Router screens: index (landing), kiosk, orders, login, pos, kds, admin
│   └── api/             # Expo API routes → lib/server/router.ts
├── lib/
│   ├── server/          # router (per-route permissions), password (scrypt), sessions, login throttle
│   ├── database.ts      # SQLite (node:sqlite / better-sqlite3), migrations, auto-seed
│   ├── seed.ts          # demo stalls, menu, BOM, staff
│   └── bomEngine.ts     # atomic stock deduction / rollback
├── assets/stock/        # bundled offline photos, served at /api/images/*
├── data/                # campusbite.db + uploads/ (git-ignored)
├── scripts/             # seed.ts, reset-admin.ts
└── tests/               # Vitest API tests
```

## Commands (from the repo root)

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (once, with internet) |
| `npm run demo` | Start the Expo server for the hotspot (`expo start --lan --offline`) |
| `npm run seed` | Create or refresh demo data (keeps changed passwords) |
| `npm run reset-admin` | Print a one-time password for `admin` (or `npm run reset-admin -- <username>`) |
| `npm test` | Run the API test suite |

Requires Node 22.5+ (built-in `node:sqlite`).

## Security model

- **Passwords:** scrypt hashes (`node:crypto`, per-user salt), minimum 8 characters. Old plain-text PINs are hashed automatically on first start.
- **Sessions:** random 32-byte bearer tokens (`Authorization: Bearer …`), stored server-side as SHA-256 hashes, 12-hour expiry, revoked on logout, password change and admin reset.
- **Login throttling:** growing delay per username after failed attempts (1s, 2s, 4s … 30s). No lockout.
- **Permissions:** every API route is declared `public`, `staff` (stall owners limited to their own stall) or `admin` in `lib/server/router.ts`; `tests/permissions.test.ts` checks every route.
- **Forgot password:** an admin resets a stall owner in Admin → Users (one-time password, must be changed at next login). A locked-out admin runs `npm run reset-admin` on the server PC.
- **Customer tracking:** by unguessable order UUID only, never by pickup code.
- **Uploads:** JPEG/PNG/WebP up to 2 MB, verified by file contents, saved under `data/uploads/`.

## Before production

- [ ] Remove the demo logins (`admin`, `potato`, `matees`) from `lib/seed.ts` and this repo's docs, and set real passwords.
- [ ] Serve over HTTPS using a local certificate authority installed on staff devices. Until then, run only on a WPA2-protected hotspot with a strong password: traffic is plain HTTP.
- [ ] Upgrade from Expo SDK 52 to the current SDK so staff can use the store version of Expo Go on any phone (including iPhones).
- [ ] Decide on backups for `data/campusbite.db` and `data/uploads/`.
