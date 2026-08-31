import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { requireAuth, requireAdmin, getAuthUser, canManageStall } from '../middleware/auth.js';

export const menuRouter = Router();

// ============ PUBLIC READS (no auth needed — Kiosk must work without login) ============

// GET /api/stalls
menuRouter.get('/stalls', (req, res) => {
  const stalls = db.prepare(`SELECT * FROM stalls WHERE is_active=1`).all();
  res.json(stalls);
});

// GET /api/menu?stallId=...&categoryId=...&includeUnavailable=1
menuRouter.get('/menu', (req, res) => {
  const { stallId, categoryId } = req.query as any;
  const includeUnavailable = req.query.includeUnavailable === '1' || req.query.includeUnavailable === 'true';
  let sql = `SELECT mi.*, c.name as category_name, s.name as stall_name
             FROM menu_items mi
             JOIN categories c ON c.id = mi.category_id
             JOIN stalls s ON s.id = mi.stall_id
             WHERE 1=1`;
  const params: any[] = [];
  if (!includeUnavailable) { sql += ` AND mi.is_available=1`; }
  if (stallId) { sql += ` AND mi.stall_id = ?`; params.push(stallId); }
  if (categoryId) { sql += ` AND mi.category_id = ?`; params.push(categoryId); }
  sql += ` ORDER BY c.display_order, mi.name`;
  const items = db.prepare(sql).all(...params);
  res.json(items);
});

// GET /api/menu/:id/detail (with BOM breakdown)
menuRouter.get('/menu/:id/detail', (req, res) => {
  const item = db.prepare(`SELECT * FROM menu_items WHERE id=?`).get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const bom = db.prepare(`
    SELECT rb.quantity_required, i.id as ingredient_id, i.name, i.unit, i.current_stock
    FROM recipe_bom rb JOIN ingredients i ON i.id=rb.ingredient_id
    WHERE rb.menu_item_id=?
  `).all(req.params.id);
  res.json({ item, bom });
});

// GET /api/categories?stallId=...
menuRouter.get('/categories', (req, res) => {
  const { stallId } = req.query as any;
  let sql = `SELECT * FROM categories`;
  const params: any[] = [];
  if (stallId) { sql += ` WHERE stall_id=?`; params.push(stallId); }
  sql += ` ORDER BY display_order`;
  res.json(db.prepare(sql).all(...params));
});

// GET /api/ingredients (public for now, but admin uses it)
menuRouter.get('/ingredients', (req, res) => {
  const ings = db.prepare(`SELECT * FROM ingredients ORDER BY name`).all();
  res.json(ings);
});

// ============ PROTECTED WRITES (Hybrid: ADMIN all, STALL_OWNER own stall only) ============

// Helper to enforce stall ownership
function enforceStallAccess(req: any, res: any, stallId: string): boolean {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: 'Login required (x-user-id header)' }); return false; }
  if (!canManageStall(user, stallId)) {
    res.status(403).json({ error: `Forbidden: stall ${stallId} not owned by user ${user.username} (${user.role})` });
    return false;
  }
  req.user = user;
  return true;
}

// ---- STALLS ---- (ADMIN only)
menuRouter.post('/stalls', requireAuth, requireAdmin, (req, res) => {
  const schema = z.object({ id: z.string().optional(), name: z.string().min(1), description: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const id = parsed.data.id || `stall-${uuidv4().slice(0, 6)}`;
  try {
    db.prepare(`INSERT INTO stalls (id, name, description) VALUES (?,?,?)`).run(id, parsed.data.name, parsed.data.description || null);
    res.status(201).json(db.prepare(`SELECT * FROM stalls WHERE id=?`).get(id));
  } catch (e: any) { res.status(409).json({ error: e.message }); }
});

menuRouter.patch('/stalls/:id', requireAuth, requireAdmin, (req, res) => {
  const existing = db.prepare(`SELECT * FROM stalls WHERE id=?`).get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Stall not found' });
  const schema = z.object({ name: z.string().min(1).optional(), description: z.string().optional(), is_active: z.number().int().min(0).max(1).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const fields: string[] = []; const vals: any[] = [];
  for (const [k, v] of Object.entries(parsed.data)) { fields.push(`${k}=?`); vals.push(v); }
  if (fields.length === 0) return res.json(existing);
  vals.push(req.params.id);
  db.prepare(`UPDATE stalls SET ${fields.join(',')} WHERE id=?`).run(...vals);
  res.json(db.prepare(`SELECT * FROM stalls WHERE id=?`).get(req.params.id));
});

menuRouter.delete('/stalls/:id', requireAuth, requireAdmin, (req, res) => {
  const info = db.prepare(`DELETE FROM stalls WHERE id=?`).run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Stall not found' });
  res.json({ ok: true });
});

// ---- CATEGORIES ---- (ADMIN any stall, STALL_OWNER own stall)
menuRouter.post('/categories', requireAuth, (req, res) => {
  const schema = z.object({ stallId: z.string().min(1), name: z.string().min(1), displayOrder: z.number().int().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  if (!enforceStallAccess(req, res, parsed.data.stallId)) return;
  const id = `cat-${uuidv4().slice(0, 6)}`;
  try {
    db.prepare(`INSERT INTO categories (id, stall_id, name, display_order) VALUES (?,?,?,?)`)
      .run(id, parsed.data.stallId, parsed.data.name, parsed.data.displayOrder ?? 0);
    res.status(201).json(db.prepare(`SELECT * FROM categories WHERE id=?`).get(id));
  } catch (e: any) { res.status(409).json({ error: e.message }); }
});

menuRouter.patch('/categories/:id', requireAuth, (req, res) => {
  const existing = db.prepare(`SELECT * FROM categories WHERE id=?`).get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Category not found' });
  if (!enforceStallAccess(req, res, existing.stall_id)) return;
  const schema = z.object({ name: z.string().min(1).optional(), displayOrder: z.number().int().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const fields: string[] = []; const vals: any[] = [];
  if (parsed.data.name !== undefined) { fields.push('name=?'); vals.push(parsed.data.name); }
  if (parsed.data.displayOrder !== undefined) { fields.push('display_order=?'); vals.push(parsed.data.displayOrder); }
  if (fields.length === 0) return res.json(existing);
  vals.push(req.params.id);
  db.prepare(`UPDATE categories SET ${fields.join(',')} WHERE id=?`).run(...vals);
  res.json(db.prepare(`SELECT * FROM categories WHERE id=?`).get(req.params.id));
});

menuRouter.delete('/categories/:id', requireAuth, (req, res) => {
  const existing = db.prepare(`SELECT * FROM categories WHERE id=?`).get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Category not found' });
  if (!enforceStallAccess(req, res, existing.stall_id)) return;
  // Prevent delete if menu items exist
  const count = (db.prepare(`SELECT COUNT(*) as c FROM menu_items WHERE category_id=?`).get(req.params.id) as any).c;
  if (count > 0) return res.status(409).json({ error: `Category has ${count} menu items, move/delete them first` });
  db.prepare(`DELETE FROM categories WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

// ---- MENU ITEMS ---- (ADMIN any stall, STALL_OWNER own stall)
menuRouter.post('/menu', requireAuth, (req, res) => {
  const schema = z.object({
    stallId: z.string().min(1),
    categoryId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    price: z.number().nonnegative(),
    imageUrl: z.string().optional().nullable(),
    isAvailable: z.number().int().min(0).max(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const d = parsed.data;
  if (!enforceStallAccess(req, res, d.stallId)) return;
  // Validate category belongs to same stall
  const cat = db.prepare(`SELECT * FROM categories WHERE id=?`).get(d.categoryId) as any;
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  if (cat.stall_id !== d.stallId) return res.status(400).json({ error: 'Category does not belong to stall ' + d.stallId });
  const id = `item-${uuidv4().slice(0, 8)}`;
  try {
    db.prepare(`INSERT INTO menu_items (id, stall_id, category_id, name, description, price, image_url, is_available) VALUES (?,?,?,?,?,?,?,?)`)
      .run(id, d.stallId, d.categoryId, d.name, d.description || null, d.price, d.imageUrl || null, d.isAvailable ?? 1);
    res.status(201).json(db.prepare(`SELECT * FROM menu_items WHERE id=?`).get(id));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

menuRouter.patch('/menu/:id', requireAuth, (req, res) => {
  const existing = db.prepare(`SELECT * FROM menu_items WHERE id=?`).get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Menu item not found' });
  if (!enforceStallAccess(req, res, existing.stall_id)) return;
  const schema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    price: z.number().nonnegative().optional(),
    categoryId: z.string().optional(),
    imageUrl: z.string().optional().nullable(),
    isAvailable: z.number().int().min(0).max(1).optional(),
    stallId: z.string().optional(), // allow moving stall (ADMIN only normally)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  // If moving stall, check new stall access
  if (parsed.data.stallId && parsed.data.stallId !== existing.stall_id) {
    if (!enforceStallAccess(req, res, parsed.data.stallId)) return;
  }
  // If changing category, validate
  if (parsed.data.categoryId) {
    const cat = db.prepare(`SELECT * FROM categories WHERE id=?`).get(parsed.data.categoryId) as any;
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    const targetStall = parsed.data.stallId || existing.stall_id;
    if (cat.stall_id !== targetStall) return res.status(400).json({ error: 'Category does not belong to target stall' });
  }
  const map: Record<string, string> = { name: 'name', description: 'description', price: 'price', categoryId: 'category_id', imageUrl: 'image_url', isAvailable: 'is_available', stallId: 'stall_id' };
  const fields: string[] = []; const vals: any[] = [];
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) { fields.push(`${map[k]}=?`); vals.push(v); }
  }
  if (fields.length === 0) return res.json(existing);
  vals.push(req.params.id);
  db.prepare(`UPDATE menu_items SET ${fields.join(',')} WHERE id=?`).run(...vals);
  res.json(db.prepare(`SELECT * FROM menu_items WHERE id=?`).get(req.params.id));
});

menuRouter.delete('/menu/:id', requireAuth, (req, res) => {
  const existing = db.prepare(`SELECT * FROM menu_items WHERE id=?`).get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Menu item not found' });
  if (!enforceStallAccess(req, res, existing.stall_id)) return;
  db.prepare(`DELETE FROM menu_items WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});
