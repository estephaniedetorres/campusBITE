import type { Request, Response, NextFunction } from 'express';
import { db } from '../db/database.js';

export interface AuthUser {
  id: string;
  username: string;
  role: 'ADMIN' | 'STALL_OWNER';
  stall_id: string | null;
  display_name: string;
  is_active: number;
}

export function getAuthUser(req: Request): AuthUser | null {
  const userId = (req.headers['x-user-id'] as string) || (req.headers['x-userid'] as string) || (req.query.userId as string);
  if (!userId) return null;
  try {
    const user = db.prepare(`SELECT id, username, role, stall_id, display_name, is_active FROM users WHERE id=? AND is_active=1`).get(userId) as AuthUser | undefined;
    return user || null;
  } catch { return null; }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized: missing or invalid x-user-id header. Please POST /api/auth/login first.' });
  (req as any).user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AuthUser;
  if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden: ADMIN only' });
  next();
}

// Helper: can user manage stallId?
export function canManageStall(user: AuthUser, stallId: string): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'STALL_OWNER' && user.stall_id === stallId) return true;
  return false;
}

// Helper: filter stalls visible to user
export function getVisibleStallIds(user: AuthUser | null): string[] | null {
  // null = all visible (ADMIN or unauthenticated for public reads)
  if (!user) return null; // public read sees all
  if (user.role === 'ADMIN') return null;
  if (user.role === 'STALL_OWNER' && user.stall_id) return [user.stall_id];
  return [];
}
