import { beforeAll, describe, expect, it } from 'vitest';
import { routes } from '../lib/server/router';
import { call, login } from './helpers';

const fill = (p: string) => p.replace(':file', 'missing.jpg').replace(/:[a-zA-Z]+/g, 'does-not-exist');
const sample = { stallId: 'stall-001', name: 'x', status: 'CONFIRMED' };

let owner: string; // potato → stall-001
let admin: string;

beforeAll(async () => {
  owner = await login('potato', 'potato123');
  admin = await login('admin', 'admin123');
});

describe('every route enforces its declared permission', () => {
  for (const r of routes) {
    const path = fill(r.path);
    const label = `${r.method} ${r.path} [${r.auth}]`;

    if (r.auth === 'public') {
      it(`${label} works without login`, async () => {
        const res = await call(r.method, path, { body: r.method === 'GET' ? undefined : sample });
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
      });
    } else {
      it(`${label} rejects anonymous callers`, async () => {
        const res = await call(r.method, path, { body: r.method === 'GET' ? undefined : sample });
        expect(res.status).toBe(401);
      });
    }

    if (r.auth === 'admin') {
      it(`${label} rejects stall owners`, async () => {
        const res = await call(r.method, path, { token: owner, body: r.method === 'GET' ? undefined : sample });
        expect(res.status).toBe(403);
      });
      it(`${label} lets admins through`, async () => {
        const res = await call(r.method, path, { token: admin, body: r.method === 'GET' ? undefined : sample });
        expect([401, 403]).not.toContain(res.status);
      });
    }
  }
});

describe('stall owners are limited to their own stall', () => {
  it('cannot add menu items to another stall', async () => {
    const res = await call('POST', '/api/menu', { token: owner, body: { stallId: 'stall-002', categoryId: 'cat-ice-classic', name: 'Hack', price: 1 } });
    expect(res.status).toBe(403);
  });

  it('can add menu items to their own stall', async () => {
    const res = await call('POST', '/api/menu', { token: owner, body: { stallId: 'stall-001', categoryId: 'cat-fries-classic', name: 'Garlic Fries', price: 70 } });
    expect(res.status).toBe(201);
  });

  it('cannot edit another stall\'s item', async () => {
    const res = await call('PATCH', '/api/menu/item-vanilla-scoop', { token: owner, body: { price: 1 } });
    expect(res.status).toBe(403);
  });

  it('only sees and updates their own orders', async () => {
    const other = await call('POST', '/api/orders', { body: { stallId: 'stall-002', items: [{ menuItemId: 'item-choco-scoop', quantity: 1 }] } });
    expect(other.status).toBe(201);
    const list = await call('GET', '/api/orders', { token: owner });
    expect(list.data.every((o: any) => o.stall_id === 'stall-001')).toBe(true);
    expect((await call('GET', `/api/orders/by-code/${other.data.order.pickup_code}`, { token: owner })).status).toBe(404);
    expect((await call('PATCH', `/api/orders/${other.data.order.id}/status`, { token: owner, body: { status: 'CONFIRMED' } })).status).toBe(403);
  });

  it('only sees BOM rows for their own stall', async () => {
    const res = await call('GET', '/api/recipe-bom', { token: owner });
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.every((r: any) => r.stall_id === 'stall-001')).toBe(true);
  });
});
