// Full-stack Expo API — replaces :3000 server-core when running `npx expo start --web --host lan` at 8081
// Shares SQLite DB at ../server-core/data/campusbite.db via lib/database.ts (node:sqlite)
// Implements stalls/menu/categories/auth/orders so Kiosk/Login work with no separate 3000.
// For unimplemented admin routes, returns 501 with hint to use 3000 server-core.

import { db } from '../../lib/database';
import * as bomHelpers from '../../lib/bomEngine';
function rid(){ try{ return (globalThis as any).crypto.randomUUID(); } catch { return 'id-'+Math.random().toString(36).slice(2,9); } }

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function getAuthUser(req: Request) {
  const headers = req.headers;
  const userId = headers.get('x-user-id') || headers.get('x-userid') || new URL(req.url).searchParams.get('userId');
  if (!userId) return null;
  try {
    const user = db.prepare(`SELECT id, username, role, stall_id, display_name, is_active FROM users WHERE id=? AND is_active=1`).get(userId) as any;
    return user || null;
  } catch { return null; }
}
function canManageStall(user: any, stallId: string) {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'STALL_OWNER' && user.stall_id === stallId) return true;
  return false;
}

// ---------- HEALTH ----------
function handleHealth() {
  // For Expo, port is 8081 (not 3000) — same-origin, no external hotspot IP needed
  return json({ ok: true, service: 'CampusBITE Expo API', ip: '127.0.0.1', ips: ['127.0.0.1'], port: 8081, kioskUrl: `/kiosk?stall=stall-001`, timestamp: new Date().toISOString() });
}

// ---------- STALLS ----------
function handleGetStalls() {
  const stalls = db.prepare(`SELECT * FROM stalls WHERE is_active=1`).all();
  return json(stalls);
}
function handlePostStalls(body: any, user: any) {
  if (!user || user.role !== 'ADMIN') return json({ error: 'ADMIN only' }, 403);
  if (!body?.name) return json({ error: 'name required' }, 400);
  const id = body.id || `stall-${Math.random().toString(36).slice(2, 8)}`;
  try {
    db.prepare(`INSERT INTO stalls (id, name, description, logo_url, rating, rating_count) VALUES (?,?,?,?,?,?)`).run(id, body.name, body.description || null, body.logoUrl || null, body.rating ?? 4.8, body.ratingCount ?? 128);
    return json(db.prepare(`SELECT * FROM stalls WHERE id=?`).get(id), 201);
  } catch (e: any) { return json({ error: e.message }, 409); }
}
function handlePatchStall(id: string, body: any, user: any) {
  if (!user || user.role !== 'ADMIN') return json({ error: 'ADMIN only' }, 403);
  const existing = db.prepare(`SELECT * FROM stalls WHERE id=?`).get(id) as any;
  if (!existing) return json({ error: 'Stall not found' }, 404);
  const map: Record<string,string> = { name:'name', description:'description', logoUrl:'logo_url', rating:'rating', ratingCount:'rating_count', is_active:'is_active' };
  const fields: string[] = []; const vals: any[] = [];
  for (const [k,v] of Object.entries(body||{})) if (v!==undefined && map[k]) { fields.push(`${map[k]}=?`); vals.push(v); }
  if (!fields.length) return json(existing);
  vals.push(id);
  db.prepare(`UPDATE stalls SET ${fields.join(',')} WHERE id=?`).run(...vals);
  return json(db.prepare(`SELECT * FROM stalls WHERE id=?`).get(id));
}

// ---------- CATEGORIES ----------
function handleGetCategories(url: URL) {
  const stallId = url.searchParams.get('stallId');
  const includeEmpty = url.searchParams.get('includeEmpty') === '1';
  if (includeEmpty || !stallId) {
    let sql = `SELECT * FROM categories`;
    const params: any[] = [];
    if (stallId) { sql += ` WHERE stall_id=?`; params.push(stallId); }
    sql += ` ORDER BY display_order`;
    return json(db.prepare(sql).all(...params));
  }
  const rows = db.prepare(`SELECT DISTINCT c.* FROM categories c JOIN menu_items mi ON mi.category_id=c.id AND mi.is_available=1 WHERE c.stall_id=? ORDER BY c.display_order`).all(stallId);
  return json(rows);
}

// ---------- MENU ----------
function handleGetMenu(url: URL) {
  const stallId = url.searchParams.get('stallId');
  const categoryId = url.searchParams.get('categoryId');
  const includeUnavailable = url.searchParams.get('includeUnavailable') === '1' || url.searchParams.get('includeUnavailable') === 'true';
  let sql = `SELECT mi.*, c.name as category_name, s.name as stall_name FROM menu_items mi JOIN categories c ON c.id=mi.category_id JOIN stalls s ON s.id=mi.stall_id WHERE 1=1`;
  const params: any[] = [];
  if (!includeUnavailable) sql += ` AND mi.is_available=1`;
  if (stallId) { sql += ` AND mi.stall_id=?`; params.push(stallId); }
  if (categoryId) { sql += ` AND mi.category_id=?`; params.push(categoryId); }
  sql += ` ORDER BY c.display_order, mi.name`;
  const items: any[] = db.prepare(sql).all(...params) as any[];
  for (const it of items) {
    try { it.variants = db.prepare(`SELECT * FROM item_variants WHERE menu_item_id=? ORDER BY display_order, price`).all(it.id); } catch { it.variants = []; }
  }
  return json(items);
}
function handleGetMenuDetail(id: string) {
  const item = db.prepare(`SELECT * FROM menu_items WHERE id=?`).get(id) as any;
  if (!item) return json({ error: 'Item not found' }, 404);
  const bom = db.prepare(`SELECT rb.quantity_required, i.id as ingredient_id, i.name, i.unit, i.current_stock FROM recipe_bom rb JOIN ingredients i ON i.id=rb.ingredient_id WHERE rb.menu_item_id=?`).all(id);
  let variants: any[] = [];
  try { variants = db.prepare(`SELECT * FROM item_variants WHERE menu_item_id=? ORDER BY display_order`).all(id); } catch {}
  return json({ item, bom, variants });
}

// ---------- INGREDIENTS ----------
function handleGetIngredients() {
  return json(db.prepare(`SELECT * FROM ingredients ORDER BY name`).all());
}

// ---------- AUTH ----------
function handlePostLogin(body: any) {
  if (!body?.username || !body?.pin) return json({ error: 'username and pin required' }, 400);
  const user = db.prepare(`SELECT id, username, role, stall_id, display_name, is_active, pin FROM users WHERE username=?`).get(body.username) as any;
  if (!user || user.pin !== body.pin) return json({ error: 'Invalid username or PIN' }, 401);
  if (!user.is_active) return json({ error: 'Account disabled' }, 403);
  const stall = user.stall_id ? db.prepare(`SELECT name FROM stalls WHERE id=?`).get(user.stall_id) as any : null;
  const { pin: _p, ...safe } = user;
  return json({ user: { ...safe, stall_name: stall?.name || null }, token: user.id });
}
function handleGetMe(req: Request) {
  const userId = req.headers.get('x-user-id') || new URL(req.url).searchParams.get('userId');
  if (!userId) return json({ error: 'Missing x-user-id' }, 401);
  const user = db.prepare(`SELECT id, username, role, stall_id, display_name, is_active FROM users WHERE id=?`).get(userId) as any;
  if (!user) return json({ error: 'User not found' }, 404);
  const stall = user.stall_id ? db.prepare(`SELECT name FROM stalls WHERE id=?`).get(user.stall_id) as any : null;
  return json({ ...user, stall_name: stall?.name || null });
}

// ---------- ORDERS (Kiosk checkout = PUBLIC, staff list = auth) ----------
function handlePostOrders(body: any) {
  if (!body?.stallId || !Array.isArray(body.items) || !body.items.length) return json({ error: 'stallId and items required' }, 400);
  const stallId = body.stallId;
  const stall = db.prepare(`SELECT id FROM stalls WHERE id=?`).get(stallId);
  if (!stall) return json({ error: 'Stall not found' }, 404);
  let total = 0;
  const enriched: any[] = [];
  for (const it of body.items) {
    const menuItem = db.prepare(`SELECT id, price, is_available, stall_id FROM menu_items WHERE id=?`).get(it.menuItemId) as any;
    if (!menuItem) return json({ error: `Menu item ${it.menuItemId} not found` }, 404);
    if (!menuItem.is_available) return json({ error: `Item ${it.menuItemId} not available` }, 400);
    if (menuItem.stall_id !== stallId) return json({ error: 'All items must be from same stall' }, 400);
    let unitPrice = menuItem.price;
    let variantName: string | undefined;
    let variantId: string | undefined;
    if (it.variantId) {
      const variant = db.prepare(`SELECT * FROM item_variants WHERE id=? AND menu_item_id=?`).get(it.variantId, it.menuItemId) as any;
      if (!variant) return json({ error: `Variant ${it.variantId} not found` }, 404);
      if (!variant.is_available) return json({ error: `Variant ${variant.name} not available` }, 400);
      unitPrice = variant.price;
      variantName = variant.name;
      variantId = variant.id;
    }
    const subtotal = unitPrice * it.quantity;
    total += subtotal;
    enriched.push({ menuItemId: it.menuItemId, variantId, variantName, quantity: it.quantity, unitPrice, subtotal });
  }
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pickupCode = Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
  for (let i=0;i<5;i++) {
    if (!db.prepare(`SELECT id FROM orders WHERE pickup_code=?`).get(pickupCode)) break;
    pickupCode = Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
  }
  const orderId = rid();
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO orders (id, pickup_code, stall_id, total_amount, status, customer_notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(orderId, pickupCode, stallId, total, 'PENDING_PAYMENT', body.customerNotes || null, now, now);
    for (const e of enriched) {
      const itemId = rid();
      db.prepare(`INSERT INTO order_items (id, order_id, menu_item_id, variant_id, variant_name, quantity, unit_price, subtotal) VALUES (?,?,?,?,?,?,?,?)`).run(itemId, orderId, e.menuItemId, e.variantId || null, e.variantName || null, e.quantity, e.unitPrice, e.subtotal);
    }
  });
  tx();
  const order = db.prepare(`SELECT * FROM orders WHERE id=?`).get(orderId);
  const items = db.prepare(`SELECT * FROM order_items WHERE order_id=?`).all(orderId);
  return json({ order, items }, 201);
}
function handleGetOrders(url: URL, req: Request) {
  const user = getAuthUser(req);
  if (!user) return json({ error: 'Unauthorized: missing x-user-id. POST /api/auth/login first.' }, 401);
  const stallId = url.searchParams.get('stallId');
  const status = url.searchParams.get('status');
  const limit = url.searchParams.get('limit') || '50';
  const q = url.searchParams.get('q');
  let sql = `SELECT * FROM orders WHERE 1=1`;
  const params: any[] = [];
  if (user.role === 'STALL_OWNER') { sql += ` AND stall_id=?`; params.push(user.stall_id); }
  else if (stallId) { sql += ` AND stall_id=?`; params.push(stallId); }
  if (status) { sql += ` AND status=?`; params.push(status); }
  if (q) { sql += ` AND pickup_code LIKE ?`; params.push(`%${q.toUpperCase()}%`); }
  sql += ` ORDER BY created_at DESC LIMIT ?`; params.push(Number(limit));
  return json(db.prepare(sql).all(...params));
}
function handleGetOrderById(id: string, req: Request) {
  const order = db.prepare(`SELECT o.*, s.name as stall_name FROM orders o LEFT JOIN stalls s ON s.id=o.stall_id WHERE o.id=?`).get(id) as any;
  if (!order) return json({ error: 'Order not found' }, 404);
  const user = getAuthUser(req);
  if (user && user.role === 'STALL_OWNER' && order.stall_id !== user.stall_id) return json({ error: 'Forbidden for this stall' }, 403);
  const items = db.prepare(`SELECT oi.*, mi.name as menu_item_name, mi.price as menu_price FROM order_items oi JOIN menu_items mi ON mi.id=oi.menu_item_id WHERE oi.order_id=?`).all(id);
  return json({ order, items });
}
function handleGetOrderByCode(code: string, req: Request) {
  const user = getAuthUser(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const up = code.toUpperCase();
  const order = db.prepare(`SELECT * FROM orders WHERE pickup_code=?`).get(up) as any;
  if (!order) return json({ error: 'Order not found for code ' + up }, 404);
  if (user.role === 'STALL_OWNER' && order.stall_id !== user.stall_id) return json({ error: 'Forbidden' }, 403);
  const items = db.prepare(`SELECT oi.*, mi.name as menu_item_name FROM order_items oi JOIN menu_items mi ON mi.id=oi.menu_item_id WHERE oi.order_id=?`).all(order.id);
  return json({ order, items });
}
function handlePatchOrderStatus(id: string, body: any, req: Request) {
  const user = getAuthUser(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const newStatus = body?.status;
  const allowedStatuses = ['PENDING_PAYMENT','CONFIRMED','PREPARING','READY','COMPLETED','CANCELLED'];
  if (!allowedStatuses.includes(newStatus)) return json({ error: 'status must be one of '+allowedStatuses.join(',') }, 400);
  const order = db.prepare(`SELECT * FROM orders WHERE id=?`).get(id) as any;
  if (!order) return json({ error: 'Order not found' }, 404);
  if (user.role === 'STALL_OWNER' && order.stall_id !== user.stall_id) return json({ error: 'Forbidden' }, 403);
  const allowed: Record<string,string[]> = {
    'PENDING_PAYMENT': ['CONFIRMED','CANCELLED'],
    'CONFIRMED': ['PREPARING','CANCELLED'],
    'PREPARING': ['READY','CANCELLED'],
    'READY': ['COMPLETED','CANCELLED'],
    'COMPLETED': [], 'CANCELLED': [],
  };
  if (!allowed[order.status]?.includes(newStatus)) return json({ error: `Invalid transition ${order.status} -> ${newStatus}` }, 400);
  const items = db.prepare(`SELECT menu_item_id, quantity FROM order_items WHERE order_id=?`).all(id) as { menu_item_id:string; quantity:number }[];
  const mapped = items.map(i=>({ menuItemId: i.menu_item_id, quantity: i.quantity }));
  try {
    const shouldDeduct = order.status==='PENDING_PAYMENT' && (newStatus==='CONFIRMED' || newStatus==='PREPARING');
    const shouldRollback = newStatus==='CANCELLED' && ['CONFIRMED','PREPARING','READY'].includes(order.status);
    if (shouldDeduct && bomHelpers?.deductBomTransaction) {
      try { bomHelpers.deductBomTransaction(id, mapped); } catch (e:any){ return json({ error:'BOM deduction failed', details:e.message }, 409); }
    }
    if (shouldRollback && bomHelpers?.rollbackBomTransaction) {
      try { bomHelpers.rollbackBomTransaction(id, mapped); } catch {}
    }
    db.prepare(`UPDATE orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(newStatus, id);
    return json(db.prepare(`SELECT * FROM orders WHERE id=?`).get(id));
  } catch (e:any){ return json({ error:e.message },500); }
}
function handleGetDaily(url: URL, req: Request) {
  const user = getAuthUser(req);
  if (!user) return json({ error:'Unauthorized' },401);
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0,10);
  const stallFilter = user.role==='STALL_OWNER' ? ` AND stall_id='${user.stall_id}'` : '';
  const stallFilter2 = user.role==='STALL_OWNER' ? ` AND o.stall_id='${user.stall_id}'` : '';
  const revenue = db.prepare(`SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as orderCount FROM orders WHERE date(created_at)=date(?) AND status!='CANCELLED'${stallFilter}`).get(date);
  const topItems = db.prepare(`SELECT mi.name, SUM(oi.quantity) as qty, SUM(oi.subtotal) as revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN menu_items mi ON mi.id=oi.menu_item_id WHERE date(o.created_at)=date(?) AND o.status!='CANCELLED'${stallFilter2} GROUP BY mi.id ORDER BY qty DESC LIMIT 5`).all(date);
  const hourly = db.prepare(`SELECT strftime('%H', created_at) as hour, COUNT(*) as orders, SUM(total_amount) as revenue FROM orders WHERE date(created_at)=date(?) AND status!='CANCELLED'${stallFilter} GROUP BY hour ORDER BY hour`).all(date);
  return json({ date, revenue, topItems, hourly, stall: user.role==='STALL_OWNER'? user.stall_id:'all' });
}

// ---------- INVENTORY (minimal) ----------
function handleGetInventory() {
  return json(db.prepare(`SELECT *, CASE WHEN current_stock <= min_threshold THEN 1 ELSE 0 END as is_low FROM ingredients ORDER BY is_low DESC, name`).all());
}

// ---------- ROUTER ----------
async function parseBody(req: Request) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) try { return await req.json(); } catch { return null; }
  try { return await req.json(); } catch { return null; }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\//, '/');
  // Normalize: /api/health → /health; catch-all receives /api/... already stripped by expo? We handle both
  const p = url.pathname;
  if (p === '/api/health' || p === '/health') return handleHealth();
  if (p === '/api/stalls' || p === '/stalls') return handleGetStalls();
  if (p === '/api/menu' || p.startsWith('/api/menu?') || p === '/menu') return handleGetMenu(url);
  if (p.match(/^\/api\/menu\/[^\/]+\/detail$/)) {
    const id = p.split('/')[3];
    return handleGetMenuDetail(id);
  }
  if (p === '/api/categories' || p.startsWith('/api/categories?')) return handleGetCategories(url);
  if (p === '/api/ingredients' || p === '/ingredients') return handleGetIngredients();
  if (p === '/api/auth/me' || p === '/auth/me') return handleGetMe(request);
  if (p === '/api/users' && request.method==='GET') {
    const user = getAuthUser(request);
    if (!user || user.role!=='ADMIN') return json({ error:'ADMIN only' },403);
    return json(db.prepare(`SELECT u.id, u.username, u.role, u.stall_id, u.display_name, u.is_active, u.created_at, s.name as stall_name FROM users u LEFT JOIN stalls s ON s.id=u.stall_id ORDER BY u.role, u.username`).all());
  }
  if (p.startsWith('/api/orders/by-code/')) {
    const code = decodeURIComponent(p.split('/').pop()!);
    return handleGetOrderByCode(code, request);
  }
  if (p.match(/^\/api\/orders\/[^\/]+$/)) {
    const id = p.split('/').pop()!;
    if (id !== 'orders' && id !== 'by-code') return handleGetOrderById(id, request);
  }
  if (p === '/api/orders') return handleGetOrders(url, request);
  if (p === '/api/analytics/daily' || p.startsWith('/api/analytics/daily?')) return handleGetDaily(url, request);
  if (p === '/api/inventory') return handleGetInventory();
  if (p === '/api/reports/summary' || p.startsWith('/api/reports/summary?')) {
    const user = getAuthUser(request);
    if (!user || user.role!=='ADMIN') return json({ error:'ADMIN only' },403);
    const from = url.searchParams.get('from') || new Date(Date.now()-30*864e5).toISOString().slice(0,10);
    const to = url.searchParams.get('to') || new Date().toISOString().slice(0,10);
    const daily = db.prepare(`SELECT date(created_at) as day, COUNT(*) as orders, SUM(total_amount) as revenue FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?) AND status!='CANCELLED' GROUP BY day ORDER BY day`).all(from,to);
    const monthly = db.prepare(`SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as orders, SUM(total_amount) as revenue FROM orders WHERE date(created_at) BETWEEN date(?) AND date(?) AND status!='CANCELLED' GROUP BY month ORDER BY month`).all(from,to);
    const lowStocks = db.prepare(`SELECT * FROM ingredients WHERE current_stock <= min_threshold ORDER BY current_stock`).all();
    const totalIngredientsValue = db.prepare(`SELECT SUM(current_stock * cost_per_unit) as value FROM ingredients`).get();
    return json({ from,to,daily,monthly,lowStocks,totalIngredientsValue });
  }
  if (p.startsWith('/api/audits')) {
    const user = getAuthUser(request);
    if (!user || user.role!=='ADMIN') return json({ error:'ADMIN only' },403);
    const date = url.searchParams.get('date');
    let sql = `SELECT da.*, i.name as ingredient_name, i.unit FROM daily_audits da JOIN ingredients i ON i.id=da.ingredient_id`;
    const params: any[] = [];
    if (date) { sql += ` WHERE da.audit_date=?`; params.push(date); }
    sql += ` ORDER BY da.audit_date DESC, i.name`;
    return json(db.prepare(sql).all(...params));
  }
  if (p === '/api/recipe-bom' || p.startsWith('/api/recipe-bom?')) {
    const menuItemId = url.searchParams.get('menuItemId');
    if (menuItemId) return json(db.prepare(`SELECT rb.*, i.name as ingredient_name, i.unit, i.current_stock FROM recipe_bom rb JOIN ingredients i ON i.id=rb.ingredient_id WHERE rb.menu_item_id=?`).all(menuItemId));
    return json(db.prepare(`SELECT rb.*, i.name as ingredient_name, mi.name as menu_item_name FROM recipe_bom rb JOIN ingredients i ON i.id=rb.ingredient_id JOIN menu_items mi ON mi.id=rb.menu_item_id ORDER BY mi.name`).all());
  }
  if (p === '/api/stock-logs' || p.startsWith('/api/stock-logs?')) {
    const limit = Math.min(Number(url.searchParams.get('limit')||100),500);
    const type = url.searchParams.get('type');
    let sql = `SELECT sl.*, i.name as ingredient_name FROM stock_logs sl JOIN ingredients i ON i.id=sl.ingredient_id`;
    const params:any[]=[];
    if (type) { sql += ` WHERE sl.change_type=?`; params.push(type); }
    sql += ` ORDER BY sl.created_at DESC LIMIT ?`; params.push(limit);
    return json(db.prepare(sql).all(...params));
  }
  if (p.match(/^\/api\/inventory\/[^\/]+\/logs$/)) {
    const id = p.split('/')[3];
    const limit = Math.min(Number(url.searchParams.get('limit')||50),200);
    return json(db.prepare(`SELECT * FROM stock_logs WHERE ingredient_id=? ORDER BY created_at DESC LIMIT ?`).all(id, limit));
  }
  if (p.match(/^\/api\/inventory\/[^\/]+$/)) {
    const id = p.split('/')[3];
    const row = db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(id);
    if (!row) return json({ error:'Ingredient not found' },404);
    return json(row);
  }
  // debug ips
  if (p === '/api/debug/ips') {
    return json({ ips:['127.0.0.1'], ip:'127.0.0.1', port:8081 });
  }
  return json({ error: `GET ${p} not implemented in Expo API. For full admin use :3000 server-core.` }, 404);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const p = url.pathname;
  const body = await parseBody(request);
  if (p === '/api/auth/login' || p === '/auth/login') return handlePostLogin(body);
  if (p === '/api/stalls' || p === '/stalls') return handlePostStalls(body, getAuthUser(request));
  if (p === '/api/orders' || p === '/orders') return handlePostOrders(body);
  if (p === '/api/inventory' || p === '/inventory') {
    const user = getAuthUser(request);
    if (!user || user.role!=='ADMIN') return json({ error:'ADMIN only' },403);
    if (!body?.name) return json({ error:'name required' },400);
    const id = body.id || `ing-${Math.random().toString(36).slice(2,8)}`;
    try {
      db.prepare(`INSERT INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES (?,?,?,?,?,?)`).run(id, body.name, body.unit||'pcs', body.current_stock||0, body.min_threshold||10, body.cost_per_unit||0);
      return json(db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(id),201);
    } catch(e:any){ return json({ error:e.message },409); }
  }
  if (p.match(/^\/api\/inventory\/[^\/]+\/stock-in$/)) {
    const user = getAuthUser(request);
    if (!user || user.role!=='ADMIN') return json({ error:'ADMIN only' },403);
    const id = p.split('/')[3];
    if (!body?.quantity || body.quantity<=0) return json({ error:'quantity positive required' },400);
    const ing = db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(id) as any;
    if (!ing) return json({ error:'Ingredient not found' },404);
    const tx = db.transaction(()=> {
      db.prepare(`UPDATE ingredients SET current_stock = current_stock + ?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(body.quantity, id);
      const logId = rid();
      db.prepare(`INSERT INTO stock_logs (id, ingredient_id, change_type, quantity_delta, reason) VALUES (?,?,?,?,?)`).run(logId, id, 'STOCK_IN', body.quantity, body.reason||'Manual stock-in');
    });
    tx();
    return json(db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(id));
  }
  if (p.match(/^\/api\/inventory\/[^\/]+\/stock-out$/)) {
    const user = getAuthUser(request);
    if (!user || user.role!=='ADMIN') return json({ error:'ADMIN only' },403);
    const id = p.split('/')[3];
    if (!body?.quantity || body.quantity<=0) return json({ error:'quantity positive required' },400);
    const ing = db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(id) as any;
    if (!ing) return json({ error:'Not found' },404);
    if (ing.current_stock < body.quantity) return json({ error:`Insufficient stock: have ${ing.current_stock}, need ${body.quantity}` },409);
    const tx = db.transaction(()=> {
      db.prepare(`UPDATE ingredients SET current_stock = current_stock - ?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(body.quantity, id);
      const logId = rid();
      db.prepare(`INSERT INTO stock_logs (id, ingredient_id, change_type, quantity_delta, reason) VALUES (?,?,?,?,?)`).run(logId, id, 'WASTAGE', -body.quantity, body.reason||'Wastage');
    });
    tx();
    return json(db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(id));
  }
  if (p === '/api/categories' || p === '/categories') {
    const user = getAuthUser(request);
    if (!user) return json({ error:'Unauthorized' },401);
    if (!body?.stallId || !body?.name) return json({ error:'stallId and name required' },400);
    if (!canManageStall(user, body.stallId)) return json({ error:'Forbidden for this stall' },403);
    const id = body.id || `cat-${Math.random().toString(36).slice(2,8)}`;
    try {
      db.prepare(`INSERT INTO categories (id, stall_id, name, display_order) VALUES (?,?,?,?)`).run(id, body.stallId, body.name, body.displayOrder||0);
      return json(db.prepare(`SELECT * FROM categories WHERE id=?`).get(id),201);
    } catch(e:any){ return json({ error:e.message },409); }
  }
  if (p === '/api/menu' || p === '/menu') {
    const user = getAuthUser(request);
    if (!user) return json({ error:'Unauthorized' },401);
    if (!body?.stallId || !body?.categoryId || !body?.name || body.price==null) return json({ error:'stallId, categoryId, name, price required' },400);
    if (!canManageStall(user, body.stallId)) return json({ error:'Forbidden for this stall' },403);
    const id = body.id || `item-${Math.random().toString(36).slice(2,8)}`;
    try {
      db.prepare(`INSERT INTO menu_items (id, stall_id, category_id, name, price, description, image_url, rating, rating_count) VALUES (?,?,?,?,?,?,?,?,?)`).run(id, body.stallId, body.categoryId, body.name, body.price, body.description||null, body.imageUrl||null, body.rating??4.9, body.ratingCount??56);
      return json(db.prepare(`SELECT * FROM menu_items WHERE id=?`).get(id),201);
    } catch(e:any){ return json({ error:e.message },409); }
  }
  if (p === '/api/recipe-bom' || p === '/recipe-bom') {
    const user = getAuthUser(request);
    if (!user) return json({ error:'Unauthorized' },401);
    if (!body?.menuItemId || !body?.ingredientId || !body?.quantityRequired) return json({ error:'menuItemId, ingredientId, quantityRequired required' },400);
    const menuItem = db.prepare(`SELECT stall_id FROM menu_items WHERE id=?`).get(body.menuItemId) as any;
    if (!menuItem) return json({ error:'Menu item not found' },404);
    if (!canManageStall(user, menuItem.stall_id)) return json({ error:'Forbidden for this stall' },403);
    try {
      const id = rid();
      db.prepare(`INSERT INTO recipe_bom (id, menu_item_id, ingredient_id, quantity_required) VALUES (?,?,?,?)`).run(id, body.menuItemId, body.ingredientId, body.quantityRequired);
      return json(db.prepare(`SELECT * FROM recipe_bom WHERE id=?`).get(id),201);
    } catch(e:any){ return json({ error:e.message },409); }
  }
  if (p === '/api/users' || p === '/users') {
    const user = getAuthUser(request);
    if (!user || user.role!=='ADMIN') return json({ error:'ADMIN only' },403);
    if (!body?.username || !body?.pin || !body?.role) return json({ error:'username, pin, role required' },400);
    if (body.role==='STALL_OWNER' && !body.stallId) return json({ error:'STALL_OWNER requires stallId' },400);
    const id = `user-${Math.random().toString(36).slice(2,8)}`;
    try {
      db.prepare(`INSERT INTO users (id, username, pin, role, stall_id, display_name) VALUES (?,?,?,?,?,?)`).run(id, body.username, body.pin, body.role, body.stallId||null, body.displayName||body.username);
      return json(db.prepare(`SELECT id, username, role, stall_id, display_name FROM users WHERE id=?`).get(id),201);
    } catch(e:any){ if(String(e.message).includes('UNIQUE')) return json({ error:'Username already exists' },409); return json({ error:e.message },500); }
  }
  if (p === '/api/audits/bulk' || p === '/audits/bulk') {
    const user = getAuthUser(request);
    if (!user || user.role!=='ADMIN') return json({ error:'ADMIN only' },403);
    if (!body?.auditDate || !Array.isArray(body.entries) || !body.entries.length) return json({ error:'auditDate and entries required' },400);
    const results:any[]=[];
    try {
      const tx = db.transaction(()=> {
        for (const e of body.entries) {
          const ing = db.prepare(`SELECT current_stock FROM ingredients WHERE id=?`).get(e.ingredientId) as any;
          if (!ing) throw new Error(`Ingredient ${e.ingredientId} not found`);
          const variance = e.physicalActualStock - ing.current_stock;
          const id = rid();
          db.prepare(`INSERT INTO daily_audits (id, audit_date, ingredient_id, system_expected_stock, physical_actual_stock, variance, notes) VALUES (?,?,?,?,?,?,?)`).run(id, body.auditDate, e.ingredientId, ing.current_stock, e.physicalActualStock, variance, e.notes||null);
          if (variance!==0) {
            db.prepare(`UPDATE ingredients SET current_stock=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(e.physicalActualStock, e.ingredientId);
            const logId = rid();
            db.prepare(`INSERT INTO stock_logs (id, ingredient_id, change_type, quantity_delta, reason) VALUES (?,?,?,?,?)`).run(logId, e.ingredientId, 'AUDIT_ADJUSTMENT', variance, `EOD bulk audit ${body.auditDate}`);
          }
          results.push(db.prepare(`SELECT * FROM daily_audits WHERE id=?`).get(id));
        }
      });
      tx();
      return json(results,201);
    } catch(e:any){ return json({ error:e.message },400); }
  }
  if (p === '/api/audits' || p === '/audits') {
    const user = getAuthUser(request);
    if (!user || user.role!=='ADMIN') return json({ error:'ADMIN only' },403);
    if (!body?.auditDate || !body?.ingredientId || body.physicalActualStock==null) return json({ error:'auditDate, ingredientId, physicalActualStock required' },400);
    const ing = db.prepare(`SELECT current_stock FROM ingredients WHERE id=?`).get(body.ingredientId) as any;
    if (!ing) return json({ error:'Ingredient not found' },404);
    const variance = body.physicalActualStock - ing.current_stock;
    const id = rid();
    try {
      const tx = db.transaction(()=> {
        db.prepare(`INSERT INTO daily_audits (id, audit_date, ingredient_id, system_expected_stock, physical_actual_stock, variance, notes) VALUES (?,?,?,?,?,?,?)`).run(id, body.auditDate, body.ingredientId, ing.current_stock, body.physicalActualStock, variance, body.notes||null);
        if (variance!==0) {
          db.prepare(`UPDATE ingredients SET current_stock=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(body.physicalActualStock, body.ingredientId);
          const logId = rid();
          db.prepare(`INSERT INTO stock_logs (id, ingredient_id, change_type, quantity_delta, reason) VALUES (?,?,?,?,?)`).run(logId, body.ingredientId, 'AUDIT_ADJUSTMENT', variance, `EOD audit ${body.auditDate} variance ${variance}`);
        }
      });
      tx();
      return json(db.prepare(`SELECT * FROM daily_audits WHERE id=?`).get(id),201);
    } catch(e:any){ if (e.message.includes('UNIQUE')) return json({ error:'Audit already exists' },409); return json({ error:e.message },500); }
  }
  return json({ error: `POST ${p} not implemented in Expo API` }, 404);
}

export async function PATCH(request: Request) {
  const url = new URL(request.url);
  const p = url.pathname;
  const body = await parseBody(request);
  if (p.match(/^\/api\/stalls\/[^\/]+$/)) {
    const id = p.split('/')[3];
    return handlePatchStall(id, body, getAuthUser(request));
  }
  if (p.match(/^\/api\/orders\/[^\/]+\/status$/)) {
    const id = p.split('/')[3];
    return handlePatchOrderStatus(id, body, request);
  }
  if (p.match(/^\/api\/users\/[^\/]+$/)) {
    const user = getAuthUser(request);
    if (!user || user.role!=='ADMIN') return json({ error:'ADMIN only' },403);
    const id = p.split('/')[3];
    const existing = db.prepare(`SELECT * FROM users WHERE id=?`).get(id) as any;
    if (!existing) return json({ error:'User not found' },404);
    const fields:string[]=[]; const vals:any[]=[];
    if (body?.pin!==undefined) { fields.push('pin=?'); vals.push(body.pin); }
    if (body?.role!==undefined) { fields.push('role=?'); vals.push(body.role); }
    if (body?.stallId!==undefined) { fields.push('stall_id=?'); vals.push(body.stallId); }
    if (body?.displayName!==undefined) { fields.push('display_name=?'); vals.push(body.displayName); }
    if (body?.is_active!==undefined) { fields.push('is_active=?'); vals.push(body.is_active); }
    if (!fields.length) return json(existing);
    vals.push(id);
    db.prepare(`UPDATE users SET ${fields.join(',')} WHERE id=?`).run(...vals);
    return json(db.prepare(`SELECT id, username, role, stall_id, display_name, is_active FROM users WHERE id=?`).get(id));
  }
  if (p.match(/^\/api\/inventory\/[^\/]+$/)) {
    const user = getAuthUser(request);
    if (!user || user.role!=='ADMIN') return json({ error:'ADMIN only' },403);
    const id = p.split('/')[3];
    const existing = db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(id) as any;
    if (!existing) return json({ error:'Not found' },404);
    const fields:string[]=[]; const vals:any[]=[];
    for (const k of ['name','unit','min_threshold','cost_per_unit']) if (body?.[k]!==undefined) { fields.push(`${k}=?`); vals.push(body[k]); }
    if (!fields.length) return json(existing);
    fields.push(`updated_at=CURRENT_TIMESTAMP`); vals.push(id);
    db.prepare(`UPDATE ingredients SET ${fields.join(',')} WHERE id=?`).run(...vals);
    return json(db.prepare(`SELECT * FROM ingredients WHERE id=?`).get(id));
  }
  if (p.match(/^\/api\/menu\/[^\/]+$/)) {
    // PATCH /api/menu/:id — hybrid auth (ADMIN or owner)
    const id = p.split('/')[3];
    const existing = db.prepare(`SELECT * FROM menu_items WHERE id=?`).get(id) as any;
    if (!existing) return json({ error:'Menu item not found' },404);
    const user = getAuthUser(request);
    if (!user || !canManageStall(user, existing.stall_id)) return json({ error:'Forbidden for this stall' },403);
    const fields:string[]=[]; const vals:any[]=[];
    if (body?.name!==undefined) { fields.push('name=?'); vals.push(body.name); }
    if (body?.price!==undefined) { fields.push('price=?'); vals.push(body.price); }
    if (body?.description!==undefined) { fields.push('description=?'); vals.push(body.description); }
    if (body?.categoryId!==undefined) { fields.push('category_id=?'); vals.push(body.categoryId); }
    if (body?.isAvailable!==undefined) { fields.push('is_available=?'); vals.push(body.isAvailable); }
    if (body?.is_available!==undefined) { fields.push('is_available=?'); vals.push(body.is_available); }
    if (body?.imageUrl!==undefined) { fields.push('image_url=?'); vals.push(body.imageUrl); }
    if (!fields.length) return json(existing);
    vals.push(id);
    db.prepare(`UPDATE menu_items SET ${fields.join(',')} WHERE id=?`).run(...vals);
    return json(db.prepare(`SELECT * FROM menu_items WHERE id=?`).get(id));
  }
  return json({ error: `PATCH ${p} not implemented in Expo API` }, 404);
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const p = url.pathname;
  if (p.match(/^\/api\/users\/[^\/]+$/)) {
    const user = getAuthUser(request);
    if (!user || user.role!=='ADMIN') return json({ error:'ADMIN only' },403);
    const id = p.split('/').pop()!;
    if (user.id===id) return json({ error:'Cannot delete yourself' },400);
    const info = db.prepare(`DELETE FROM users WHERE id=?`).run(id);
    if (info.changes===0) return json({ error:'User not found' },404);
    return json({ ok:true });
  }
  if (p.match(/^\/api\/categories\/[^\/]+$/)) {
    const user = getAuthUser(request);
    if (!user) return json({ error:'Unauthorized' },401);
    const id = p.split('/').pop()!;
    const cat = db.prepare(`SELECT * FROM categories WHERE id=?`).get(id) as any;
    if (!cat) return json({ error:'Category not found' },404);
    if (!canManageStall(user, cat.stall_id)) return json({ error:'Forbidden' },403);
    db.prepare(`DELETE FROM categories WHERE id=?`).run(id);
    return json({ ok:true });
  }
  if (p.match(/^\/api\/menu\/[^\/]+$/)) {
    const user = getAuthUser(request);
    if (!user) return json({ error:'Unauthorized' },401);
    const id = p.split('/').pop()!;
    const item = db.prepare(`SELECT * FROM menu_items WHERE id=?`).get(id) as any;
    if (!item) return json({ error:'Menu item not found' },404);
    if (!canManageStall(user, item.stall_id)) return json({ error:'Forbidden' },403);
    db.prepare(`DELETE FROM menu_items WHERE id=?`).run(id);
    return json({ ok:true });
  }
  if (p.match(/^\/api\/recipe-bom\/[^\/]+$/)) {
    const user = getAuthUser(request);
    if (!user) return json({ error:'Unauthorized' },401);
    const id = p.split('/').pop()!;
    const existing = db.prepare(`SELECT rb.*, mi.stall_id FROM recipe_bom rb JOIN menu_items mi ON mi.id=rb.menu_item_id WHERE rb.id=?`).get(id) as any;
    if (!existing) return json({ error:'Not found' },404);
    if (!canManageStall(user, existing.stall_id)) return json({ error:'Forbidden' },403);
    db.prepare(`DELETE FROM recipe_bom WHERE id=?`).run(id);
    return json({ ok:true });
  }
  return json({ error: `DELETE ${p} not implemented` }, 404);
}

// Expo Router also supports PUT
export async function PUT(request: Request) { return PATCH(request); }
