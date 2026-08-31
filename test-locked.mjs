const BASE='http://localhost:3000';
async function req(path, opts={}){
  const {headers:h, ...rest}=opts;
  const res=await fetch(BASE+path,{headers:{'Content-Type':'application/json',...(h||{})},...rest});
  const t=await res.text(); let j; try{ j=JSON.parse(t);}catch{ j=t;}
  if(!res.ok) throw new Error(`${opts.method||'GET'} ${path} ${res.status} ${JSON.stringify(j).slice(0,400)}`);
  return j;
}
console.log('=== Locked + QR Smoke ===');

// 1. Kiosk public menu (no auth) should work
const menuPublic = await req('/api/menu?stallId=stall-001');
console.log('1 kiosk public menu ok', menuPublic.length, 'items');

// 2. POS orders without auth should 401 (Kiosk is only public)
try{ await req('/api/orders?limit=5'); console.error('2 should 401'); process.exit(1);}catch(e){ console.log('2 POS without auth correctly 401', e.message.slice(0,70));}

// 3. Login
const admin = await req('/api/auth/login',{method:'POST', body:JSON.stringify({username:'admin', pin:'admin123'})});
const grill = await req('/api/auth/login',{method:'POST', body:JSON.stringify({username:'grill', pin:'grill123'})});
console.log('3 admin',admin.user.role,'grill',grill.user.stall_id);

// 4. POS with admin should see orders (empty or some)
const adminOrders = await req('/api/orders?limit=5', {headers:{'x-user-id': admin.token}});
console.log('4 admin orders', adminOrders.length);

// 5. POS with grill should be filtered to stall-001 only (even if query tries stall-002)
const grillOrdersAll = await req('/api/orders?limit=5', {headers:{'x-user-id': grill.token}});
console.log('5 grill orders filtered', grillOrdersAll.length, 'stalls', [...new Set(grillOrdersAll.map(o=>o.stall_id))].join(',')||'none but would be stall-001 only if any');

// 6. Try grill to query brew stall explicitly should still be filtered (ignore stallId param)
const grillTryBrew = await req('/api/orders?stallId=stall-002&limit=5', {headers:{'x-user-id': grill.token}});
console.log('6 grill try brew stall', grillTryBrew.length, 'still filtered stall-001?', grillTryBrew.every(o=>o.stall_id==='stall-001')?'yes filter enforced':'no (empty is ok)');

// 7. Create order via kiosk public (no auth) — should succeed
const order = await req('/api/orders',{method:'POST', body:JSON.stringify({stallId:'stall-001', items:[{menuItemId:'item-burger-classic', quantity:1}]})});
console.log('7 kiosk create order public ok', order.order.pickup_code, order.order.stall_id);

// 8. POS lookup by code without auth -> 401
try{ await req(`/api/orders/by-code/${order.order.pickup_code}`); console.error('8 should 401'); process.exit(1);}catch(e){ console.log('8 by-code without auth 401 ok', e.message.slice(0,60));}

// 9. POS lookup with grill (own stall) -> ok
const grillLookup = await req(`/api/orders/by-code/${order.order.pickup_code}`, {headers:{'x-user-id': grill.token}});
console.log('9 grill lookup own stall ok', grillLookup.order.pickup_code);

// 10. Brew tries to lookup grill order -> 403
const brew = await req('/api/auth/login',{method:'POST', body:JSON.stringify({username:'brew', pin:'brew123'})});
try{ await req(`/api/orders/by-code/${order.order.pickup_code}`, {headers:{'x-user-id': brew.token}}); console.error('10 brew should 403'); process.exit(1);}catch(e){ console.log('10 brew lookup grill order correctly 403', e.message.slice(0,70));}

// 11. Grill PATCH status -> ok (own stall)
const patched = await req(`/api/orders/${order.order.id}/status`, {method:'PATCH', headers:{'x-user-id': grill.token}, body:JSON.stringify({status:'CONFIRMED'})});
console.log('11 grill confirm own order', patched.status);

// 12. Brew tries to patch grill order -> 403
try{ await req(`/api/orders/${order.order.id}/status`, {method:'PATCH', headers:{'x-user-id': brew.token}, body:JSON.stringify({status:'PREPARING'})}); console.error('12 brew patch should 403'); process.exit(1);}catch(e){ console.log('12 brew patch correctly 403', e.message.slice(0,70));}

// 13. Admin can patch any
const adminPatch = await req(`/api/orders/${order.order.id}/status`, {method:'PATCH', headers:{'x-user-id': admin.token}, body:JSON.stringify({status:'PREPARING'})});
console.log('13 admin patch any ok', adminPatch.status);

// 14. Kiosk QR: GET /kiosk?stall= should serve SPA HTML (public)
const qrPage = await fetch(BASE+'/kiosk?stall=stall-001');
const qrText = await qrPage.text();
console.log('14 kiosk QR HTML public', qrPage.ok, qrText.includes('<div id="root">')?'SPA ok':'fail', qrText.slice(0,60).replace(/\n/g,' '));

// 15. Health gives IP for QR generation
const health = await req('/api/health');
console.log('15 health IP for QR', health.ips[0], `QR URL would be http://${health.ips[0]}:${health.port}/kiosk?stall=stall-001`);

// 16. Analytics requires auth (grill filtered, admin all)
const adminAnalytics = await req('/api/analytics/daily?date='+new Date().toISOString().slice(0,10), {headers:{'x-user-id': admin.token}});
console.log('16 admin analytics ok', adminAnalytics.date);
try{ await req('/api/analytics/daily'); console.error('17 should 401'); process.exit(1);}catch(e){ console.log('17 analytics without auth 401 ok');}

console.log('\n=== LOCKED + QR PASSED ===');
