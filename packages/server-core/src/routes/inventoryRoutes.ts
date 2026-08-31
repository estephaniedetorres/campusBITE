import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { requireAuth, requireAdmin, getAuthUser, canManageStall } from '../middleware/auth.js';

export const inventoryRouter = Router();

// GET /api/inventory - all ingredients with low-stock flag
inventoryRouter.get('/inventory', (req, res) => {
  const rows = db.prepare(`
    SELECT *, 
      CASE WHEN current_stock <= min_threshold THEN 1 ELSE 0 END as is_low
    FROM ingredients ORDER BY is_low DESC, name
  `).all();
  res.json(rows);
});

// GET /api/inventory/:id
inventoryRouter.get('/inventory/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Ingredient not found' });
  res.json(row);
});

// POST /api/inventory - create ingredient (ADMIN only)
const createIngSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  unit: z.enum(['g', 'kg', 'ml', 'L', 'pcs']),
  current_stock: z.number().nonnegative().default(0),
  min_threshold: z.number().nonnegative().default(10),
  cost_per_unit: z.number().nonnegative().default(0),
});
inventoryRouter.post('/inventory', requireAuth, requireAdmin, (req, res) => {
  const parsed = createIngSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const d = parsed.data;
  const id = d.id || `ing-${uuidv4().slice(0, 8)}`;
  try {
    db.prepare(`INSERT INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES (?,?,?,?,?,?)`)
      .run(id, d.name, d.unit, d.current_stock, d.min_threshold, d.cost_per_unit);
    res.status(201).json(db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(id));
  } catch (e: any) {
    res.status(409).json({ error: e.message });
  }
});

// PATCH /api/inventory/:id  (update thresholds/cost/name) ADMIN only
inventoryRouter.patch('/inventory/:id', requireAuth, requireAdmin, (req, res) => {
  const existing = db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const schema = z.object({
    name: z.string().min(1).optional(),
    unit: z.enum(['g', 'kg', 'ml', 'L', 'pcs']).optional(),
    min_threshold: z.number().nonnegative().optional(),
    cost_per_unit: z.number().nonnegative().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const fields: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(parsed.data)) { fields.push(`${k}=?`); vals.push(v); }
  if (fields.length === 0) return res.json(existing);
  fields.push(`updated_at=CURRENT_TIMESTAMP`);
  vals.push(req.params.id);
  db.prepare(`UPDATE ingredients SET ${fields.join(',')} WHERE id=?`).run(...vals);
  res.json(db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(req.params.id));
});

// POST /api/inventory/:id/stock-in  { quantity, reason } ADMIN only
inventoryRouter.post('/inventory/:id/stock-in', requireAuth, requireAdmin, (req, res) => {
  const schema = z.object({ quantity: z.number().positive(), reason: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const ing = db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(req.params.id) as any;
  if (!ing) return res.status(404).json({ error: 'Ingredient not found' });

  const tx = db.transaction(() => {
    db.prepare(`UPDATE ingredients SET current_stock = current_stock + ?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(parsed.data.quantity, req.params.id);
    db.prepare(`INSERT INTO stock_logs (id, ingredient_id, change_type, quantity_delta, reason) VALUES (?,?,?,?,?)`)
      .run(uuidv4(), req.params.id, 'STOCK_IN', parsed.data.quantity, parsed.data.reason || 'Manual stock-in');
  });
  tx();
  const updated = db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(req.params.id);
  res.json(updated);
});

// POST /api/inventory/:id/stock-out  (wastage) ADMIN only
inventoryRouter.post('/inventory/:id/stock-out', requireAuth, requireAdmin, (req, res) => {
  const schema = z.object({ quantity: z.number().positive(), reason: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const ing = db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(req.params.id) as any;
  if (!ing) return res.status(404).json({ error: 'Not found' });
  if (ing.current_stock < parsed.data.quantity) {
    return res.status(409).json({ error: `Insufficient stock: have ${ing.current_stock}, need ${parsed.data.quantity}` });
  }
  const tx = db.transaction(() => {
    db.prepare(`UPDATE ingredients SET current_stock = current_stock - ?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(parsed.data.quantity, req.params.id);
    db.prepare(`INSERT INTO stock_logs (id, ingredient_id, change_type, quantity_delta, reason) VALUES (?,?,?,?,?)`)
      .run(uuidv4(), req.params.id, 'WASTAGE', -parsed.data.quantity, parsed.data.reason || 'Wastage');
  });
  tx();
  res.json(db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(req.params.id));
});

// GET /api/inventory/:id/logs?limit=50
inventoryRouter.get('/inventory/:id/logs', (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const logs = db.prepare(`SELECT * FROM stock_logs WHERE ingredient_id=? ORDER BY created_at DESC LIMIT ?`).all(req.params.id, limit);
  res.json(logs);
});

// GET /api/recipe-bom?menuItemId=...
inventoryRouter.get('/recipe-bom', (req, res) => {
  const { menuItemId } = req.query as any;
  if (menuItemId) {
    const rows = db.prepare(`
      SELECT rb.*, i.name as ingredient_name, i.unit, i.current_stock
      FROM recipe_bom rb JOIN ingredients i ON i.id=rb.ingredient_id
      WHERE rb.menu_item_id=?`).all(menuItemId);
    return res.json(rows);
  }
  const all = db.prepare(`
    SELECT rb.*, i.name as ingredient_name, mi.name as menu_item_name
    FROM recipe_bom rb JOIN ingredients i ON i.id=rb.ingredient_id JOIN menu_items mi ON mi.id=rb.menu_item_id
    ORDER BY mi.name`).all();
  res.json(all);
});

// POST /api/recipe-bom  { menuItemId, ingredientId, quantityRequired } — ADMIN any, STALL_OWNER own stall's items
inventoryRouter.post('/recipe-bom', requireAuth, (req, res) => {
  const schema = z.object({ menuItemId: z.string(), ingredientId: z.string(), quantityRequired: z.number().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  // Enforce ownership via menu_item's stall
  const menuItem = db.prepare(`SELECT stall_id FROM menu_items WHERE id=?`).get(parsed.data.menuItemId) as any;
  if (!menuItem) return res.status(404).json({ error: 'Menu item not found' });
  const user = getAuthUser(req);
  if (!user || !canManageStall(user, menuItem.stall_id)) return res.status(403).json({ error: 'Forbidden for this stall' });
  try {
    const id = uuidv4();
    db.prepare(`INSERT INTO recipe_bom (id, menu_item_id, ingredient_id, quantity_required) VALUES (?,?,?,?)`)
      .run(id, parsed.data.menuItemId, parsed.data.ingredientId, parsed.data.quantityRequired);
    res.status(201).json(db.prepare(`SELECT * FROM recipe_bom WHERE id=?`).get(id));
  } catch (e: any) {
    res.status(409).json({ error: e.message });
  }
});

// DELETE /api/recipe-bom/:id — same ownership check
inventoryRouter.delete('/recipe-bom/:id', requireAuth, (req, res) => {
  const existing = db.prepare(`SELECT rb.*, mi.stall_id FROM recipe_bom rb JOIN menu_items mi ON mi.id=rb.menu_item_id WHERE rb.id=?`).get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const user = getAuthUser(req);
  if (!user || !canManageStall(user, existing.stall_id)) return res.status(403).json({ error: 'Forbidden for this stall' });
  const info = db.prepare(`DELETE FROM recipe_bom WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

// GET /api/stock-logs?limit=100&type=
inventoryRouter.get('/stock-logs', (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const type = req.query.type as string | undefined;
  let sql = `SELECT sl.*, i.name as ingredient_name FROM stock_logs sl JOIN ingredients i ON i.id=sl.ingredient_id`;
  const params: any[] = [];
  if (type) { sql += ` WHERE sl.change_type=?`; params.push(type); }
  sql += ` ORDER BY sl.created_at DESC LIMIT ?`; params.push(limit);
  res.json(db.prepare(sql).all(...params));
});
