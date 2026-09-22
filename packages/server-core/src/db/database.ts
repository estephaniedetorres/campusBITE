import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Resolve DB file: allow override via env, default to data/campusbite.db
const DATA_DIR = process.env.DB_DIR || path.join(__dirname, '../../data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'campusbite.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

console.log(`[DB] Using database at: ${DB_PATH}`);

// Try better-sqlite3 first (native, fast) — works on Android/arm64 where prebuild exists if installed.
// Fallback to Node's built-in node:sqlite (Node >=22.5, no compile, works on Windows dev).
// For Termux Node <22.5 (e.g. 20), node:sqlite is missing → instruct to install Node 22 or better-sqlite3.
let rawDb: any;
let usingBetterSqlite3 = false;
let nodeVer = process.versions.node;

try {
  const BetterSqlite3 = require('better-sqlite3');
  rawDb = new BetterSqlite3(DB_PATH);
  usingBetterSqlite3 = true;
  console.log('[DB] Using better-sqlite3 (Node ' + nodeVer + ')');
} catch (e: any) {
  console.log('[DB] better-sqlite3 not available, trying node:sqlite. Reason:', e.message?.slice(0, 120));
  try {
    // @ts-ignore - node:sqlite is experimental in Node 22.5+
    const { DatabaseSync } = require('node:sqlite');
    rawDb = new DatabaseSync(DB_PATH);
    console.log('[DB] Using node:sqlite (DatabaseSync) Node ' + nodeVer);
  } catch (e2: any) {
    console.error('[DB] FATAL: No SQLite engine available.');
    console.error('[DB] Your Node:', nodeVer, '- node:sqlite needs Node >=22.5');
    console.error('[DB] Fix for Termux phone server:');
    console.error('[DB]  1) pkg update && pkg install nodejs    # try to get Node 22');
    console.error('[DB]  2) node -v  # must be >=22.5, if still 20.x do:');
    console.error('[DB]     pkg install python clang make && npm install better-sqlite3');
    console.error('[DB]  3) node packages/server-core/dist/server.js');
    throw new Error(`No SQLite engine: Node ${nodeVer} has no node:sqlite and better-sqlite3 not installed. ${e2.message}`);
  }
}

// Shim to make node:sqlite behave like better-sqlite3 for our codebase
if (!usingBetterSqlite3) {
  // Add pragma() if missing
  if (typeof rawDb.pragma !== 'function') {
    rawDb.pragma = (sql: string, _opts?: any) => {
      // pragma string like 'journal_mode = WAL' -> exec 'PRAGMA journal_mode = WAL'
      try {
        // Try as query that returns value (e.g., 'journal_mode')
        const stmt = rawDb.prepare(`PRAGMA ${sql}`);
        // If pragma is setter (contains =), exec; else query
        if (sql.includes('=')) {
          rawDb.exec(`PRAGMA ${sql}`);
          return;
        }
        const row = stmt.get();
        return row ? Object.values(row)[0] : undefined;
      } catch {
        try { rawDb.exec(`PRAGMA ${sql}`); } catch {}
      }
    };
  }
  // Add transaction() wrapper if missing
  if (typeof rawDb.transaction !== 'function') {
    rawDb.transaction = (fn: (...args: any[]) => any) => {
      return (...args: any[]) => {
        rawDb.exec('BEGIN IMMEDIATE');
        try {
          const result = fn(...args);
          rawDb.exec('COMMIT');
          return result;
        } catch (err) {
          try { rawDb.exec('ROLLBACK'); } catch {}
          throw err;
        }
      };
    };
  }
}

// Critical for phone hardware: WAL mode + foreign keys
try { rawDb.pragma('journal_mode = WAL'); } catch {}
try { rawDb.pragma('foreign_keys = ON'); } catch {}
try { rawDb.pragma('busy_timeout = 5000'); } catch {}
// Also ensure via exec as fallback
try { rawDb.exec('PRAGMA journal_mode = WAL'); } catch {}
try { rawDb.exec('PRAGMA foreign_keys = ON'); } catch {}

const schemaCandidates = [
  path.join(__dirname, 'schema.sql'),
  path.join(__dirname, '../../src/db/schema.sql'),
  path.join(process.cwd(), 'src/db/schema.sql'),
  path.join(process.cwd(), 'packages/server-core/src/db/schema.sql'),
];
let schemaPath: string | null = null;
let schema: string | null = null;
for (const p of schemaCandidates) {
  if (fs.existsSync(p)) { schemaPath = p; schema = fs.readFileSync(p, 'utf-8'); break; }
}
if (!schema) {
  // Fallback: inline minimal schema error with hint
  console.error('[DB] schema.sql not found in candidates:', schemaCandidates);
  throw new Error('schema.sql not found. Run build with schema copy or check path.');
}
rawDb.exec(schema);

// --- MIGRATIONS: image_url + stalls.logo_url + ratings (Termux old DBs) ---
try {
  const cols: any[] = rawDb.prepare(`PRAGMA table_info(menu_items)`).all();
  const hasImageUrl = cols.some((c: any) => c.name === 'image_url');
  if (!hasImageUrl) {
    console.log('[DB] Migrating: adding menu_items.image_url');
    rawDb.exec(`ALTER TABLE menu_items ADD COLUMN image_url TEXT`);
  }
  const hasRating = cols.some((c: any) => c.name === 'rating');
  if (!hasRating) {
    console.log('[DB] Migrating: adding menu_items.rating');
    rawDb.exec(`ALTER TABLE menu_items ADD COLUMN rating REAL DEFAULT 4.9`);
    rawDb.exec(`ALTER TABLE menu_items ADD COLUMN rating_count INTEGER DEFAULT 56`);
  }
} catch (e: any) {
  console.log('[DB] Migration image_url/rating:', e.message?.slice(0,120));
}
try {
  const cols: any[] = rawDb.prepare(`PRAGMA table_info(stalls)`).all();
  const hasLogo = cols.some((c: any) => c.name === 'logo_url');
  if (!hasLogo) {
    console.log('[DB] Migrating: adding stalls.logo_url');
    rawDb.exec(`ALTER TABLE stalls ADD COLUMN logo_url TEXT`);
  }
  const hasStallRating = cols.some((c: any) => c.name === 'rating');
  if (!hasStallRating) {
    console.log('[DB] Migrating: adding stalls.rating');
    rawDb.exec(`ALTER TABLE stalls ADD COLUMN rating REAL DEFAULT 4.8`);
    rawDb.exec(`ALTER TABLE stalls ADD COLUMN rating_count INTEGER DEFAULT 128`);
  }
} catch (e: any) {
  console.log('[DB] Migration logo_url/rating:', e.message?.slice(0,120));
}
try {
  const cols: any[] = rawDb.prepare(`PRAGMA table_info(order_items)`).all();
  const hasVariant = cols.some((c: any) => c.name === 'variant_id');
  if (!hasVariant) {
    console.log('[DB] Migrating: adding order_items.variant_id/variant_name');
    rawDb.exec(`ALTER TABLE order_items ADD COLUMN variant_id TEXT`);
    rawDb.exec(`ALTER TABLE order_items ADD COLUMN variant_name TEXT`);
  }
} catch (e: any) {
  console.log('[DB] Migration variant:', e.message?.slice(0,120));
}

// --- AUTO-SEED: if stalls empty (fresh Termux DB), seed minimal data ---
try {
  const c = (rawDb.prepare(`SELECT count(*) as c FROM stalls`).get() as any).c;
  if (c === 0) {
    console.log('[DB] Empty stalls → auto-seeding for Termux...');
    const { execSync } = require('node:child_process');
    // Use dynamic import of seed file if available, else inline minimal seed
    try {
      // Try to run seed.js if exists
      const seedCandidates = [
        require('node:path').join(__dirname, 'seed.js'),
        require('node:path').join(__dirname, '../../src/db/seed.ts'),
      ];
      let ran = false;
      for (const p of seedCandidates) {
        if (require('node:fs').existsSync(p)) {
          console.log('[DB] Found seed at', p, '— run `node dist/db/seed.js` manually if auto-seed fails');
          break;
        }
      }
      // Inline minimal seed for Matees & Potato Corner
      rawDb.prepare(`INSERT OR IGNORE INTO stalls (id, name, description) VALUES ('stall-001','Potato Corner','World Famous Flavored Fries · Loaded Fries')`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO stalls (id, name, description) VALUES ('stall-002','Matees','Ice Cream · Sundaes · Milkshakes')`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO categories (id, stall_id, name, display_order) VALUES ('cat-fries-classic','stall-001','Flavored Fries',1)`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO categories (id, stall_id, name, display_order) VALUES ('cat-fries-loaded','stall-001','Loaded Fries',2)`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO categories (id, stall_id, name, display_order) VALUES ('cat-ice-classic','stall-002','Classic Scoops',1)`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO categories (id, stall_id, name, display_order) VALUES ('cat-ice-sundae','stall-002','Sundaes & Shakes',2)`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES ('ing-potato','Potatoes','g',15000,2000,0.02)`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES ('ing-oil','Cooking Oil','ml',8000,1000,0.04)`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES ('ing-milk','Fresh Milk','ml',8000,1000,0.03)`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES ('ing-cream','Heavy Cream','ml',6000,800,0.08)`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO users (id, username, pin, role, stall_id, display_name) VALUES ('user-admin','admin','admin123','ADMIN',NULL,'Canteen Manager')`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO users (id, username, pin, role, stall_id, display_name) VALUES ('user-potato','potato','potato123','STALL_OWNER','stall-001','Potato Corner Owner')`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO users (id, username, pin, role, stall_id, display_name) VALUES ('user-matees','matees','matees123','STALL_OWNER','stall-002','Matees Owner')`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO menu_items (id, stall_id, category_id, name, price, description, image_url) VALUES ('item-vanilla-scoop','stall-002','cat-ice-classic','Vanilla Scoop',45,'Single scoop Madagascar vanilla','https://images.unsplash.com/photo-1495147466023-a36482277724?w=500&auto=format&fit=crop&q=60')`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO menu_items (id, stall_id, category_id, name, price, description, image_url) VALUES ('item-choco-scoop','stall-002','cat-ice-classic','Choco Scoop',49,'Belgian chocolate','https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500&auto=format&fit=crop&q=60')`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO menu_items (id, stall_id, category_id, name, price, description, image_url) VALUES ('item-strawberry-sundae','stall-002','cat-ice-sundae','Strawberry Sundae',89,'2 scoops + strawberry sauce','https://images.unsplash.com/photo-1488900128323-21503983a07e?w=500&auto=format&fit=crop&q=60')`).run();
      rawDb.prepare(`INSERT OR IGNORE INTO menu_items (id, stall_id, category_id, name, price, description, image_url) VALUES ('item-plain-fries','stall-001','cat-fries-classic','Plain Fries',55,'Crispy classic fries 150g','https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500&auto=format&fit=crop&q=60')`).run();
      console.log('[DB] Auto-seed minimal done');
    } catch (e:any) { console.log('[DB] Auto-seed failed:', e.message?.slice(0,200)); }
  } else {
    console.log(`[DB] Stalls count=${c}, users=${(rawDb.prepare(`SELECT count(*) as c FROM users`).get() as any).c}, menu=${(rawDb.prepare(`SELECT count(*) as c FROM menu_items`).get() as any).c}`);
  }
} catch (e:any) { console.log('[DB] Auto-seed check:', e.message?.slice(0,120)); }

console.log('[DB] Schema ensured, WAL enabled');

export const db: any = rawDb;

export function getDb() {
  return db;
}

export function closeDb() {
  db.close();
}
