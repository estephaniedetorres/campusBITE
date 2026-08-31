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

console.log('[DB] Schema ensured, WAL enabled');

export const db: any = rawDb;

export function getDb() {
  return db;
}

export function closeDb() {
  db.close();
}
