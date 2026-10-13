// @ts-nocheck
// CampusBITE SQLite database for the Expo API routes (server-side only).
// File: $DB_PATH or <mobile-server>/data/campusbite.db. Uses better-sqlite3 if present, else node:sqlite (Node >= 22.5).
//
// NOTE: no import.meta here — it forces Node to load the Metro API bundle as ESM, which breaks
// Metro's CJS prelude. Expo runs with cwd = packages/mobile-server, so resolve from process.cwd().
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { hashPasswordSync, isHashed } from './server/password';
import { toLocalImage } from './stockImages';
import { seedDatabase } from './seed';

const ROOT = process.cwd();
const require = createRequire(path.join(ROOT, 'package.json'));

export const DB_PATH: string = process.env.DB_PATH || path.join(ROOT, 'data', 'campusbite.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const quiet = process.env.CAMPUSBITE_QUIET === '1';
const log = (...a: any[]) => { if (!quiet) console.log(...a); };
log(`[DB] ${DB_PATH}`);

let rawDb: any;
let usingBetterSqlite3 = false;
try {
  const BetterSqlite3 = require('better-sqlite3');
  rawDb = new BetterSqlite3(DB_PATH);
  usingBetterSqlite3 = true;
} catch {
  try {
    const { DatabaseSync } = require('node:sqlite');
    rawDb = new DatabaseSync(DB_PATH);
  } catch (e: any) {
    throw new Error(`No SQLite engine: Node ${process.versions.node} has no node:sqlite and better-sqlite3 is not installed. ${e.message}`);
  }
}

// node:sqlite shims for the better-sqlite3 API used across the app
if (!usingBetterSqlite3) {
  rawDb.pragma = (sql: string) => {
    if (sql.includes('=')) { rawDb.exec(`PRAGMA ${sql}`); return; }
    const row = rawDb.prepare(`PRAGMA ${sql}`).get();
    return row ? Object.values(row)[0] : undefined;
  };
  let depth = 0;
  rawDb.transaction = (fn: (...args: any[]) => any) => (...args: any[]) => {
    // Nested calls join the outer transaction
    if (depth > 0) return fn(...args);
    rawDb.exec('BEGIN IMMEDIATE');
    depth++;
    try { const r = fn(...args); depth--; rawDb.exec('COMMIT'); return r; }
    catch (err) { depth--; try { rawDb.exec('ROLLBACK'); } catch {} throw err; }
  };
}

rawDb.pragma('journal_mode = WAL');
rawDb.pragma('foreign_keys = ON');
rawDb.pragma('busy_timeout = 5000');

const schemaPath = path.join(ROOT, 'lib', 'schema.sql');
if (!fs.existsSync(schemaPath)) throw new Error(`schema.sql not found at ${schemaPath}`);
rawDb.exec(fs.readFileSync(schemaPath, 'utf-8'));

// ---------------------------------------------------------------------------
// Column migrations for databases created by older versions
// ---------------------------------------------------------------------------
function addColumn(table: string, column: string, ddl: string) {
  const cols: any[] = rawDb.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) rawDb.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}
addColumn('menu_items', 'image_url', 'TEXT');
addColumn('menu_items', 'rating', 'REAL DEFAULT 4.9');
addColumn('menu_items', 'rating_count', 'INTEGER DEFAULT 56');
addColumn('stalls', 'logo_url', 'TEXT');
addColumn('stalls', 'rating', 'REAL DEFAULT 4.8');
addColumn('stalls', 'rating_count', 'INTEGER DEFAULT 128');
addColumn('order_items', 'variant_id', 'TEXT');
addColumn('order_items', 'variant_name', 'TEXT');
addColumn('users', 'password_hash', 'TEXT');
addColumn('users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');

// Plain-text PINs → scrypt hashes (one-time, then the legacy column is emptied)
{
  const legacy: any[] = rawDb.prepare(`SELECT id, pin FROM users WHERE (password_hash IS NULL OR password_hash = '') AND pin <> ''`).all();
  if (legacy.length) {
    const upd = rawDb.prepare(`UPDATE users SET password_hash = ?, pin = '' WHERE id = ?`);
    rawDb.transaction(() => { for (const u of legacy) upd.run(isHashed(u.pin) ? u.pin : hashPasswordSync(u.pin), u.id); })();
    log(`[DB] Migrated ${legacy.length} plain-text password(s) to scrypt`);
  }
}

// Remote Unsplash photos → bundled offline copies
{
  const rewrite = (table: string, col: string) => {
    const rows: any[] = rawDb.prepare(`SELECT id, ${col} AS url FROM ${table} WHERE ${col} LIKE '%images.unsplash.com%'`).all();
    const upd = rawDb.prepare(`UPDATE ${table} SET ${col} = ? WHERE id = ?`);
    for (const r of rows) { const local = toLocalImage(r.url); if (local !== r.url) upd.run(local, r.id); }
  };
  rewrite('stalls', 'logo_url');
  rewrite('menu_items', 'image_url');
}

// Seed an empty database
if ((rawDb.prepare(`SELECT count(*) AS c FROM stalls`).get() as any).c === 0) {
  seedDatabase(rawDb, log);
}

export const db: any = rawDb;
export function getDb() { return db; }
export function closeDb() { try { db.close(); } catch {} }
