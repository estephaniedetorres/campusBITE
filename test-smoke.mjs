// Smoke test for CampusBITE - runs against live server at localhost:3000
// Covers: health, stalls, menu, order create -> confirm (BOM) -> wastage -> audit -> analytics

const BASE = 'http://localhost:3000';

async function req(path, opts={}) {
  const res = await fetch(BASE+path, { headers: {'Content-Type':'application/json'}, ...opts});
  const text = await res.text();
  let json;
  try { json=JSON.parse(text);} catch { json=text; }
  if (!res.ok) throw new Error(`${opts.method||'GET'} ${path} ${res.status} ${JSON.stringify(json).slice(0,500)}`);
  return json;
}

console.log('=== CampusBITE Smoke Test ===');

// 1. Health
const health = await req('/api/health');
console.log('1. Health OK', health.ips, health.port);

// 2. Stalls & menu
const stalls = await req('/api/stalls');
console.log('2. Stalls', stalls.map(s=>s.name));
const menu = await req('/api/menu?stallId=stall-001');
console.log('3. Menu', menu.map(m=>`${m.name} ₱${m.price}`).join(', '));

// 3. Check inventory before
const invBefore = await req('/api/inventory');
const pattyBefore = invBefore.find(i=>i.id==='ing-patty');
console.log('4. Patty before', pattyBefore.current_stock, pattyBefore.unit);

// 4. Create order (student kiosk checkout)
const orderRes = await req('/api/orders', { method:'POST', body: JSON.stringify({
  stallId: 'stall-001',
  items: [{ menuItemId: 'item-burger-double', quantity: 2 }], // 2 double cheeseburgers = 4 patties, 2 buns, 4 cheese etc
})});
console.log('5. Created order', orderRes.order.pickup_code, orderRes.order.status, `total ₱${orderRes.order.total_amount}`);
const orderId = orderRes.order.id;
const pickupCode = orderRes.order.pickup_code;

// 5. Lookup by code (POS)
const byCode = await req(`/api/orders/by-code/${pickupCode}`);
console.log('6. Lookup by code', byCode.order.pickup_code, byCode.items.length + ' items');

// 6. Confirm cash -> triggers BOM deduction
const confirmed = await req(`/api/orders/${orderId}/status`, { method:'PATCH', body: JSON.stringify({ status:'CONFIRMED' })});
console.log('7. Confirmed', confirmed.status);

// 7. Check inventory after BOM
const invAfter = await req('/api/inventory');
const pattyAfter = invAfter.find(i=>i.id==='ing-patty');
console.log('8. Patty after (should be -4)', pattyAfter.current_stock, `(was ${pattyBefore.current_stock}) diff=${pattyAfter.current_stock - pattyBefore.current_stock}`);
if (pattyAfter.current_stock !== pattyBefore.current_stock - 4) {
  console.error('BOM deduction FAILED! Expected -4 patties');
  process.exit(1);
} else console.log('   ✓ BOM atomic deduction correct');

// 8. Check stock logs
const logs = await req('/api/stock-logs?limit=5');
console.log('9. Recent logs', logs.slice(0,3).map(l=>`${l.change_type} ${l.ingredient_name} ${l.quantity_delta}`));

// 9. Stock-in (admin)
const stockIn = await req(`/api/inventory/ing-patty/stock-in`, { method:'POST', body: JSON.stringify({ quantity: 10, reason:'Test restock' })});
console.log('10. Stock-in patty +10 ->', stockIn.current_stock);

// 10. Wastage
const wastage = await req(`/api/inventory/ing-patty/stock-out`, { method:'POST', body: JSON.stringify({ quantity: 1, reason:'Test wastage' })});
console.log('11. Wastage -1 ->', wastage.current_stock);

// 11. Get recipe BOM
const bom = await req('/api/recipe-bom?menuItemId=item-burger-double');
console.log('12. BOM for Double', bom.map(b=>`${b.ingredient_name} ${b.quantity_required}${b.unit}`).join(', '));

// 12. EOD audit variance
const today = new Date().toISOString().slice(0,10);
const audit = await req('/api/audits', { method:'POST', body: JSON.stringify({
  auditDate: today,
  ingredientId: 'ing-bun',
  physicalActualStock: 999,
  notes: 'Smoke test audit'
})});
console.log('13. Audit variance bun', audit);

// 13. Analytics
const analytics = await req(`/api/analytics/daily?date=${today}`);
console.log('14. Analytics', analytics.revenue, `top: ${analytics.topItems[0]?.name || 'none'}`);

// 14. SPA check
const spa = await fetch(BASE+'/');
const spaText = await spa.text();
console.log('15. SPA HTML', spa.ok, spaText.slice(0,80).replace(/\n/g,' '), '...');

// 15. WS check (simple connect)
import WebSocket from 'ws';
await new Promise((resolve, reject)=>{
  const ws = new WebSocket('ws://localhost:3000/ws');
  ws.on('open', ()=>{ ws.send(JSON.stringify({type:'JOIN', room:'kds'})); console.log('16. WS connected and joined kds'); ws.close(); resolve(null); });
  ws.on('error', reject);
  setTimeout(()=>reject(new Error('WS timeout')), 4000);
});

console.log('\n=== ALL SMOKE TESTS PASSED ===');
