// Server-side sessions: random 32-byte bearer tokens, only their SHA-256 is stored.
import { createHash, randomBytes } from 'node:crypto';

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  username: string;
  role: 'ADMIN' | 'STALL_OWNER';
  stall_id: string | null;
  display_name: string | null;
  is_active: number;
  must_change_password: number;
  token_hash: string;
};

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createSession(db: any, userId: string, now = Date.now()) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
  db.prepare(`INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)`)
    .run(hashToken(token), userId, new Date(now).toISOString(), expiresAt);
  // Opportunistic cleanup of expired sessions
  try { db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(new Date(now).toISOString()); } catch {}
  return { token, expiresAt };
}

/** Bearer token from the Authorization header, or null. */
export function getBearerToken(req: Request): string | null {
  const h = req.headers.get('authorization') || '';
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec(h.trim());
  return m ? m[1] : null;
}

export function getSessionUser(db: any, token: string | null, now = Date.now()): SessionUser | null {
  if (!token) return null;
  const row = db.prepare(
    `SELECT u.id, u.username, u.role, u.stall_id, u.display_name, u.is_active,
            COALESCE(u.must_change_password, 0) AS must_change_password, s.token_hash
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1`
  ).get(hashToken(token), new Date(now).toISOString());
  return (row as SessionUser) || null;
}

export function revokeSession(db: any, token: string) {
  db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(hashToken(token));
}

export function revokeUserSessions(db: any, userId: string, exceptTokenHash?: string) {
  if (exceptTokenHash) db.prepare(`DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?`).run(userId, exceptTokenHash);
  else db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
}
