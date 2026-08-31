import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const auditRouter = Router();

// GET /api/audits?date=YYYY-MM-DD  ADMIN only (hybrid: only manager does EOD)
auditRouter.get('/audits', requireAuth, requireAdmin, (req, res) => {
  const date = req.query.date as string | undefined;
  let sql = `SELECT da.*, i.name as ingredient_name, i.unit FROM daily_audits da JOIN ingredients i ON i.id=da.ingredient_id`;
  const params: any[] = [];
  if (date) { sql += ` WHERE da.audit_date=?`; params.push(date); }
  sql += ` ORDER BY da.audit_date DESC, i.name`;
  res.json(db.prepare(sql).all(...params));
});

// POST /api/audits  { auditDate, ingredientId, physicalActualStock, notes? } ADMIN only
// Automatically computes system_expected_stock and variance
auditRouter.post('/audits', requireAuth, requireAdmin, (req, res) => {
  const schema = z.object({
    auditDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ingredientId: z.string(),
    physicalActualStock: z.number().nonnegative(),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const { auditDate, ingredientId, physicalActualStock, notes } = parsed.data;

  const ing = db.prepare(`SELECT current_stock FROM ingredients WHERE id=?`).get(ingredientId) as any;
  if (!ing) return res.status(404).json({ error: 'Ingredient not found' });

  const systemExpected = ing.current_stock;
  const variance = physicalActualStock - systemExpected;
  const id = uuidv4();

  try {
    const tx = db.transaction(() => {
      db.prepare(`INSERT INTO daily_audits (id, audit_date, ingredient_id, system_expected_stock, physical_actual_stock, variance, notes)
                  VALUES (?,?,?,?,?,?,?)`)
        .run(id, auditDate, ingredientId, systemExpected, physicalActualStock, variance, notes || null);
      // Apply adjustment to align system to physical count
      if (variance !== 0) {
        db.prepare(`UPDATE ingredients SET current_stock=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .run(physicalActualStock, ingredientId);
        db.prepare(`INSERT INTO stock_logs (id, ingredient_id, change_type, quantity_delta, reason) VALUES (?,?,?,?,?)`)
          .run(uuidv4(), ingredientId, 'AUDIT_ADJUSTMENT', variance, `EOD audit ${auditDate} variance ${variance}`);
      }
    });
    tx();
    res.status(201).json(db.prepare(`SELECT * FROM daily_audits WHERE id=?`).get(id));
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Audit already exists for this ingredient on this date' });
    res.status(500).json({ error: e.message });
  }
});

// POST /api/audits/bulk  { auditDate, entries: [{ingredientId, physicalActualStock, notes?}] } ADMIN only
auditRouter.post('/audits/bulk', requireAuth, requireAdmin, (req, res) => {
  const schema = z.object({
    auditDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    entries: z.array(z.object({
      ingredientId: z.string(),
      physicalActualStock: z.number().nonnegative(),
      notes: z.string().optional(),
    })).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const { auditDate, entries } = parsed.data;

  const results: any[] = [];
  const tx = db.transaction(() => {
    for (const e of entries) {
      const ing = db.prepare(`SELECT current_stock FROM ingredients WHERE id=?`).get(e.ingredientId) as any;
      if (!ing) throw new Error(`Ingredient ${e.ingredientId} not found`);
      const variance = e.physicalActualStock - ing.current_stock;
      const id = uuidv4();
      db.prepare(`INSERT INTO daily_audits (id, audit_date, ingredient_id, system_expected_stock, physical_actual_stock, variance, notes)
                  VALUES (?,?,?,?,?,?,?)`)
        .run(id, auditDate, e.ingredientId, ing.current_stock, e.physicalActualStock, variance, e.notes || null);
      if (variance !== 0) {
        db.prepare(`UPDATE ingredients SET current_stock=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(e.physicalActualStock, e.ingredientId);
        db.prepare(`INSERT INTO stock_logs (id, ingredient_id, change_type, quantity_delta, reason) VALUES (?,?,?,?,?)`)
          .run(uuidv4(), e.ingredientId, 'AUDIT_ADJUSTMENT', variance, `EOD bulk audit ${auditDate}`);
      }
      results.push(db.prepare(`SELECT * FROM daily_audits WHERE id=?`).get(id));
    }
  });
  try {
    tx();
    res.status(201).json(results);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD  ADMIN only
auditRouter.get('/reports/summary', requireAuth, requireAdmin, (req, res) => {
  const from = req.query.from as string || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const to = req.query.to as string || new Date().toISOString().slice(0, 10);

  const daily = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as orders, SUM(total_amount) as revenue
    FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?) AND status != 'CANCELLED'
    GROUP BY day ORDER BY day
  `).all(from, to);

  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as orders, SUM(total_amount) as revenue
    FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?) AND status != 'CANCELLED'
    GROUP BY month ORDER BY month
  `).all(from, to);

  const lowStocks = db.prepare(`SELECT * FROM ingredients WHERE current_stock <= min_threshold ORDER BY current_stock`).all();

  const totalIngredientsValue = db.prepare(`SELECT SUM(current_stock * cost_per_unit) as value FROM ingredients`).get();

  res.json({ from, to, daily, monthly, lowStocks, totalIngredientsValue });
});
