import { describe, expect, it } from 'vitest';
import { db } from '../lib/database';
import { call, login } from './helpers';
import { STOCK_IMAGES } from '../lib/stockImages';
import { publicIp } from '../lib/server/router';

describe('order flow', () => {
  it('customer orders and tracks by UUID; cashier confirm deducts stock', async () => {
    const before = (db.prepare(`SELECT current_stock FROM ingredients WHERE id='ing-potato'`).get() as any).current_stock;
    const created = await call('POST', '/api/orders', { body: { stallId: 'stall-001', items: [{ menuItemId: 'item-plain-fries', quantity: 2 }] } });
    expect(created.status).toBe(201);
    const { id, pickup_code } = created.data.order;
    expect(pickup_code).toMatch(/^[A-Z0-9]{4}$/);

    const tracked = await call('GET', `/api/orders/${id}`);
    expect(tracked.status).toBe(200);
    expect(tracked.data.order.status).toBe('PENDING_PAYMENT');

    const owner = await login('potato', 'potato123');
    expect((await call('PATCH', `/api/orders/${id}/status`, { token: owner, body: { status: 'CONFIRMED' } })).status).toBe(200);
    const after = (db.prepare(`SELECT current_stock FROM ingredients WHERE id='ing-potato'`).get() as any).current_stock;
    expect(before - after).toBe(300);

    // Cancelling a confirmed order puts the stock back
    expect((await call('PATCH', `/api/orders/${id}/status`, { token: owner, body: { status: 'CANCELLED' } })).status).toBe(200);
    expect((db.prepare(`SELECT current_stock FROM ingredients WHERE id='ing-potato'`).get() as any).current_stock).toBe(before);
  });

  it('rejects bad quantities and mixed stalls', async () => {
    expect((await call('POST', '/api/orders', { body: { stallId: 'stall-001', items: [{ menuItemId: 'item-plain-fries', quantity: 0 }] } })).status).toBe(400);
    expect((await call('POST', '/api/orders', { body: { stallId: 'stall-001', items: [{ menuItemId: 'item-plain-fries', quantity: 1.5 }] } })).status).toBe(400);
    expect((await call('POST', '/api/orders', { body: { stallId: 'stall-001', items: [{ menuItemId: 'item-choco-scoop', quantity: 1 }] } })).status).toBe(400);
  });
});

describe('health', () => {
  it('reports the address the caller used, not loopback', async () => {
    const res = await call('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.data.ip).toBe('192.168.43.10'); // tests call http://192.168.43.10:8081
    expect(res.data.port).toBe(8081);
  });

  it('when opened via localhost, picks the real Wi-Fi address and skips virtual adapters', () => {
    const v4 = (address: string) => [{ address, family: 'IPv4', internal: false } as any];
    const ifaces = {
      'VirtualBox Host-Only Network': v4('192.168.56.1'),
      'vEthernet (WSL)': v4('172.24.32.1'),
      'Wi-Fi': v4('10.189.1.243'),
      'Loopback Pseudo-Interface 1': [{ address: '127.0.0.1', family: 'IPv4', internal: true } as any],
    };
    expect(publicIp('localhost', ifaces)).toBe('10.189.1.243');
    expect(publicIp('127.0.0.1', ifaces)).toBe('10.189.1.243');
    expect(publicIp('192.168.43.23', ifaces)).toBe('192.168.43.23');
  });
});

describe('uploads', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

  it('accepts a real PNG from staff and serves it back', async () => {
    const owner = await login('potato', 'potato123');
    const up = await call('POST', '/api/uploads', { token: owner, body: { dataBase64: png.toString('base64') } });
    expect(up.status).toBe(201);
    expect(up.data.url).toMatch(/^\/api\/uploads\/[a-f0-9-]+\.png$/);
    const got = await call('GET', up.data.url);
    expect(got.status).toBe(200);
    expect(got.headers.get('content-type')).toBe('image/png');
  });

  it('rejects files that are not images, whatever they claim to be', async () => {
    const owner = await login('potato', 'potato123');
    const res = await call('POST', '/api/uploads', { token: owner, body: { dataBase64: Buffer.from('<script>alert(1)</script>').toString('base64'), mime: 'image/png' } });
    expect(res.status).toBe(415);
  });

  it('rejects images over 2 MB', async () => {
    const owner = await login('potato', 'potato123');
    const big = Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]);
    expect((await call('POST', '/api/uploads', { token: owner, body: { dataBase64: big.toString('base64') } })).status).toBe(413);
  });

  it('serves every bundled offline photo as a JPEG', async () => {
    for (const name of Object.keys(STOCK_IMAGES)) {
      const res = await call('GET', `/api/images/${name}.jpg`);
      expect(res.status, name).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/jpeg');
    }
  });

  it('seeded stalls and menu items use bundled photos only', () => {
    const urls = [
      ...(db.prepare(`SELECT logo_url AS u FROM stalls`).all() as any[]),
      ...(db.prepare(`SELECT image_url AS u FROM menu_items`).all() as any[]),
    ].map((r) => r.u).filter(Boolean);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u).toMatch(/^\/api\/(images|uploads)\//);
  });

  it('blocks path traversal', async () => {
    expect((await call('GET', '/api/uploads/..%2F..%2Fcampusbite.db')).status).toBe(404);
    expect((await call('GET', '/api/images/..%2Fschema.sql')).status).toBe(404);
  });
});
