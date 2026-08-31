import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const authRouter = Router();

// POST /api/auth/login  { username, pin }
authRouter.post('/auth/login', (req, res) => {
  const schema = z.object({ username: z.string().min(1), pin: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const { username, pin } = parsed.data;
  const user = db.prepare(`SELECT id, username, role, stall_id, display_name, is_active, pin FROM users WHERE username=?`).get(username) as any;
  if (!user || user.pin !== pin) return res.status(401).json({ error: 'Invalid username or PIN' });
  if (!user.is_active) return res.status(403).json({ error: 'Account disabled' });
  // Return without pin, add stall name for convenience
  const stall = user.stall_id ? db.prepare(`SELECT name FROM stalls WHERE id=?`).get(user.stall_id) as any : null;
  const { pin: _p, ...safe } = user;
  res.json({ user: { ...safe, stall_name: stall?.name || null }, token: user.id });
});

// GET /api/auth/me  (header x-user-id)
authRouter.get('/auth/me', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Missing x-user-id' });
  const user = db.prepare(`SELECT id, username, role, stall_id, display_name, is_active FROM users WHERE id=?`).get(userId) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });
  const stall = user.stall_id ? db.prepare(`SELECT name FROM stalls WHERE id=?`).get(user.stall_id) as any : null;
  res.json({ ...user, stall_name: stall?.name || null });
});

// GET /api/users  (ADMIN only)
authRouter.get('/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.role, u.stall_id, u.display_name, u.is_active, u.created_at, s.name as stall_name
    FROM users u LEFT JOIN stalls s ON s.id=u.stall_id
    ORDER BY u.role, u.username
  `).all();
  res.json(users);
});

// POST /api/users  (ADMIN only)  { username, pin, role, stallId?, displayName? }
authRouter.post('/users', requireAuth, requireAdmin, (req, res) => {
  const schema = z.object({
    username: z.string().min(3).max(30),
    pin: z.string().min(3).max(20),
    role: z.enum(['ADMIN', 'STALL_OWNER']),
    stallId: z.string().nullable().optional(),
    displayName: z.string().min(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const { username, pin, role, stallId, displayName } = parsed.data;
  if (role === 'STALL_OWNER' && !stallId) return res.status(400).json({ error: 'STALL_OWNER requires stallId' });
  if (stallId) {
    const stall = db.prepare(`SELECT id FROM stalls WHERE id=?`).get(stallId);
    if (!stall) return res.status(404).json({ error: 'Stall not found' });
  }
  const id = `user-${uuidv4().slice(0, 8)}`;
  try {
    db.prepare(`INSERT INTO users (id, username, pin, role, stall_id, display_name) VALUES (?,?,?,?,?,?)`)
      .run(id, username, pin, role, stallId || null, displayName || username);
    const created = db.prepare(`SELECT id, username, role, stall_id, display_name FROM users WHERE id=?`).get(id);
    res.status(201).json(created);
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/users/:id  (ADMIN only)
authRouter.patch('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const user = db.prepare(`SELECT * FROM users WHERE id=?`).get(req.params.id) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });
  const schema = z.object({
    pin: z.string().min(3).max(20).optional(),
    role: z.enum(['ADMIN', 'STALL_OWNER']).optional(),
    stallId: z.string().nullable().optional(),
    displayName: z.string().min(1).optional(),
    is_active: z.number().int().min(0).max(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const fields: string[] = []; const vals: any[] = [];
  if (parsed.data.pin !== undefined) { fields.push('pin=?'); vals.push(parsed.data.pin); }
  if (parsed.data.role !== undefined) { fields.push('role=?'); vals.push(parsed.data.role); }
  if (parsed.data.stallId !== undefined) { fields.push('stall_id=?'); vals.push(parsed.data.stallId); }
  if (parsed.data.displayName !== undefined) { fields.push('display_name=?'); vals.push(parsed.data.displayName); }
  if (parsed.data.is_active !== undefined) { fields.push('is_active=?'); vals.push(parsed.data.is_active); }
  if (fields.length === 0) return res.json(user);
  vals.push(req.params.id);
  db.prepare(`UPDATE users SET ${fields.join(',')} WHERE id=?`).run(...vals);
  res.json(db.prepare(`SELECT id, username, role, stall_id, display_name, is_active FROM users WHERE id=?`).get(req.params.id));
});

// DELETE /api/users/:id  (ADMIN only, cannot delete self)
authRouter.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const current = (req as any).user;
  if (current.id === req.params.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  const info = db.prepare(`DELETE FROM users WHERE id=?`).run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});
