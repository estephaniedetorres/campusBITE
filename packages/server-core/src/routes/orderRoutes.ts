import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { deductBomTransaction, rollbackBomTransaction } from '../db/bomEngine.js';
import { getAuthUser, requireAuth, canManageStall } from '../middleware/auth.js';
import type { WSGateway } from '../ws/gateway.js';

export function createOrderRouter(wsGateway: WSGateway) {
  const router = Router();

  // Helper: generate short pickup code: e.g., A3X9
  function genPickupCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid ambiguous 0/O 1/I
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  const createOrderSchema = z.object({
    stallId: z.string().min(1),
    items: z.array(z.object({ menuItemId: z.string(), quantity: z.number().int().positive() })).min(1),
    customerNotes: z.string().optional(),
  });

  // POST /api/orders  (Student Kiosk checkout)
  router.post('/orders', (req, res) => {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

    const { stallId, items, customerNotes } = parsed.data;

    // Validate stall exists
    const stall = db.prepare(`SELECT id FROM stalls WHERE id=?`).get(stallId);
    if (!stall) return res.status(404).json({ error: 'Stall not found' });

    // Compute total + validate items availability + fetch prices
    let total = 0;
    const enriched: { menuItemId: string; quantity: number; unitPrice: number; subtotal: number }[] = [];
    for (const it of items) {
      const menuItem = db.prepare(`SELECT id, price, is_available FROM menu_items WHERE id=?`).get(it.menuItemId) as any;
      if (!menuItem) return res.status(404).json({ error: `Menu item ${it.menuItemId} not found` });
      if (!menuItem.is_available) return res.status(400).json({ error: `Item ${it.menuItemId} not available` });
      const subtotal = menuItem.price * it.quantity;
      total += subtotal;
      enriched.push({ menuItemId: it.menuItemId, quantity: it.quantity, unitPrice: menuItem.price, subtotal });
    }

    // Generate unique pickup code (retry if collision)
    let pickupCode = genPickupCode();
    for (let i = 0; i < 5; i++) {
      const exists = db.prepare(`SELECT id FROM orders WHERE pickup_code=?`).get(pickupCode);
      if (!exists) break;
      pickupCode = genPickupCode();
    }

    const orderId = uuidv4();
    const now = new Date().toISOString();

    // Transaction: insert order + items
    const createTx = db.transaction(() => {
      db.prepare(`INSERT INTO orders (id, pickup_code, stall_id, total_amount, status, customer_notes, created_at, updated_at)
                  VALUES (?,?,?,?,?,?,?,?)`)
        .run(orderId, pickupCode, stallId, total, 'PENDING_PAYMENT', customerNotes || null, now, now);
      for (const e of enriched) {
        db.prepare(`INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price, subtotal)
                    VALUES (?,?,?,?,?,?)`)
          .run(uuidv4(), orderId, e.menuItemId, e.quantity, e.unitPrice, e.subtotal);
      }
    });
    createTx();

    const order = db.prepare(`SELECT * FROM orders WHERE id=?`).get(orderId);
    const orderItems = db.prepare(`SELECT * FROM order_items WHERE order_id=?`).all(orderId);

    wsGateway.notifyNewOrder({ ...order as object, items: orderItems });

    res.status(201).json({ order, items: orderItems });
  });

  // GET /api/orders  ?stallId=&status=&limit=&q=pickupCode — STAFF ONLY (ADMIN all, STALL_OWNER own stall)
  router.get('/orders', requireAuth, (req, res) => {
    const user = getAuthUser(req)!;
    const { stallId, status, limit = '50', q } = req.query as any;
    let sql = `SELECT * FROM orders WHERE 1=1`;
    const params: any[] = [];
    // Stall owners can only see own stall
    if (user.role === 'STALL_OWNER') {
      sql += ` AND stall_id=?`; params.push(user.stall_id);
    } else if (stallId) {
      sql += ` AND stall_id=?`; params.push(stallId);
    }
    if (status) { sql += ` AND status=?`; params.push(status); }
    if (q) { sql += ` AND pickup_code LIKE ?`; params.push(`%${q.toUpperCase()}%`); }
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(Number(limit));
    const orders = db.prepare(sql).all(...params);
    res.json(orders);
  });

  // GET /api/orders/:id  (with items + stall) — public for Kiosk tracker, but staff check ownership if authed
  router.get('/orders/:id', (req, res) => {
    const order = db.prepare(`SELECT o.*, s.name as stall_name FROM orders o LEFT JOIN stalls s ON s.id=o.stall_id WHERE o.id=?`).get(req.params.id) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    // If request is authed as STALL_OWNER, enforce ownership
    const user = getAuthUser(req);
    if (user && user.role === 'STALL_OWNER' && order.stall_id !== user.stall_id) {
      return res.status(403).json({ error: 'Forbidden for this stall' });
    }
    const items = db.prepare(`
      SELECT oi.*, mi.name as menu_item_name, mi.price as menu_price
      FROM order_items oi JOIN menu_items mi ON mi.id=oi.menu_item_id
      WHERE oi.order_id=?`).all(req.params.id);
    res.json({ order, items });
  });

  // GET /api/orders/by-code/:code  (POS quick lookup) — STAFF ONLY
  router.get('/orders/by-code/:code', requireAuth, (req, res) => {
    const code = String(req.params.code).toUpperCase();
    const order = db.prepare(`SELECT * FROM orders WHERE pickup_code=?`).get(code) as any;
    if (!order) return res.status(404).json({ error: 'Order not found for code ' + code });
    const user = getAuthUser(req)!;
    if (user.role === 'STALL_OWNER' && order.stall_id !== user.stall_id) {
      return res.status(403).json({ error: 'Forbidden for this stall' });
    }
    const items = db.prepare(`
      SELECT oi.*, mi.name as menu_item_name
      FROM order_items oi JOIN menu_items mi ON mi.id=oi.menu_item_id
      WHERE oi.order_id=?`).all(order.id);
    res.json({ order, items });
  });

  // PATCH /api/orders/:id/status  { status: 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED' }
  const statusSchema = z.object({ status: z.enum(['PENDING_PAYMENT', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']) });

  router.patch('/orders/:id/status', requireAuth, (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    const newStatus = parsed.data.status;
    const order = db.prepare(`SELECT * FROM orders WHERE id=?`).get(req.params.id) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const user = getAuthUser(req)!;
    if (user.role === 'STALL_OWNER' && order.stall_id !== user.stall_id) {
      return res.status(403).json({ error: 'Forbidden for this stall' });
    }

    // Basic state machine guard (simple linear flow + cancel anytime before COMPLETED)
    const allowed: Record<string, string[]> = {
      'PENDING_PAYMENT': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': ['PREPARING', 'CANCELLED'],
      'PREPARING': ['READY', 'CANCELLED'],
      'READY': ['COMPLETED', 'CANCELLED'],
      'COMPLETED': [],
      'CANCELLED': [],
    };
    if (!allowed[order.status]?.includes(newStatus)) {
      return res.status(400).json({ error: `Invalid transition ${order.status} -> ${newStatus}` });
    }

    // Handle BOM deductions on first confirmation
    const items = db.prepare(`SELECT menu_item_id, quantity FROM order_items WHERE order_id=?`).all(order.id) as { menu_item_id: string; quantity: number }[];
    const mapped = items.map(i => ({ menuItemId: i.menu_item_id, quantity: i.quantity }));

    try {
      // CONFIRMED or PREPARING from PENDING triggers BOM deduction (only once)
      const shouldDeduct = order.status === 'PENDING_PAYMENT' && (newStatus === 'CONFIRMED' || newStatus === 'PREPARING');
      // Cancellation after deduction needs rollback
      const shouldRollback = newStatus === 'CANCELLED' && ['CONFIRMED', 'PREPARING', 'READY'].includes(order.status);

      if (shouldDeduct) {
        try {
          deductBomTransaction(order.id, mapped);
        } catch (bomErr: any) {
          return res.status(409).json({ error: 'BOM deduction failed', details: bomErr.message });
        }
      }
      if (shouldRollback) {
        try { rollbackBomTransaction(order.id, mapped); } catch (e) { console.error('[Order] Rollback failed', e); }
      }

      db.prepare(`UPDATE orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(newStatus, order.id);
      const updated = db.prepare(`SELECT * FROM orders WHERE id=?`).get(order.id);
      wsGateway.notifyOrderStatus(order.id, updated);
      res.json(updated);
    } catch (e: any) {
      console.error('[Order] Status update error', e);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/analytics/daily?date=YYYY-MM-DD — STAFF ONLY (filtered for stall owners)
  router.get('/analytics/daily', requireAuth, (req, res) => {
    const user = getAuthUser(req)!;
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const stallFilter = user.role === 'STALL_OWNER' ? ` AND stall_id='${user.stall_id}'` : '';
    const stallFilter2 = user.role === 'STALL_OWNER' ? ` AND o.stall_id='${user.stall_id}'` : '';
    const revenue = db.prepare(`SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as orderCount FROM orders WHERE date(created_at)=date(?) AND status != 'CANCELLED'${stallFilter}`).get(date);
    const topItems = db.prepare(`
      SELECT mi.name, SUM(oi.quantity) as qty, SUM(oi.subtotal) as revenue
      FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN menu_items mi ON mi.id=oi.menu_item_id
      WHERE date(o.created_at)=date(?) AND o.status != 'CANCELLED'${stallFilter2}
      GROUP BY mi.id ORDER BY qty DESC LIMIT 5
    `).all(date);
    const hourly = db.prepare(`
      SELECT strftime('%H', created_at) as hour, COUNT(*) as orders, SUM(total_amount) as revenue
      FROM orders WHERE date(created_at)=date(?) AND status != 'CANCELLED'${stallFilter}
      GROUP BY hour ORDER BY hour
    `).all(date);
    res.json({ date, revenue, topItems, hourly, stall: user.role === 'STALL_OWNER' ? user.stall_id : 'all' });
  });

  return router;
}
