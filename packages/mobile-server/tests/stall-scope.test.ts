import { beforeAll, describe, expect, it } from 'vitest';
import { call, login } from './helpers';

// potato → stall-001 (Potato Corner), matees → stall-002 (Matees)
let potato: string;
let matees: string;
let admin: string;

beforeAll(async () => {
  potato = await login('potato', 'potato123');
  matees = await login('matees', 'matees123');
  admin = await login('admin', 'admin123');
});

const ids = (rows: any[]) => rows.map((r) => r.id);

describe('stall owners only see and manage their own stall', () => {
  it('ingredients and inventory are limited to the owner\'s stall', async () => {
    for (const path of ['/api/inventory', '/api/ingredients']) {
      const p = await call('GET', path, { token: potato });
      expect(p.status).toBe(200);
      expect(p.data.length).toBeGreaterThan(0);
      expect(p.data.every((i: any) => i.stall_id === 'stall-001')).toBe(true);
      expect(ids(p.data)).toContain('ing-potato');
      expect(ids(p.data)).not.toContain('ing-milk');
    }
    const all = await call('GET', '/api/inventory', { token: admin });
    expect(ids(all.data)).toEqual(expect.arrayContaining(['ing-potato', 'ing-milk']));
    const one = await call('GET', '/api/inventory?stallId=stall-002', { token: admin });
    expect(one.data.every((i: any) => i.stall_id === 'stall-002')).toBe(true);
  });

  it('cannot read, restock or adjust another stall\'s ingredient', async () => {
    expect((await call('GET', '/api/inventory/ing-milk', { token: potato })).status).toBe(404);
    expect((await call('GET', '/api/inventory/ing-milk/logs', { token: potato })).status).toBe(404);
    expect((await call('POST', '/api/inventory/ing-milk/stock-in', { token: potato, body: { quantity: 5 } })).status).toBe(404);
    expect((await call('POST', '/api/inventory/ing-milk/stock-out', { token: potato, body: { quantity: 5 } })).status).toBe(404);
    expect((await call('PATCH', '/api/inventory/ing-milk', { token: potato, body: { min_threshold: 1 } })).status).toBe(404);
  });

  it('can restock and record wastage for their own ingredient', async () => {
    const before = (await call('GET', '/api/inventory/ing-oil', { token: potato })).data.current_stock;
    expect((await call('POST', '/api/inventory/ing-oil/stock-in', { token: potato, body: { quantity: 100 } })).status).toBe(200);
    expect((await call('POST', '/api/inventory/ing-oil/stock-out', { token: potato, body: { quantity: 40 } })).status).toBe(200);
    expect((await call('GET', '/api/inventory/ing-oil', { token: potato })).data.current_stock).toBe(before + 60);
    const logs = await call('GET', '/api/stock-logs?limit=50', { token: potato });
    expect(logs.data.length).toBeGreaterThan(0);
    expect(logs.data.every((l: any) => l.stall_id === 'stall-001')).toBe(true);
  });

  it('new ingredients go to the owner\'s stall, whatever stallId they send', async () => {
    const r = await call('POST', '/api/inventory', { token: potato, body: { name: 'Garlic Powder', unit: 'g', stallId: 'stall-002' } });
    expect(r.status).toBe(201);
    expect(r.data.stall_id).toBe('stall-001');
    expect(ids((await call('GET', '/api/inventory', { token: matees })).data)).not.toContain(r.data.id);
  });

  it('owners cannot move ingredients between stalls; admins can', async () => {
    await call('PATCH', '/api/inventory/ing-chili', { token: potato, body: { stallId: 'stall-002' } });
    expect((await call('GET', '/api/inventory/ing-chili', { token: potato })).status).toBe(200);
    const moved = await call('PATCH', '/api/inventory/ing-bbq-powder', { token: admin, body: { stallId: 'stall-001' } });
    expect([200, 404]).toContain(moved.status); // bbq powder only exists in upgraded databases
  });

  it('recipe BOM cannot use another stall\'s ingredient', async () => {
    const own = await call('POST', '/api/recipe-bom', { token: potato, body: { menuItemId: 'item-plain-fries', ingredientId: 'ing-milk', quantityRequired: 5 } });
    expect(own.status).toBe(404);
    const crossByAdmin = await call('POST', '/api/recipe-bom', { token: admin, body: { menuItemId: 'item-plain-fries', ingredientId: 'ing-milk', quantityRequired: 5 } });
    expect(crossByAdmin.status).toBe(400);
  });

  it('EOD audits only cover the owner\'s ingredients', async () => {
    const date = '2026-01-15';
    const denied = await call('POST', '/api/audits/bulk', { token: potato, body: { auditDate: date, entries: [{ ingredientId: 'ing-milk', physicalActualStock: 1 }] } });
    expect(denied.status).toBe(400);
    const ok = await call('POST', '/api/audits/bulk', { token: potato, body: { auditDate: date, entries: [{ ingredientId: 'ing-sourcream', physicalActualStock: 2000 }] } });
    expect(ok.status).toBe(201);
    await call('POST', '/api/audits/bulk', { token: matees, body: { auditDate: date, entries: [{ ingredientId: 'ing-sugar', physicalActualStock: 7000 }] } });

    const mine = await call('GET', `/api/audits?date=${date}`, { token: potato });
    expect(mine.data.map((a: any) => a.ingredient_id)).toEqual(['ing-sourcream']);
    const everyone = await call('GET', `/api/audits?date=${date}`, { token: admin });
    expect(everyone.data.map((a: any) => a.ingredient_id).sort()).toEqual(['ing-sourcream', 'ing-sugar']);
  });

  it('analytics and reports only count the owner\'s orders and stock', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await call('POST', '/api/orders', { body: { stallId: 'stall-002', items: [{ menuItemId: 'item-choco-scoop', quantity: 3 }] } });
    const daily = await call('GET', `/api/analytics/daily?date=${today}`, { token: potato });
    expect(daily.status).toBe(200);
    expect(daily.data.stall).toBe('stall-001');
    expect(daily.data.topItems.map((t: any) => t.name)).not.toContain('Choco Scoop');

    const summary = await call('GET', `/api/reports/summary?from=${today}&to=${today}`, { token: potato });
    expect(summary.status).toBe(200);
    expect(summary.data.stall).toBe('stall-001');
    const adminSummary = await call('GET', `/api/reports/summary?from=${today}&to=${today}`, { token: admin });
    expect(adminSummary.data.daily[0].orders).toBeGreaterThan(summary.data.daily[0]?.orders ?? 0);
  });

  it('users stay admin-only', async () => {
    expect((await call('GET', '/api/users', { token: potato })).status).toBe(403);
  });
});
