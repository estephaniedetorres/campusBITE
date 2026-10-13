// CampusBITE API — every route declares who may call it:
//   public  → anyone on the hotspot (kiosk, menu, order tracking by UUID, images)
//   staff   → any logged-in ADMIN or STALL_OWNER (stall owners are further limited to their own stall)
//   admin   → ADMIN only
// Staff with must_change_password may only use routes marked allowPendingPasswordChange.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { db, DB_PATH } from '../database';
import * as bom from '../bomEngine';
import {
  hashPassword, verifyPassword, getDummyHash, passwordPolicyError, generateTempPassword,
} from './password';
import {
  createSession, getBearerToken, getSessionUser, revokeSession, revokeUserSessions, SessionUser,
} from './sessions';
import { retryAfterSeconds, recordFailure, recordSuccess } from './loginThrottle';

export type Auth = 'public' | 'staff' | 'admin';
type Ctx = {
  req: Request;
  url: URL;
  params: Record<string, string>;
  body: any;
  user: SessionUser | null;
  token: string | null;
};
type Route = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  auth: Auth;
  allowPendingPasswordChange?: boolean;
  handler: (ctx: Ctx) => Response | Promise<Response>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}
const bad = (error: string) => json({ error }, 400);
const forbidden = (error = 'Forbidden') => json({ error }, 403);
const notFound = (error = 'Not found') => json({ error }, 404);

function canManageStall(user: SessionUser | null, stallId: string | null | undefined) {
  if (!user || !stallId) return false;
  return user.role === 'ADMIN' || (user.role === 'STALL_OWNER' && user.stall_id === stallId);
}
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const isPosInt = (v: unknown, max = 1e6) => Number.isInteger(v) && (v as number) > 0 && (v as number) <= max;
const str = (v: unknown, max = 500) => (typeof v === 'string' && v.trim() !== '' && v.length <= max ? v.trim() : null);

function safeUser(u: any) {
  const stall = u.stall_id ? (db.prepare(`SELECT name FROM stalls WHERE id=?`).get(u.stall_id) as any) : null;
  return {
    id: u.id, username: u.username, role: u.role, stall_id: u.stall_id ?? null, stall_name: stall?.name ?? null,
    display_name: u.display_name, is_active: u.is_active, must_change_password: u.must_change_password ? 1 : 0,
  };
}

// Virtual adapters (VirtualBox, VMware, Hyper-V/WSL, Docker) are never what phones on the hotspot can reach
const VIRTUAL_IFACE = /virtualbox|vmware|vmnet|vethernet|hyper-v|wsl|docker|vbox|loopback|tailscale|zerotier/i;
const isLoopback = (h: string) => /^(localhost|127\.|::1|\[::1\])/.test(h);
const isIPv4 = (h: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h);

export function lanAddresses(ifaces = os.networkInterfaces()): string[] {
  const out: string[] = [];
  for (const [name, list] of Object.entries(ifaces)) {
    if (VIRTUAL_IFACE.test(name)) continue;
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('192.168.56.') && !a.address.startsWith('169.254.')) out.push(a.address);
    }
  }
  // Prefer the classic phone-hotspot range, then any private LAN address
  const rank = (ip: string) => (ip.startsWith('192.168.43.') ? 0 : ip.startsWith('192.168.') ? 1 : ip.startsWith('10.') ? 2 : ip.startsWith('172.') ? 3 : 4);
  return out.sort((a, b) => rank(a) - rank(b));
}

/** Address for QR codes: the one the caller used to reach us (if it's a LAN IP), else the best LAN guess. */
export function publicIp(requestHost: string, ifaces = os.networkInterfaces()): string {
  if (isIPv4(requestHost) && !isLoopback(requestHost)) return requestHost;
  return lanAddresses(ifaces)[0] || requestHost;
}

export const UPLOAD_DIR = path.join(path.dirname(DB_PATH), 'uploads');
export const STOCK_DIR = path.join(process.cwd(), 'assets', 'stock');
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const FILE_RE = /^[a-z0-9-]{1,80}\.(jpg|png|webp)$/i;
const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Detect image type from magic bytes — never trust the client's extension or MIME. */
export function sniffImage(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function serveFile(dir: string, file: string) {
  if (!FILE_RE.test(file)) return notFound();
  const full = path.join(dir, file);
  if (path.dirname(full) !== dir || !fs.existsSync(full)) return notFound();
  const ext = file.split('.').pop()!.toLowerCase();
  return new Response(fs.readFileSync(full), {
    headers: { 'Content-Type': MIME[ext], 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
  });
}

function orderWithItems(id: string) {
  const order = db.prepare(`SELECT o.*, s.name AS stall_name FROM orders o LEFT JOIN stalls s ON s.id=o.stall_id WHERE o.id=?`).get(id) as any;
  if (!order) return null;
  const items = db.prepare(`SELECT oi.*, mi.name AS menu_item_name FROM order_items oi JOIN menu_items mi ON mi.id=oi.menu_item_id WHERE oi.order_id=?`).all(id);
  return { order, items };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
export const routes: Route[] = [
  // ----- health / static -----
  {
    method: 'GET', path: '/api/health', auth: 'public',
    handler: ({ url }) => {
      const port = Number(url.port) || 8081;
      return json({ ok: true, service: 'CampusBITE', ip: publicIp(url.hostname), ips: lanAddresses(), port, timestamp: new Date().toISOString() });
    },
  },
  { method: 'GET', path: '/api/images/:file', auth: 'public', handler: ({ params }) => serveFile(STOCK_DIR, params.file) },
  { method: 'GET', path: '/api/uploads/:file', auth: 'public', handler: ({ params }) => serveFile(UPLOAD_DIR, params.file) },
  {
    method: 'POST', path: '/api/uploads', auth: 'staff',
    handler: ({ body }) => {
      const b64 = typeof body?.dataBase64 === 'string' ? body.dataBase64.replace(/^data:[^,]*,/, '') : '';
      if (!b64) return bad('dataBase64 required');
      if (b64.length > Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 8) return json({ error: 'Image must be 2 MB or smaller' }, 413);
      const buf = Buffer.from(b64, 'base64');
      if (buf.length > MAX_UPLOAD_BYTES) return json({ error: 'Image must be 2 MB or smaller' }, 413);
      const ext = sniffImage(buf);
      if (!ext) return json({ error: 'Only JPEG, PNG or WebP images are allowed' }, 415);
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const file = `${randomUUID()}.${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
      return json({ url: `/api/uploads/${file}` }, 201);
    },
  },

  // ----- auth -----
  {
    method: 'POST', path: '/api/auth/login', auth: 'public',
    handler: async ({ body }) => {
      const username = str(body?.username, 64);
      const password = typeof body?.password === 'string' ? body.password : typeof body?.pin === 'string' ? body.pin : null;
      if (!username || !password) return bad('Username and password required');
      const wait = retryAfterSeconds(username);
      if (wait > 0) return json({ error: `Too many attempts. Try again in ${wait}s.`, retryAfter: wait }, 429, { 'Retry-After': String(wait) });
      const user = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as any;
      const ok = await verifyPassword(password, user?.password_hash || getDummyHash());
      if (!user || !ok) {
        const delay = recordFailure(username);
        return json({ error: 'Invalid username or password', retryAfter: delay }, 401);
      }
      if (!user.is_active) return forbidden('Account disabled');
      recordSuccess(username);
      const { token, expiresAt } = createSession(db, user.id);
      return json({ user: safeUser(user), token, expiresAt, mustChangePassword: !!user.must_change_password });
    },
  },
  { method: 'GET', path: '/api/auth/me', auth: 'staff', allowPendingPasswordChange: true, handler: ({ user }) => json(safeUser(user)) },
  {
    method: 'POST', path: '/api/auth/logout', auth: 'staff', allowPendingPasswordChange: true,
    handler: ({ token }) => { revokeSession(db, token!); return json({ ok: true }); },
  },
  {
    method: 'POST', path: '/api/auth/change-password', auth: 'staff', allowPendingPasswordChange: true,
    handler: async ({ body, user }) => {
      const current = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
      const next = body?.newPassword;
      const row = db.prepare(`SELECT * FROM users WHERE id=?`).get(user!.id) as any;
      if (!(await verifyPassword(current, row?.password_hash))) return json({ error: 'Current password is incorrect' }, 401);
      const policy = passwordPolicyError(next);
      if (policy) return bad(policy);
      if (next === current) return bad('New password must be different');
      db.prepare(`UPDATE users SET password_hash=?, pin='', must_change_password=0 WHERE id=?`).run(await hashPassword(next), user!.id);
      revokeUserSessions(db, user!.id, user!.token_hash); // log out other devices
      return json({ ok: true, user: safeUser(db.prepare(`SELECT * FROM users WHERE id=?`).get(user!.id)) });
    },
  },

  // ----- users (admin) -----
  {
    method: 'GET', path: '/api/users', auth: 'admin',
    handler: () => json(db.prepare(`SELECT u.id, u.username, u.role, u.stall_id, u.display_name, u.is_active, u.must_change_password, u.created_at, s.name AS stall_name
      FROM users u LEFT JOIN stalls s ON s.id=u.stall_id ORDER BY u.role, u.username`).all()),
  },
  {
    method: 'POST', path: '/api/users', auth: 'admin',
    handler: async ({ body }) => {
      const username = str(body?.username, 64);
      const password = body?.password ?? body?.pin;
      const role = body?.role;
      if (!username || !/^[a-z0-9._-]{3,64}$/i.test(username)) return bad('Username: 3–64 letters, numbers, . _ -');
      if (role !== 'ADMIN' && role !== 'STALL_OWNER') return bad('role must be ADMIN or STALL_OWNER');
      const policy = passwordPolicyError(password);
      if (policy) return bad(policy);
      if (role === 'STALL_OWNER' && !db.prepare(`SELECT id FROM stalls WHERE id=?`).get(body?.stallId)) return bad('STALL_OWNER requires a valid stallId');
      const id = `user-${randomUUID().slice(0, 8)}`;
      try {
        db.prepare(`INSERT INTO users (id, username, pin, password_hash, must_change_password, role, stall_id, display_name) VALUES (?,?,'',?,1,?,?,?)`)
          .run(id, username, await hashPassword(password), role, role === 'STALL_OWNER' ? body.stallId : null, str(body?.displayName, 100) || username);
      } catch (e: any) {
        if (String(e.message).includes('UNIQUE')) return json({ error: 'Username already exists' }, 409);
        throw e;
      }
      return json(safeUser(db.prepare(`SELECT * FROM users WHERE id=?`).get(id)), 201);
    },
  },
  {
    method: 'PATCH', path: '/api/users/:id', auth: 'admin',
    handler: async ({ params, body, user }) => {
      const existing = db.prepare(`SELECT * FROM users WHERE id=?`).get(params.id) as any;
      if (!existing) return notFound('User not found');
      const isSelf = existing.id === user!.id;
      const fields: string[] = []; const vals: any[] = [];
      let revoke = false;
      const password = body?.password ?? body?.pin;
      if (password !== undefined) {
        const policy = passwordPolicyError(password);
        if (policy) return bad(policy);
        fields.push('password_hash=?', "pin=''", 'must_change_password=?'); vals.push(await hashPassword(password), isSelf ? 0 : 1);
        revoke = true;
      }
      if (body?.role !== undefined) {
        if (body.role !== 'ADMIN' && body.role !== 'STALL_OWNER') return bad('Invalid role');
        if (isSelf && body.role !== 'ADMIN') return bad('You cannot remove your own admin role');
        fields.push('role=?'); vals.push(body.role); revoke = true;
      }
      if (body?.stallId !== undefined) { fields.push('stall_id=?'); vals.push(body.stallId || null); revoke = true; }
      if (body?.displayName !== undefined) { fields.push('display_name=?'); vals.push(str(body.displayName, 100)); }
      if (body?.is_active !== undefined) {
        if (isSelf && !body.is_active) return bad('You cannot deactivate yourself');
        fields.push('is_active=?'); vals.push(body.is_active ? 1 : 0); revoke = true;
      }
      if (fields.length) {
        vals.push(params.id);
        db.prepare(`UPDATE users SET ${fields.join(',')} WHERE id=?`).run(...vals);
        if (revoke) revokeUserSessions(db, params.id, isSelf ? user!.token_hash : undefined);
      }
      return json(safeUser(db.prepare(`SELECT * FROM users WHERE id=?`).get(params.id)));
    },
  },
  {
    method: 'POST', path: '/api/users/:id/reset-password', auth: 'admin',
    handler: async ({ params, user }) => {
      const target = db.prepare(`SELECT * FROM users WHERE id=?`).get(params.id) as any;
      if (!target) return notFound('User not found');
      if (target.id === user!.id) return bad('Use "Change password" for your own account');
      const temporaryPassword = generateTempPassword();
      db.prepare(`UPDATE users SET password_hash=?, pin='', must_change_password=1 WHERE id=?`).run(await hashPassword(temporaryPassword), target.id);
      revokeUserSessions(db, target.id);
      recordSuccess(target.username);
      return json({ username: target.username, temporaryPassword });
    },
  },
  {
    method: 'DELETE', path: '/api/users/:id', auth: 'admin',
    handler: ({ params, user }) => {
      if (params.id === user!.id) return bad('You cannot delete yourself');
      revokeUserSessions(db, params.id);
      const info = db.prepare(`DELETE FROM users WHERE id=?`).run(params.id);
      return info.changes ? json({ ok: true }) : notFound('User not found');
    },
  },

  // ----- stalls -----
  { method: 'GET', path: '/api/stalls', auth: 'public', handler: () => json(db.prepare(`SELECT * FROM stalls WHERE is_active=1`).all()) },
  {
    method: 'POST', path: '/api/stalls', auth: 'admin',
    handler: ({ body }) => {
      const name = str(body?.name, 100);
      if (!name) return bad('name required');
      const id = str(body?.id, 40) || `stall-${randomUUID().slice(0, 6)}`;
      try {
        db.prepare(`INSERT INTO stalls (id, name, description, logo_url, rating, rating_count) VALUES (?,?,?,?,?,?)`)
          .run(id, name, str(body?.description) || null, str(body?.logoUrl, 1000) || null, 4.8, 0);
      } catch (e: any) { return json({ error: 'Stall already exists' }, 409); }
      return json(db.prepare(`SELECT * FROM stalls WHERE id=?`).get(id), 201);
    },
  },
  {
    method: 'PATCH', path: '/api/stalls/:id', auth: 'admin',
    handler: ({ params, body }) => {
      if (!db.prepare(`SELECT id FROM stalls WHERE id=?`).get(params.id)) return notFound('Stall not found');
      const map: Record<string, string> = { name: 'name', description: 'description', logoUrl: 'logo_url', is_active: 'is_active' };
      const fields: string[] = []; const vals: any[] = [];
      for (const [k, col] of Object.entries(map)) if (body?.[k] !== undefined) { fields.push(`${col}=?`); vals.push(body[k]); }
      if (fields.length) { vals.push(params.id); db.prepare(`UPDATE stalls SET ${fields.join(',')} WHERE id=?`).run(...vals); }
      return json(db.prepare(`SELECT * FROM stalls WHERE id=?`).get(params.id));
    },
  },

  // ----- categories -----
  {
    method: 'GET', path: '/api/categories', auth: 'public',
    handler: ({ url }) => {
      const stallId = url.searchParams.get('stallId');
      if (url.searchParams.get('includeEmpty') === '1' || !stallId) {
        return json(stallId
          ? db.prepare(`SELECT * FROM categories WHERE stall_id=? ORDER BY display_order`).all(stallId)
          : db.prepare(`SELECT * FROM categories ORDER BY display_order`).all());
      }
      return json(db.prepare(`SELECT DISTINCT c.* FROM categories c JOIN menu_items mi ON mi.category_id=c.id AND mi.is_available=1 WHERE c.stall_id=? ORDER BY c.display_order`).all(stallId));
    },
  },
  {
    method: 'POST', path: '/api/categories', auth: 'staff',
    handler: ({ body, user }) => {
      const name = str(body?.name, 100);
      if (!body?.stallId || !name) return bad('stallId and name required');
      if (!canManageStall(user, body.stallId)) return forbidden('Forbidden for this stall');
      const id = `cat-${randomUUID().slice(0, 8)}`;
      db.prepare(`INSERT INTO categories (id, stall_id, name, display_order) VALUES (?,?,?,?)`).run(id, body.stallId, name, Number(body.displayOrder) || 0);
      return json(db.prepare(`SELECT * FROM categories WHERE id=?`).get(id), 201);
    },
  },
  {
    method: 'DELETE', path: '/api/categories/:id', auth: 'staff',
    handler: ({ params, user }) => {
      const cat = db.prepare(`SELECT * FROM categories WHERE id=?`).get(params.id) as any;
      if (!cat) return notFound('Category not found');
      if (!canManageStall(user, cat.stall_id)) return forbidden();
      try { db.prepare(`DELETE FROM categories WHERE id=?`).run(params.id); }
      catch { return json({ error: 'Category has items that appear in past orders; mark them unavailable instead' }, 409); }
      return json({ ok: true });
    },
  },

  // ----- menu -----
  {
    method: 'GET', path: '/api/menu', auth: 'public',
    handler: ({ url }) => {
      const stallId = url.searchParams.get('stallId');
      const categoryId = url.searchParams.get('categoryId');
      const all = ['1', 'true'].includes(url.searchParams.get('includeUnavailable') || '');
      let sql = `SELECT mi.*, c.name AS category_name, s.name AS stall_name FROM menu_items mi JOIN categories c ON c.id=mi.category_id JOIN stalls s ON s.id=mi.stall_id WHERE 1=1`;
      const p: any[] = [];
      if (!all) sql += ` AND mi.is_available=1`;
      if (stallId) { sql += ` AND mi.stall_id=?`; p.push(stallId); }
      if (categoryId) { sql += ` AND mi.category_id=?`; p.push(categoryId); }
      sql += ` ORDER BY c.display_order, mi.name`;
      const items: any[] = db.prepare(sql).all(...p);
      const vs = db.prepare(`SELECT * FROM item_variants WHERE menu_item_id=? ORDER BY display_order, price`);
      for (const it of items) it.variants = vs.all(it.id);
      return json(items);
    },
  },
  {
    method: 'GET', path: '/api/menu/:id/detail', auth: 'staff',
    handler: ({ params, user }) => {
      const item = db.prepare(`SELECT * FROM menu_items WHERE id=?`).get(params.id) as any;
      if (!item) return notFound('Item not found');
      if (!canManageStall(user, item.stall_id)) return forbidden();
      const bomRows = db.prepare(`SELECT rb.quantity_required, i.id AS ingredient_id, i.name, i.unit, i.current_stock FROM recipe_bom rb JOIN ingredients i ON i.id=rb.ingredient_id WHERE rb.menu_item_id=?`).all(params.id);
      const variants = db.prepare(`SELECT * FROM item_variants WHERE menu_item_id=? ORDER BY display_order`).all(params.id);
      return json({ item, bom: bomRows, variants });
    },
  },
  {
    method: 'POST', path: '/api/menu', auth: 'staff',
    handler: ({ body, user }) => {
      const name = str(body?.name, 100);
      const price = num(body?.price);
      if (!body?.stallId || !body?.categoryId || !name || !(price >= 0)) return bad('stallId, categoryId, name, price required');
      if (!canManageStall(user, body.stallId)) return forbidden('Forbidden for this stall');
      const cat = db.prepare(`SELECT stall_id FROM categories WHERE id=?`).get(body.categoryId) as any;
      if (!cat || cat.stall_id !== body.stallId) return bad('Category does not belong to this stall');
      const id = `item-${randomUUID().slice(0, 8)}`;
      db.prepare(`INSERT INTO menu_items (id, stall_id, category_id, name, price, description, image_url, is_available, rating, rating_count) VALUES (?,?,?,?,?,?,?,?,4.9,0)`)
        .run(id, body.stallId, body.categoryId, name, price, str(body?.description) || null, str(body?.imageUrl, 1000) || null, body?.isAvailable === 0 ? 0 : 1);
      return json(db.prepare(`SELECT * FROM menu_items WHERE id=?`).get(id), 201);
    },
  },
  {
    method: 'PATCH', path: '/api/menu/:id', auth: 'staff',
    handler: ({ params, body, user }) => {
      const existing = db.prepare(`SELECT * FROM menu_items WHERE id=?`).get(params.id) as any;
      if (!existing) return notFound('Menu item not found');
      if (!canManageStall(user, existing.stall_id)) return forbidden('Forbidden for this stall');
      const fields: string[] = []; const vals: any[] = [];
      if (body?.name !== undefined) { const n = str(body.name, 100); if (!n) return bad('Invalid name'); fields.push('name=?'); vals.push(n); }
      if (body?.price !== undefined) { const p = num(body.price); if (!(p >= 0)) return bad('Invalid price'); fields.push('price=?'); vals.push(p); }
      if (body?.description !== undefined) { fields.push('description=?'); vals.push(body.description || null); }
      if (body?.categoryId !== undefined) {
        const cat = db.prepare(`SELECT stall_id FROM categories WHERE id=?`).get(body.categoryId) as any;
        if (!cat || cat.stall_id !== existing.stall_id) return bad('Category does not belong to this stall');
        fields.push('category_id=?'); vals.push(body.categoryId);
      }
      const avail = body?.isAvailable ?? body?.is_available;
      if (avail !== undefined) { fields.push('is_available=?'); vals.push(avail ? 1 : 0); }
      if (body?.imageUrl !== undefined) { fields.push('image_url=?'); vals.push(body.imageUrl || null); }
      if (fields.length) { vals.push(params.id); db.prepare(`UPDATE menu_items SET ${fields.join(',')} WHERE id=?`).run(...vals); }
      return json(db.prepare(`SELECT * FROM menu_items WHERE id=?`).get(params.id));
    },
  },
  {
    method: 'DELETE', path: '/api/menu/:id', auth: 'staff',
    handler: ({ params, user }) => {
      const item = db.prepare(`SELECT * FROM menu_items WHERE id=?`).get(params.id) as any;
      if (!item) return notFound('Menu item not found');
      if (!canManageStall(user, item.stall_id)) return forbidden();
      try { db.prepare(`DELETE FROM menu_items WHERE id=?`).run(params.id); }
      catch { return json({ error: 'Item appears in past orders; mark it unavailable instead' }, 409); }
      return json({ ok: true });
    },
  },

  // ----- recipe BOM -----
  {
    method: 'GET', path: '/api/recipe-bom', auth: 'staff',
    handler: ({ url, user }) => {
      const menuItemId = url.searchParams.get('menuItemId');
      const ownerOnly = user!.role === 'STALL_OWNER';
      let sql = `SELECT rb.*, i.name AS ingredient_name, i.unit, i.current_stock, mi.name AS menu_item_name, mi.stall_id
        FROM recipe_bom rb JOIN ingredients i ON i.id=rb.ingredient_id JOIN menu_items mi ON mi.id=rb.menu_item_id WHERE 1=1`;
      const p: any[] = [];
      if (menuItemId) { sql += ` AND rb.menu_item_id=?`; p.push(menuItemId); }
      if (ownerOnly) { sql += ` AND mi.stall_id=?`; p.push(user!.stall_id); }
      return json(db.prepare(sql + ` ORDER BY mi.name`).all(...p));
    },
  },
  {
    method: 'POST', path: '/api/recipe-bom', auth: 'staff',
    handler: ({ body, user }) => {
      const qty = num(body?.quantityRequired);
      if (!body?.menuItemId || !body?.ingredientId || !(qty > 0)) return bad('menuItemId, ingredientId, quantityRequired required');
      const item = db.prepare(`SELECT stall_id FROM menu_items WHERE id=?`).get(body.menuItemId) as any;
      if (!item) return notFound('Menu item not found');
      if (!canManageStall(user, item.stall_id)) return forbidden('Forbidden for this stall');
      if (!db.prepare(`SELECT id FROM ingredients WHERE id=?`).get(body.ingredientId)) return notFound('Ingredient not found');
      const id = randomUUID();
      try { db.prepare(`INSERT INTO recipe_bom (id, menu_item_id, ingredient_id, quantity_required) VALUES (?,?,?,?)`).run(id, body.menuItemId, body.ingredientId, qty); }
      catch { return json({ error: 'This ingredient is already in the recipe' }, 409); }
      return json(db.prepare(`SELECT * FROM recipe_bom WHERE id=?`).get(id), 201);
    },
  },
  {
    method: 'DELETE', path: '/api/recipe-bom/:id', auth: 'staff',
    handler: ({ params, user }) => {
      const row = db.prepare(`SELECT rb.*, mi.stall_id FROM recipe_bom rb JOIN menu_items mi ON mi.id=rb.menu_item_id WHERE rb.id=?`).get(params.id) as any;
      if (!row) return notFound();
      if (!canManageStall(user, row.stall_id)) return forbidden();
      db.prepare(`DELETE FROM recipe_bom WHERE id=?`).run(params.id);
      return json({ ok: true });
    },
  },

  // ----- inventory (admin) -----
  { method: 'GET', path: '/api/ingredients', auth: 'admin', handler: () => json(db.prepare(`SELECT * FROM ingredients ORDER BY name`).all()) },
  {
    method: 'GET', path: '/api/inventory', auth: 'admin',
    handler: () => json(db.prepare(`SELECT *, CASE WHEN current_stock <= min_threshold THEN 1 ELSE 0 END AS is_low FROM ingredients ORDER BY is_low DESC, name`).all()),
  },
  {
    method: 'GET', path: '/api/inventory/:id', auth: 'admin',
    handler: ({ params }) => { const r = db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(params.id); return r ? json(r) : notFound('Ingredient not found'); },
  },
  {
    method: 'GET', path: '/api/inventory/:id/logs', auth: 'admin',
    handler: ({ params, url }) => json(db.prepare(`SELECT * FROM stock_logs WHERE ingredient_id=? ORDER BY created_at DESC LIMIT ?`)
      .all(params.id, Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200))),
  },
  {
    method: 'POST', path: '/api/inventory', auth: 'admin',
    handler: ({ body }) => {
      const name = str(body?.name, 100);
      const unit = body?.unit || 'pcs';
      if (!name) return bad('name required');
      if (!['g', 'kg', 'ml', 'L', 'pcs'].includes(unit)) return bad('unit must be g, kg, ml, L or pcs');
      const id = `ing-${randomUUID().slice(0, 8)}`;
      try {
        db.prepare(`INSERT INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES (?,?,?,?,?,?)`)
          .run(id, name, unit, num(body?.current_stock) || 0, num(body?.min_threshold) || 10, num(body?.cost_per_unit) || 0);
      } catch { return json({ error: 'Ingredient already exists' }, 409); }
      return json(db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(id), 201);
    },
  },
  ...(['stock-in', 'stock-out'] as const).map((kind): Route => ({
    method: 'POST', path: `/api/inventory/:id/${kind}`, auth: 'admin',
    handler: ({ params, body }) => {
      const qty = num(body?.quantity);
      if (!(qty > 0)) return bad('quantity must be positive');
      const ing = db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(params.id) as any;
      if (!ing) return notFound('Ingredient not found');
      if (kind === 'stock-out' && ing.current_stock < qty) return json({ error: `Insufficient stock: have ${ing.current_stock}, need ${qty}` }, 409);
      const delta = kind === 'stock-in' ? qty : -qty;
      db.transaction(() => {
        db.prepare(`UPDATE ingredients SET current_stock = current_stock + ?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(delta, params.id);
        db.prepare(`INSERT INTO stock_logs (id, ingredient_id, change_type, quantity_delta, reason) VALUES (?,?,?,?,?)`)
          .run(randomUUID(), params.id, kind === 'stock-in' ? 'STOCK_IN' : 'WASTAGE', delta, str(body?.reason) || (kind === 'stock-in' ? 'Manual stock-in' : 'Wastage'));
      })();
      return json(db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(params.id));
    },
  })),
  {
    method: 'PATCH', path: '/api/inventory/:id', auth: 'admin',
    handler: ({ params, body }) => {
      if (!db.prepare(`SELECT id FROM ingredients WHERE id=?`).get(params.id)) return notFound();
      const fields: string[] = []; const vals: any[] = [];
      for (const k of ['name', 'unit', 'min_threshold', 'cost_per_unit']) if (body?.[k] !== undefined) { fields.push(`${k}=?`); vals.push(body[k]); }
      if (fields.length) { fields.push('updated_at=CURRENT_TIMESTAMP'); vals.push(params.id); db.prepare(`UPDATE ingredients SET ${fields.join(',')} WHERE id=?`).run(...vals); }
      return json(db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(params.id));
    },
  },
  {
    method: 'GET', path: '/api/stock-logs', auth: 'admin',
    handler: ({ url }) => {
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500);
      const type = url.searchParams.get('type');
      return json(type
        ? db.prepare(`SELECT sl.*, i.name AS ingredient_name FROM stock_logs sl JOIN ingredients i ON i.id=sl.ingredient_id WHERE sl.change_type=? ORDER BY sl.created_at DESC LIMIT ?`).all(type, limit)
        : db.prepare(`SELECT sl.*, i.name AS ingredient_name FROM stock_logs sl JOIN ingredients i ON i.id=sl.ingredient_id ORDER BY sl.created_at DESC LIMIT ?`).all(limit));
    },
  },

  // ----- audits (admin) -----
  {
    method: 'GET', path: '/api/audits', auth: 'admin',
    handler: ({ url }) => {
      const date = url.searchParams.get('date');
      const base = `SELECT da.*, i.name AS ingredient_name, i.unit FROM daily_audits da JOIN ingredients i ON i.id=da.ingredient_id`;
      return json(date ? db.prepare(`${base} WHERE da.audit_date=? ORDER BY i.name`).all(date) : db.prepare(`${base} ORDER BY da.audit_date DESC, i.name`).all());
    },
  },
  {
    method: 'POST', path: '/api/audits', auth: 'admin',
    handler: ({ body }) => auditEntries(body?.auditDate, [{ ingredientId: body?.ingredientId, physicalActualStock: body?.physicalActualStock, notes: body?.notes }], false),
  },
  {
    method: 'POST', path: '/api/audits/bulk', auth: 'admin',
    handler: ({ body }) => auditEntries(body?.auditDate, Array.isArray(body?.entries) ? body.entries : [], true),
  },

  // ----- reports / analytics -----
  {
    method: 'GET', path: '/api/analytics/daily', auth: 'staff',
    handler: ({ url, user }) => {
      const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
      const own = user!.role === 'STALL_OWNER';
      const f = own ? ` AND stall_id=?` : '';
      const f2 = own ? ` AND o.stall_id=?` : '';
      const p = own ? [date, user!.stall_id] : [date];
      return json({
        date,
        revenue: db.prepare(`SELECT COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS orderCount FROM orders WHERE date(created_at)=date(?) AND status!='CANCELLED'${f}`).get(...p),
        topItems: db.prepare(`SELECT mi.name, SUM(oi.quantity) AS qty, SUM(oi.subtotal) AS revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN menu_items mi ON mi.id=oi.menu_item_id WHERE date(o.created_at)=date(?) AND o.status!='CANCELLED'${f2} GROUP BY mi.id ORDER BY qty DESC LIMIT 5`).all(...p),
        hourly: db.prepare(`SELECT strftime('%H', created_at) AS hour, COUNT(*) AS orders, SUM(total_amount) AS revenue FROM orders WHERE date(created_at)=date(?) AND status!='CANCELLED'${f} GROUP BY hour ORDER BY hour`).all(...p),
        stall: own ? user!.stall_id : 'all',
      });
    },
  },
  {
    method: 'GET', path: '/api/reports/summary', auth: 'admin',
    handler: ({ url }) => {
      const from = url.searchParams.get('from') || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const to = url.searchParams.get('to') || new Date().toISOString().slice(0, 10);
      return json({
        from, to,
        daily: db.prepare(`SELECT date(created_at) AS day, COUNT(*) AS orders, SUM(total_amount) AS revenue FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?) AND status!='CANCELLED' GROUP BY day ORDER BY day`).all(from, to),
        monthly: db.prepare(`SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS orders, SUM(total_amount) AS revenue FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?) AND status!='CANCELLED' GROUP BY month ORDER BY month`).all(from, to),
        lowStocks: db.prepare(`SELECT * FROM ingredients WHERE current_stock <= min_threshold ORDER BY current_stock`).all(),
        totalIngredientsValue: db.prepare(`SELECT SUM(current_stock * cost_per_unit) AS value FROM ingredients`).get(),
      });
    },
  },

  // ----- orders -----
  {
    method: 'POST', path: '/api/orders', auth: 'public',
    handler: ({ body }) => {
      const stallId = body?.stallId;
      const lines = body?.items;
      if (!stallId || !Array.isArray(lines) || !lines.length) return bad('stallId and items required');
      if (lines.length > 50) return bad('Too many items');
      if (!db.prepare(`SELECT id FROM stalls WHERE id=? AND is_active=1`).get(stallId)) return notFound('Stall not found');
      let total = 0;
      const enriched: any[] = [];
      for (const it of lines) {
        if (!isPosInt(it?.quantity, 50)) return bad('quantity must be a whole number from 1 to 50');
        const mi = db.prepare(`SELECT id, price, is_available, stall_id FROM menu_items WHERE id=?`).get(it.menuItemId) as any;
        if (!mi) return notFound(`Menu item ${it.menuItemId} not found`);
        if (!mi.is_available) return bad(`Item ${it.menuItemId} not available`);
        if (mi.stall_id !== stallId) return bad('All items must be from the same stall');
        let unitPrice = mi.price; let variantId: string | null = null; let variantName: string | null = null;
        if (it.variantId) {
          const v = db.prepare(`SELECT * FROM item_variants WHERE id=? AND menu_item_id=?`).get(it.variantId, it.menuItemId) as any;
          if (!v) return notFound(`Variant ${it.variantId} not found`);
          if (!v.is_available) return bad(`Variant ${v.name} not available`);
          unitPrice = v.price; variantId = v.id; variantName = v.name;
        }
        const subtotal = unitPrice * it.quantity;
        total += subtotal;
        enriched.push({ menuItemId: it.menuItemId, variantId, variantName, quantity: it.quantity, unitPrice, subtotal });
      }
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const code = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      let pickupCode = code();
      for (let i = 0; i < 20 && db.prepare(`SELECT id FROM orders WHERE pickup_code=?`).get(pickupCode); i++) pickupCode = code();
      const id = randomUUID();
      const now = new Date().toISOString();
      db.transaction(() => {
        db.prepare(`INSERT INTO orders (id, pickup_code, stall_id, total_amount, status, customer_notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`)
          .run(id, pickupCode, stallId, total, 'PENDING_PAYMENT', str(body?.customerNotes) || null, now, now);
        const ins = db.prepare(`INSERT INTO order_items (id, order_id, menu_item_id, variant_id, variant_name, quantity, unit_price, subtotal) VALUES (?,?,?,?,?,?,?,?)`);
        for (const e of enriched) ins.run(randomUUID(), id, e.menuItemId, e.variantId, e.variantName, e.quantity, e.unitPrice, e.subtotal);
      })();
      return json(orderWithItems(id), 201);
    },
  },
  {
    method: 'GET', path: '/api/orders', auth: 'staff',
    handler: ({ url, user }) => {
      let sql = `SELECT * FROM orders WHERE 1=1`;
      const p: any[] = [];
      const stallId = user!.role === 'STALL_OWNER' ? user!.stall_id : url.searchParams.get('stallId');
      if (stallId) { sql += ` AND stall_id=?`; p.push(stallId); }
      const status = url.searchParams.get('status');
      if (status) { sql += ` AND status=?`; p.push(status); }
      const q = url.searchParams.get('q');
      if (q) { sql += ` AND pickup_code LIKE ?`; p.push(`%${q.toUpperCase()}%`); }
      sql += ` ORDER BY created_at DESC LIMIT ?`;
      p.push(Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200));
      return json(db.prepare(sql).all(...p));
    },
  },
  {
    method: 'GET', path: '/api/orders/by-code/:code', auth: 'staff',
    handler: ({ params, user }) => {
      const code = params.code.toUpperCase();
      const order = db.prepare(`SELECT id, stall_id FROM orders WHERE pickup_code=?`).get(code) as any;
      if (!order || !canManageStall(user, order.stall_id)) return notFound(`No order with code ${code}`);
      return json(orderWithItems(order.id));
    },
  },
  {
    // Public on purpose: customers track their own order by its unguessable UUID (never by pickup code).
    method: 'GET', path: '/api/orders/:id', auth: 'public',
    handler: ({ params, user }) => {
      const data = orderWithItems(params.id);
      if (!data) return notFound('Order not found');
      if (user?.role === 'STALL_OWNER' && data.order.stall_id !== user.stall_id) return forbidden('Forbidden for this stall');
      return json(data);
    },
  },
  {
    method: 'PATCH', path: '/api/orders/:id/status', auth: 'staff',
    handler: ({ params, body, user }) => {
      const next = body?.status;
      const allowed: Record<string, string[]> = {
        PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['PREPARING', 'CANCELLED'],
        PREPARING: ['READY', 'CANCELLED'], READY: ['COMPLETED', 'CANCELLED'], COMPLETED: [], CANCELLED: [],
      };
      if (!Object.keys(allowed).includes(next)) return bad(`status must be one of ${Object.keys(allowed).join(', ')}`);
      const order = db.prepare(`SELECT * FROM orders WHERE id=?`).get(params.id) as any;
      if (!order) return notFound('Order not found');
      if (!canManageStall(user, order.stall_id)) return forbidden();
      if (!allowed[order.status].includes(next)) return bad(`Invalid transition ${order.status} -> ${next}`);
      const items = (db.prepare(`SELECT menu_item_id, quantity FROM order_items WHERE order_id=?`).all(params.id) as any[])
        .map((i) => ({ menuItemId: i.menu_item_id, quantity: i.quantity }));
      try {
        db.transaction(() => {
          if (order.status === 'PENDING_PAYMENT' && next === 'CONFIRMED') bom.deductBomTransaction(params.id, items);
          if (next === 'CANCELLED' && ['CONFIRMED', 'PREPARING', 'READY'].includes(order.status)) bom.rollbackBomTransaction(params.id, items);
          db.prepare(`UPDATE orders SET status=?, updated_at=? WHERE id=?`).run(next, new Date().toISOString(), params.id);
        })();
      } catch (e: any) {
        return json({ error: 'Not enough stock', details: e.message }, 409);
      }
      return json(db.prepare(`SELECT * FROM orders WHERE id=?`).get(params.id));
    },
  },
];

function auditEntries(auditDate: unknown, entries: any[], bulk: boolean) {
  if (typeof auditDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(auditDate)) return bad('auditDate (YYYY-MM-DD) required');
  if (!entries.length) return bad('entries required');
  const results: any[] = [];
  try {
    db.transaction(() => {
      for (const e of entries) {
        const actual = num(e?.physicalActualStock);
        if (!(actual >= 0)) throw new Error('physicalActualStock must be 0 or more');
        const ing = db.prepare(`SELECT current_stock FROM ingredients WHERE id=?`).get(e?.ingredientId) as any;
        if (!ing) throw new Error(`Ingredient ${e?.ingredientId} not found`);
        const variance = actual - ing.current_stock;
        const id = randomUUID();
        db.prepare(`INSERT INTO daily_audits (id, audit_date, ingredient_id, system_expected_stock, physical_actual_stock, variance, notes) VALUES (?,?,?,?,?,?,?)`)
          .run(id, auditDate, e.ingredientId, ing.current_stock, actual, variance, str(e?.notes) || null);
        if (variance !== 0) {
          db.prepare(`UPDATE ingredients SET current_stock=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(actual, e.ingredientId);
          db.prepare(`INSERT INTO stock_logs (id, ingredient_id, change_type, quantity_delta, reason) VALUES (?,?,?,?,?)`)
            .run(randomUUID(), e.ingredientId, 'AUDIT_ADJUSTMENT', variance, `EOD audit ${auditDate}`);
        }
        results.push(db.prepare(`SELECT * FROM daily_audits WHERE id=?`).get(id));
      }
    })();
  } catch (e: any) {
    if (String(e.message).includes('UNIQUE')) return json({ error: 'An audit for this ingredient and date already exists' }, 409);
    return bad(e.message);
  }
  return json(bulk ? results : results[0], 201);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
const compiled = routes.map((r) => {
  const keys: string[] = [];
  const re = new RegExp('^' + r.path.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  return { ...r, re, keys };
});

async function readBody(req: Request) {
  if (req.method === 'GET' || req.method === 'DELETE') return null;
  try { const b = await req.json(); return b && typeof b === 'object' ? b : null; } catch { return null; }
}

export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method === 'PUT' ? 'PATCH' : req.method;
  let match: (typeof compiled)[number] | undefined;
  let params: Record<string, string> = {};
  for (const r of compiled) {
    if (r.method !== method) continue;
    const m = r.re.exec(url.pathname);
    if (m) { match = r; params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])); break; }
  }
  if (!match) return notFound(`${method} ${url.pathname} not found`);

  const token = getBearerToken(req);
  const user = getSessionUser(db, token);
  if (match.auth !== 'public') {
    if (!user) return json({ error: 'Login required' }, 401);
    if (user.must_change_password && !match.allowPendingPasswordChange) {
      return json({ error: 'You must change your password first', code: 'PASSWORD_CHANGE_REQUIRED' }, 403);
    }
    if (match.auth === 'admin' && user.role !== 'ADMIN') return forbidden('Admin only');
  }

  try {
    return await match.handler({ req, url, params, body: await readBody(req), user, token });
  } catch (e: any) {
    console.error(`[API] ${method} ${url.pathname} failed:`, e?.message);
    return json({ error: 'Internal server error' }, 500);
  }
}
