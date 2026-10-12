// @ts-nocheck
// Expo full-stack DB — port of packages/server-core/src/db/database.ts for app/api
// Uses Node's built-in node:sqlite (Node >=22.5) or better-sqlite3 if available.
// Shares DB file with server-core at ../server-core/data/campusbite.db so seeded data persists.
// When running `npx expo start --web --host lan` at 8081, API routes import this file server-side.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// NOTE: no import.meta here — it forces Node to load the Metro API bundle as ESM,
// which breaks Metro's CJS prelude (require is not defined in ES module scope).
// Expo runs with cwd = packages/mobile-server, so resolve everything from process.cwd().
const __dirname = path.join(process.cwd(), 'lib');
const require = createRequire(path.join(process.cwd(), 'package.json'));

// Resolve DB file: prefer shared server-core DB so kiosk sees same stalls/menu as standalone 3000 server
const candidates = [
  process.env.DB_PATH,
  path.join(process.cwd(), 'packages/server-core/data/campusbite.db'),
  path.join(process.cwd(), '../server-core/data/campusbite.db'),
  path.join(__dirname, '../../..', 'packages/server-core/data/campusbite.db'),
  path.join(__dirname, '../..', 'packages/server-core/data/campusbite.db'),
  path.join(__dirname, '../../server-core/data/campusbite.db'),
  path.join(process.cwd(), 'data/campusbite.db'),
  path.join(__dirname, '../data/campusbite.db'),
].filter(Boolean) as string[];

let DB_PATH: string | null = null;
for (const p of candidates) {
  try {
    const dir = path.dirname(p);
    // if file exists or dir exists, use it
    if (fs.existsSync(p) || fs.existsSync(dir)) { DB_PATH = p; break; }
  } catch {}
}
if (!DB_PATH) {
  DB_PATH = path.join(__dirname, '../data/campusbite.db');
}
const DATA_DIR = path.dirname(DB_PATH!);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
DB_PATH = DB_PATH!;
console.log(`[ExpoDB] Using database at: ${DB_PATH} (cwd=${process.cwd()})`);

let rawDb: any;
let usingBetterSqlite3 = false;
let nodeVer = process.versions.node;

try {
  const BetterSqlite3 = require('better-sqlite3');
  rawDb = new BetterSqlite3(DB_PATH);
  usingBetterSqlite3 = true;
  console.log('[ExpoDB] Using better-sqlite3 (Node ' + nodeVer + ')');
} catch (e: any) {
  console.log('[ExpoDB] better-sqlite3 not available, trying node:sqlite. Reason:', e.message?.slice(0, 120));
  try {
    // @ts-ignore
    const { DatabaseSync } = require('node:sqlite');
    rawDb = new DatabaseSync(DB_PATH);
    console.log('[ExpoDB] Using node:sqlite (DatabaseSync) Node ' + nodeVer);
  } catch (e2: any) {
    console.error('[ExpoDB] FATAL: No SQLite engine available.');
    console.error('[ExpoDB] Your Node:', nodeVer);
    throw new Error(`No SQLite engine: Node ${nodeVer} has no node:sqlite and better-sqlite3 not installed. ${e2.message}`);
  }
}

if (!usingBetterSqlite3) {
  if (typeof rawDb.pragma !== 'function') {
    rawDb.pragma = (sql: string) => {
      try {
        if (sql.includes('=')) { rawDb.exec(`PRAGMA ${sql}`); return; }
        const stmt = rawDb.prepare(`PRAGMA ${sql}`);
        const row = stmt.get();
        return row ? Object.values(row)[0] : undefined;
      } catch { try { rawDb.exec(`PRAGMA ${sql}`); } catch {} }
    };
  }
  if (typeof rawDb.transaction !== 'function') {
    rawDb.transaction = (fn: (...args: any[]) => any) => {
      return (...args: any[]) => {
        rawDb.exec('BEGIN IMMEDIATE');
        try { const r = fn(...args); rawDb.exec('COMMIT'); return r; } catch (err) { try { rawDb.exec('ROLLBACK'); } catch {} throw err; }
      };
    };
  }
}

try { rawDb.pragma('journal_mode = WAL'); } catch {}
try { rawDb.pragma('foreign_keys = ON'); } catch {}
try { rawDb.pragma('busy_timeout = 5000'); } catch {}
try { rawDb.exec('PRAGMA journal_mode = WAL'); } catch {}
try { rawDb.exec('PRAGMA foreign_keys = ON'); } catch {}

const schemaCandidates = [
  path.join(__dirname, 'schema.sql'),
  path.join(__dirname, '../../lib/schema.sql'),
  path.join(__dirname, '../lib/schema.sql'),
  path.join(process.cwd(), 'packages/mobile-server/lib/schema.sql'),
  path.join(process.cwd(), 'lib/schema.sql'),
  path.join(process.cwd(), 'packages/server-core/src/db/schema.sql'),
];
let schemaPath: string | null = null;
let schema: string | null = null;
for (const p of schemaCandidates) {
  if (fs.existsSync(p)) { schemaPath = p; schema = fs.readFileSync(p, 'utf-8'); break; }
}
if (!schema) {
  console.error('[ExpoDB] schema.sql not found in candidates:', schemaCandidates);
  throw new Error('schema.sql not found. Ensure lib/schema.sql exists.');
}
rawDb.exec(schema);

// migrations (same as server-core)
try {
  const cols: any[] = rawDb.prepare(`PRAGMA table_info(menu_items)`).all();
  const hasImageUrl = cols.some((c: any) => c.name === 'image_url');
  if (!hasImageUrl) rawDb.exec(`ALTER TABLE menu_items ADD COLUMN image_url TEXT`);
  const hasRating = cols.some((c: any) => c.name === 'rating');
  if (!hasRating) { rawDb.exec(`ALTER TABLE menu_items ADD COLUMN rating REAL DEFAULT 4.9`); rawDb.exec(`ALTER TABLE menu_items ADD COLUMN rating_count INTEGER DEFAULT 56`); }
} catch {}
try {
  const cols: any[] = rawDb.prepare(`PRAGMA table_info(stalls)`).all();
  const hasLogo = cols.some((c: any) => c.name === 'logo_url');
  if (!hasLogo) rawDb.exec(`ALTER TABLE stalls ADD COLUMN logo_url TEXT`);
  const hasStallRating = cols.some((c: any) => c.name === 'rating');
  if (!hasStallRating) { rawDb.exec(`ALTER TABLE stalls ADD COLUMN rating REAL DEFAULT 4.8`); rawDb.exec(`ALTER TABLE stalls ADD COLUMN rating_count INTEGER DEFAULT 128`); }
} catch {}
try {
  const cols: any[] = rawDb.prepare(`PRAGMA table_info(order_items)`).all();
  const hasVariant = cols.some((c: any) => c.name === 'variant_id');
  if (!hasVariant) { rawDb.exec(`ALTER TABLE order_items ADD COLUMN variant_id TEXT`); rawDb.exec(`ALTER TABLE order_items ADD COLUMN variant_name TEXT`); }
} catch {}

// auto-seed if empty
try {
  const c = (rawDb.prepare(`SELECT count(*) as c FROM stalls`).get() as any).c;
  if (c === 0) {
    console.log('[ExpoDB] Empty stalls → auto-seeding minimal...');
    rawDb.prepare(`INSERT OR IGNORE INTO stalls (id, name, description) VALUES ('stall-001','Potato Corner','World Famous Flavored Fries · Loaded Fries')`).run();
    rawDb.prepare(`INSERT OR IGNORE INTO stalls (id, name, description) VALUES ('stall-002','Matees','Ice Cream · Sundaes · Milkshakes')`).run();
    rawDb.prepare(`INSERT OR IGNORE INTO categories (id, stall_id, name, display_order) VALUES ('cat-fries-classic','stall-001','Flavored Fries',1)`).run();
    rawDb.prepare(`INSERT OR IGNORE INTO categories (id, stall_id, name, display_order) VALUES ('cat-fries-loaded','stall-001','Loaded Fries',2)`).run();
    rawDb.prepare(`INSERT OR IGNORE INTO categories (id, stall_id, name, display_order) VALUES ('cat-ice-classic','stall-002','Classic Scoops',1)`).run();
    rawDb.prepare(`INSERT OR IGNORE INTO categories (id, stall_id, name, display_order) VALUES ('cat-ice-sundae','stall-002','Sundaes & Shakes',2)`).run();
    rawDb.prepare(`INSERT OR IGNORE INTO users (id, username, pin, role, stall_id, display_name) VALUES ('user-admin','admin','admin123','ADMIN',NULL,'Canteen Manager')`).run();
    rawDb.prepare(`INSERT OR IGNORE INTO users (id, username, pin, role, stall_id, display_name) VALUES ('user-potato','potato','potato123','STALL_OWNER','stall-001','Potato Corner Owner')`).run();
    rawDb.prepare(`INSERT OR IGNORE INTO users (id, username, pin, role, stall_id, display_name) VALUES ('user-matees','matees','matees123','STALL_OWNER','stall-002','Matees Owner')`).run();
    rawDb.prepare(`INSERT OR IGNORE INTO menu_items (id, stall_id, category_id, name, price, description, image_url) VALUES ('item-vanilla-scoop','stall-002','cat-ice-classic','Vanilla Scoop',45,'Single scoop Madagascar vanilla','https://images.unsplash.com/photo-1495147466023-a36482277724?w=500&auto=format&fit=crop&q=60')`).run();
    rawDb.prepare(`INSERT OR IGNORE INTO menu_items (id, stall_id, category_id, name, price, description, image_url) VALUES ('item-choco-scoop','stall-002','cat-ice-classic','Choco Scoop',49,'Belgian chocolate','https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500&auto=format&fit=crop&q=60')`).run();
    rawDb.prepare(`INSERT OR IGNORE INTO menu_items (id, stall_id, category_id, name, price, description, image_url) VALUES ('item-strawberry-sundae','stall-002','cat-ice-sundae','Strawberry Sundae',89,'2 scoops + strawberry sauce','https://images.unsplash.com/photo-1488900128323-21503983a07e?w=500&auto=format&fit=crop&q=60')`).run();
    rawDb.prepare(`INSERT OR IGNORE INTO menu_items (id, stall_id, category_id, name, price, description, image_url) VALUES ('item-plain-fries','stall-001','cat-fries-classic','Plain Fries',55,'Crispy classic fries 150g','https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500&auto=format&fit=crop&q=60')`).run();
    console.log('[ExpoDB] Minimal seed done');
  } else {
    console.log(`[ExpoDB] Stalls=${c}, users=${(rawDb.prepare(`SELECT count(*) as c FROM users`).get() as any).c}, menu=${(rawDb.prepare(`SELECT count(*) as c FROM menu_items`).get() as any).c}`);
    // If menu <6 but stalls exist, ensure full seed (variants etc.) — run full seed helpers inline
    const menuCount = (rawDb.prepare(`SELECT count(*) as c FROM menu_items`).get() as any).c;
    if (menuCount < 6) {
      console.log('[ExpoDB] Menu count low, ensuring full seed (variants)...');
      try {
        rawDb.prepare(`INSERT INTO categories (id, stall_id, name, display_order) VALUES ('cat-ice-classic','stall-002','Classic Scoops',1) ON CONFLICT(id) DO NOTHING`).run();
        rawDb.prepare(`INSERT INTO categories (id, stall_id, name, display_order) VALUES ('cat-ice-sundae','stall-002','Sundaes & Shakes',2) ON CONFLICT(id) DO NOTHING`).run();
        rawDb.prepare(`INSERT INTO categories (id, stall_id, name, display_order) VALUES ('cat-fries-classic','stall-001','Flavored Fries',1) ON CONFLICT(id) DO NOTHING`).run();
        rawDb.prepare(`INSERT INTO categories (id, stall_id, name, display_order) VALUES ('cat-fries-loaded','stall-001','Loaded Fries',2) ON CONFLICT(id) DO NOTHING`).run();
        rawDb.prepare(`UPDATE stalls SET logo_url=COALESCE(logo_url,'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=200&auto=format&fit=crop&q=60'), rating=COALESCE(rating,4.8) WHERE id='stall-001'`).run();
        rawDb.prepare(`UPDATE stalls SET logo_url=COALESCE(logo_url,'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=200&auto=format&fit=crop&q=60'), rating=COALESCE(rating,4.7) WHERE id='stall-002'`).run();
        // Missing menu items + ingredients + variants (mirror server-core seed)
        rawDb.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES ('ing-milk','Fresh Milk','ml',8000,1000,0.03)`).run();
        rawDb.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES ('ing-cream','Heavy Cream','ml',6000,800,0.08)`).run();
        rawDb.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES ('ing-sugar','Sugar','g',8000,1000,0.02)`).run();
        rawDb.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES ('ing-vanilla','Vanilla Syrup','ml',3000,400,0.12)`).run();
        rawDb.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES ('ing-chocolate-syrup','Chocolate Syrup','ml',3000,400,0.15)`).run();
        rawDb.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES ('ing-strawberry','Strawberry Sauce','ml',2500,300,0.14)`).run();
        rawDb.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES ('ing-potato','Potatoes','g',15000,2000,0.02)`).run();
        rawDb.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES ('ing-oil','Cooking Oil','ml',8000,1000,0.04)`).run();
        rawDb.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES ('ing-cheese-powder','Cheese Powder','g',3000,400,0.20)`).run();
        rawDb.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES ('ing-chili','Chili Cheese','g',2500,300,0.25)`).run();
        rawDb.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES ('ing-sourcream','Sour Cream Powder','g',2500,300,0.22)`).run();
        rawDb.prepare(`INSERT OR IGNORE INTO menu_items (id, stall_id, category_id, name, price, description, image_url, rating, rating_count) VALUES ('item-cheese-fries','stall-001','cat-fries-classic','Cheese Fries',69,'Fries + cheese powder','https://images.unsplash.com/photo-1585109649139-366815a0d713?w=500&auto=format&fit=crop&q=60',4.8,98)`).run();
        rawDb.prepare(`INSERT OR IGNORE INTO menu_items (id, stall_id, category_id, name, price, description, image_url, rating, rating_count) VALUES ('item-loaded-fries','stall-001','cat-fries-loaded','Loaded Chili Cheese Fries',99,'Fries + chili cheese + sour cream','https://images.unsplash.com/photo-1630384060421-c342d74f260f?w=500&auto=format&fit=crop&q=60',4.9,76)`).run();
        // Variants — use INSERT OR IGNORE then update price to keep idempotent
        const upsertVar = (mid:string, name:string, price:number, ord:number) => {
          const id = `var-${mid}-${name.toLowerCase()}`;
          try { rawDb.prepare(`INSERT INTO item_variants (id, menu_item_id, name, price, display_order) VALUES (?,?,?,?,?) ON CONFLICT(menu_item_id, name) DO UPDATE SET price=excluded.price, display_order=excluded.display_order`).run(id, mid, name, price, ord); } catch { rawDb.prepare(`INSERT OR IGNORE INTO item_variants (id, menu_item_id, name, price, display_order) VALUES (?,?,?,?,?)`).run(id, mid, name, price, ord); }
        };
        upsertVar('item-plain-fries','Small',55,1); upsertVar('item-plain-fries','Medium',75,2); upsertVar('item-plain-fries','Large',95,3);
        upsertVar('item-cheese-fries','Small',69,1); upsertVar('item-cheese-fries','Medium',89,2); upsertVar('item-cheese-fries','Large',109,3);
        upsertVar('item-loaded-fries','Small',99,1); upsertVar('item-loaded-fries','Medium',119,2); upsertVar('item-loaded-fries','Large',139,3);
        upsertVar('item-vanilla-scoop','Cone',45,1); upsertVar('item-vanilla-scoop','Small Cup',45,2); upsertVar('item-vanilla-scoop','Large Cup',65,3); upsertVar('item-vanilla-scoop','Bun',55,4);
        upsertVar('item-choco-scoop','Cone',49,1); upsertVar('item-choco-scoop','Small Cup',49,2); upsertVar('item-choco-scoop','Large Cup',69,3); upsertVar('item-choco-scoop','Bun',59,4);
        upsertVar('item-strawberry-sundae','Small Cup',89,1); upsertVar('item-strawberry-sundae','Large Cup',109,2); upsertVar('item-strawberry-sundae','Cone',89,3);
        console.log('[ExpoDB] Full seed ensured');
      } catch (e:any) { console.log('[ExpoDB] Full seed err', e.message?.slice(0,120)); }
    }
  }
} catch (e: any) { console.log('[ExpoDB] Auto-seed check:', e.message?.slice(0,120)); }

console.log('[ExpoDB] Schema ensured, WAL enabled');
export const db: any = rawDb;
export function getDb() { return db; }
export function closeDb() { try { db.close(); } catch {} }
