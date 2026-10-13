import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

// Build a database the way the old app did (plain-text PINs, Unsplash URLs) before the app module loads.
const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

describe('upgrading an old database', () => {
  it('hashes plain-text PINs and rewrites Unsplash photos to bundled copies', async () => {
    const old = new DatabaseSync(process.env.DB_PATH!);
    old.exec(`
      CREATE TABLE stalls (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, logo_url TEXT, rating REAL, rating_count INTEGER, is_active INTEGER DEFAULT 1, created_at DATETIME);
      CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, pin TEXT NOT NULL, role TEXT NOT NULL, stall_id TEXT, display_name TEXT, is_active INTEGER DEFAULT 1, created_at DATETIME);
      INSERT INTO stalls (id, name, logo_url) VALUES ('stall-001', 'Potato Corner', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=200&auto=format');
      INSERT INTO users (id, username, pin, role) VALUES ('user-old', 'oldadmin', 'secret-pin-1', 'ADMIN');
    `);
    old.close();

    const { db } = await import('../lib/database');
    const user = db.prepare(`SELECT pin, password_hash FROM users WHERE id='user-old'`).get() as any;
    expect(user.pin).toBe('');
    expect(user.password_hash).toMatch(/^scrypt\$/);
    const stall = db.prepare(`SELECT logo_url FROM stalls WHERE id='stall-001'`).get() as any;
    expect(stall.logo_url).toBe('/api/images/potato-corner.jpg');

    const { call } = await import('./helpers');
    const res = await call('POST', '/api/auth/login', { body: { username: 'oldadmin', password: 'secret-pin-1' } });
    expect(res.status).toBe(200);
  });
});
