const BASE='http://localhost:3000';
async function req(path, opts={}){
  const { headers: h, ...rest } = opts;
  const res=await fetch(BASE+path, { headers:{'Content-Type':'application/json', ...(h||{})}, ...rest});
  const text=await res.text();
  let json; try{ json=JSON.parse(text);}catch{ json=text;}
  if(!res.ok) throw new Error(`${opts.method||'GET'} ${path} ${res.status} ${JSON.stringify(json).slice(0,600)}`);
  return json;
}
console.log('=== Hybrid Auth Smoke Test ===');

// login admin
const adminLogin = await req('/api/auth/login', { method:'POST', body: JSON.stringify({username:'admin', pin:'admin123'})});
console.log('1 admin login', adminLogin.user.role, adminLogin.token.slice(0,8));
const adminId = adminLogin.token;

const grillLogin = await req('/api/auth/login', { method:'POST', body: JSON.stringify({username:'grill', pin:'grill123'})});
console.log('2 grill login', grillLogin.user.role, grillLogin.user.stall_id);
const grillId = grillLogin.token;

const brewLogin = await req('/api/auth/login', { method:'POST', body: JSON.stringify({username:'brew', pin:'brew123'})});
console.log('3 brew login', brewLogin.user.role, brewLogin.user.stall_id);
const brewId = brewLogin.token;

// invalid login
try{ await req('/api/auth/login', {method:'POST', body: JSON.stringify({username:'admin', pin:'wrong'})}); console.error('4 invalid should fail'); process.exit(1);}catch(e){ console.log('4 invalid login correctly 401', e.message.slice(0,60));}

// list users as admin (should work)
const users = await req('/api/users', { headers:{'x-user-id': adminId}});
console.log('5 admin list users', users.map(u=>`${u.username}:${u.role}`).join(', '));

// grill cannot list users (403)
try{ await req('/api/users', { headers:{'x-user-id': grillId}}); console.error('6 grill list should 403'); process.exit(1);}catch(e){ console.log('6 grill list correctly forbidden', e.message.slice(0,80));}

// Admin creates new stall
const newStall = await req('/api/stalls', { method:'POST', headers:{'x-user-id': adminId}, body: JSON.stringify({ name:'Test Stall', description:'Hybrid test' })});
console.log('7 admin created stall', newStall.id, newStall.name);

// Grill cannot create stall (403)
try{ await req('/api/stalls', { method:'POST', headers:{'x-user-id': grillId}, body: JSON.stringify({ name:'Hax Stall'})}); console.error('8 grill stall create should 403'); process.exit(1);}catch(e){ console.log('8 grill create stall correctly 403', e.message.slice(0,80));}

// Admin creates category for grill's stall (stall-001)
const cat1 = await req('/api/categories', { method:'POST', headers:{'x-user-id': adminId}, body: JSON.stringify({ stallId:'stall-001', name:'Test Cat Admin', displayOrder: 99 })});
console.log('9 admin created cat for grill stall', cat1.id);

// Grill creates category for own stall (should succeed)
const catGrill = await req('/api/categories', { method:'POST', headers:{'x-user-id': grillId}, body: JSON.stringify({ stallId:'stall-001', name:'Grill Own Cat', displayOrder: 10 })});
console.log('10 grill created own cat', catGrill.id);

// Grill tries to create cat for brew's stall (stall-002) -> 403
try{ await req('/api/categories', { method:'POST', headers:{'x-user-id': grillId}, body: JSON.stringify({ stallId:'stall-002', name:'Hax Cat'})}); console.error('11 grill hax cat should 403'); process.exit(1);}catch(e){ console.log('11 grill hax cat correctly 403', e.message.slice(0,80));}

// Brew creates cat for own stall
const catBrew = await req('/api/categories', { method:'POST', headers:{'x-user-id': brewId}, body: JSON.stringify({ stallId:'stall-002', name:'Brew Own Cat', displayOrder: 5 })});
console.log('12 brew created own cat', catBrew.id);

// Admin creates menu item in grill stall
const itemAdmin = await req('/api/menu', { method:'POST', headers:{'x-user-id': adminId}, body: JSON.stringify({ stallId:'stall-001', categoryId: cat1.id, name:'Admin Burger', price: 123, description:'admin created' })});
console.log('13 admin created menu item', itemAdmin.id, itemAdmin.name);

// Grill creates menu item in own stall (should succeed)
const itemGrill = await req('/api/menu', { method:'POST', headers:{'x-user-id': grillId}, body: JSON.stringify({ stallId:'stall-001', categoryId: catGrill.id, name:'Grill Special', price: 99, description:'grill owner item' })});
console.log('14 grill created own item', itemGrill.id);

// Grill tries to create item in brew stall -> 403
try{ await req('/api/menu', { method:'POST', headers:{'x-user-id': grillId}, body: JSON.stringify({ stallId:'stall-002', categoryId: catBrew.id, name:'Hax Burger', price: 1 })});
 console.error('15 grill hax item should 403'); process.exit(1);}catch(e){ console.log('15 grill hax item correctly 403', e.message.slice(0,80));}

// Brew cannot edit grill item
try{ await req(`/api/menu/${itemGrill.id}`, { method:'PATCH', headers:{'x-user-id': brewId}, body: JSON.stringify({ price: 999 })}); console.error('16 brew edit grill should 403'); process.exit(1);}catch(e){ console.log('16 brew edit grill correctly 403', e.message.slice(0,80));}

// Grill edits own item (should succeed)
const edited = await req(`/api/menu/${itemGrill.id}`, { method:'PATCH', headers:{'x-user-id': grillId}, body: JSON.stringify({ price: 111 })});
console.log('17 grill edited own item', edited.price===111?'ok':'fail', edited.price);

// Admin edits any (should succeed)
const adminEdit = await req(`/api/menu/${itemGrill.id}`, { method:'PATCH', headers:{'x-user-id': adminId}, body: JSON.stringify({ price: 150 })});
console.log('18 admin edited grill item', adminEdit.price);

// Inventory: admin can stock-in, grill cannot
const invBefore = await req('/api/inventory');
const patty = invBefore.find(i=>i.id==='ing-patty');
console.log('19 patty stock', patty.current_stock);
const afterAdminStock = await req('/api/inventory/ing-patty/stock-in', { method:'POST', headers:{'x-user-id': adminId}, body: JSON.stringify({ quantity: 2, reason:'hybrid test' })});
console.log('20 admin stock-in ok', afterAdminStock.current_stock);
try{ await req('/api/inventory/ing-patty/stock-in', { method:'POST', headers:{'x-user-id': grillId}, body: JSON.stringify({ quantity: 1 })}); console.error('21 grill stock-in should 403'); process.exit(1);}catch(e){ console.log('21 grill stock-in correctly 403', e.message.slice(0,60));}

// BOM: grill can create BOM for own item, but not for brew item
const ing = (await req('/api/ingredients'))[0];
const bomGrill = await req('/api/recipe-bom', { method:'POST', headers:{'x-user-id': grillId}, body: JSON.stringify({ menuItemId: itemGrill.id, ingredientId: ing.id, quantityRequired: 5 })});
console.log('22 grill created BOM for own item', bomGrill.id);
// brew tries to create BOM for grill item -> 403
try{ await req('/api/recipe-bom', { method:'POST', headers:{'x-user-id': brewId}, body: JSON.stringify({ menuItemId: itemGrill.id, ingredientId: ing.id, quantityRequired: 1 })}); console.error('23 brew bom grill should 403'); process.exit(1);}catch(e){ console.log('23 brew bom hax correctly 403', e.message.slice(0,80));}

// SPA check
const spa = await fetch(BASE+'/');
console.log('24 SPA', spa.ok, (await spa.text()).slice(0,60).replace(/\n/g,' '));

console.log('\n=== HYBRID SMOKE PASSED ===');
// cleanup: delete test data as admin
await req(`/api/menu/${itemAdmin.id}`, { method:'DELETE', headers:{'x-user-id': adminId}});
await req(`/api/menu/${itemGrill.id}`, { method:'DELETE', headers:{'x-user-id': adminId}});
await req(`/api/categories/${cat1.id}`, { method:'DELETE', headers:{'x-user-id': adminId}});
await req(`/api/categories/${catGrill.id}`, { method:'DELETE', headers:{'x-user-id': adminId}});
await req(`/api/categories/${catBrew.id}`, { method:'DELETE', headers:{'x-user-id': adminId}});
await req(`/api/stalls/${newStall.id}`, { method:'DELETE', headers:{'x-user-id': adminId}});
await req(`/api/recipe-bom/${bomGrill.id}`, { method:'DELETE', headers:{'x-user-id': adminId}}).catch(()=>{});
console.log('cleanup done');
