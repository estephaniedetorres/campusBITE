import { describe, expect, it } from 'vitest';
import { db } from '../lib/database';
import { BASE, call, login } from './helpers';
import { handle } from '../lib/server/router';
import { resetThrottle } from '../lib/server/loginThrottle';

describe('passwords and sessions', () => {
  it('stores scrypt hashes, never plain text', () => {
    const rows = db.prepare(`SELECT pin, password_hash FROM users`).all() as any[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.pin).toBe('');
      expect(r.password_hash).toMatch(/^scrypt\$/);
    }
  });

  it('issues a random bearer token and stores only its hash', async () => {
    const token = await login('admin', 'admin123');
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(token).not.toBe('user-admin');
    expect(db.prepare(`SELECT 1 FROM sessions WHERE token_hash = ?`).get(token)).toBeUndefined();
    const me = await call('GET', '/api/auth/me', { token });
    expect(me.status).toBe(200);
    expect(me.data.username).toBe('admin');
  });

  it('rejects the old user-id-as-token scheme', async () => {
    const res = await handle(new Request(`${BASE}/api/users`, { headers: { 'x-user-id': 'user-admin' } }));
    expect(res.status).toBe(401);
    const res2 = await call('GET', '/api/users', { token: 'user-admin-not-a-real-token-123' });
    expect(res2.status).toBe(401);
  });

  it('logout revokes the session on the server', async () => {
    const token = await login('matees', 'matees123');
    expect((await call('POST', '/api/auth/logout', { token })).status).toBe(200);
    expect((await call('GET', '/api/auth/me', { token })).status).toBe(401);
  });

  it('expired sessions are rejected', async () => {
    const token = await login('matees', 'matees123');
    db.prepare(`UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'`).run();
    expect((await call('GET', '/api/auth/me', { token })).status).toBe(401);
  });

  it('slows down repeated wrong passwords without locking the account', async () => {
    resetThrottle();
    const first = await call('POST', '/api/auth/login', { body: { username: 'potato', password: 'wrong-password' } });
    expect(first.status).toBe(401);
    expect(first.data.error).toBe('Invalid username or password');
    const blocked = await call('POST', '/api/auth/login', { body: { username: 'potato', password: 'potato123' } });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    resetThrottle();
    expect((await call('POST', '/api/auth/login', { body: { username: 'potato', password: 'potato123' } })).status).toBe(200);
  });

  it('gives the same error for unknown users and wrong passwords', async () => {
    resetThrottle();
    const unknown = await call('POST', '/api/auth/login', { body: { username: 'nobody', password: 'whatever123' } });
    expect(unknown.status).toBe(401);
    expect(unknown.data.error).toBe('Invalid username or password');
  });

  it('enforces 8+ character passwords on new accounts', async () => {
    const admin = await login('admin', 'admin123');
    const weak = await call('POST', '/api/users', { token: admin, body: { username: 'newowner', password: 'short', role: 'STALL_OWNER', stallId: 'stall-001' } });
    expect(weak.status).toBe(400);
    const ok = await call('POST', '/api/users', { token: admin, body: { username: 'newowner', password: 'long-enough-1', role: 'STALL_OWNER', stallId: 'stall-001' } });
    expect(ok.status).toBe(201);
    expect(ok.data.must_change_password).toBe(1);
  });
});

describe('forgot password', () => {
  it('admin reset gives a one-time password that must be changed', async () => {
    const admin = await login('admin', 'admin123');
    const ownerSession = await login('potato', 'potato123');

    const reset = await call('POST', '/api/users/user-potato/reset-password', { token: admin });
    expect(reset.status).toBe(200);
    const temp = reset.data.temporaryPassword as string;
    expect(temp).toHaveLength(12);

    // Old session and old password stop working
    expect((await call('GET', '/api/auth/me', { token: ownerSession })).status).toBe(401);
    resetThrottle();
    expect((await call('POST', '/api/auth/login', { body: { username: 'potato', password: 'potato123' } })).status).toBe(401);

    // Temp password logs in, but only the change-password routes are allowed
    resetThrottle();
    const tempLogin = await call('POST', '/api/auth/login', { body: { username: 'potato', password: temp } });
    expect(tempLogin.status).toBe(200);
    expect(tempLogin.data.mustChangePassword).toBe(true);
    const t = tempLogin.data.token;
    const blocked = await call('GET', '/api/orders', { token: t });
    expect(blocked.status).toBe(403);
    expect(blocked.data.code).toBe('PASSWORD_CHANGE_REQUIRED');

    expect((await call('POST', '/api/auth/change-password', { token: t, body: { currentPassword: temp, newPassword: 'short' } })).status).toBe(400);
    expect((await call('POST', '/api/auth/change-password', { token: t, body: { currentPassword: 'nope', newPassword: 'brand-new-pass' } })).status).toBe(401);
    const changed = await call('POST', '/api/auth/change-password', { token: t, body: { currentPassword: temp, newPassword: 'brand-new-pass' } });
    expect(changed.status).toBe(200);
    expect(changed.data.user.must_change_password).toBe(0);
    expect((await call('GET', '/api/orders', { token: t })).status).toBe(200);
  });

  it('admins cannot reset their own password through the reset route', async () => {
    const admin = await login('admin', 'admin123');
    expect((await call('POST', '/api/users/user-admin/reset-password', { token: admin })).status).toBe(400);
  });
});
