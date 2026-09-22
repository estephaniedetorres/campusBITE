import { db } from './database.js';
import { v4 as uuidv4 } from 'uuid';

function upsertStall(id: string, name: string, desc: string, logoUrl?: string, rating?: number, ratingCount?: number) {
  db.prepare(`INSERT INTO stalls (id, name, description, logo_url, rating, rating_count) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, logo_url=COALESCE(excluded.logo_url, stalls.logo_url), rating=COALESCE(excluded.rating, stalls.rating), rating_count=COALESCE(excluded.rating_count, stalls.rating_count)`).run(id, name, desc, logoUrl || null, rating ?? 4.8, ratingCount ?? 128);
  if (logoUrl) {
    try { db.prepare(`UPDATE stalls SET logo_url=? WHERE id=? AND (logo_url IS NULL OR logo_url='')`).run(logoUrl, id); } catch {}
  }
  if (rating !== undefined) {
    try { db.prepare(`UPDATE stalls SET rating=?, rating_count=? WHERE id=?`).run(rating, ratingCount ?? 128, id); } catch {}
  }
}
function upsertCategory(id: string, stallId: string, name: string, order: number) {
  db.prepare(`INSERT INTO categories (id, stall_id, name, display_order) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, display_order=excluded.display_order, stall_id=excluded.stall_id`).run(id, stallId, name, order);
}
function upsertIngredient(id: string, name: string, unit: string, stock: number, threshold: number, cost: number) {
  db.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES (?,?,?,?,?,?)`)
    .run(id, name, unit, stock, threshold, cost);
}
function upsertMenuItem(id: string, stallId: string, catId: string, name: string, price: number, desc: string, imageUrl?: string, rating?: number, ratingCount?: number) {
  db.prepare(`INSERT INTO menu_items (id, stall_id, category_id, name, price, description, image_url, rating, rating_count) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, price=excluded.price, description=excluded.description, image_url=excluded.image_url, stall_id=excluded.stall_id, category_id=excluded.category_id, rating=COALESCE(excluded.rating, menu_items.rating), rating_count=COALESCE(excluded.rating_count, menu_items.rating_count)`).run(id, stallId, catId, name, price, desc, imageUrl || null, rating ?? 4.9, ratingCount ?? 56);
}
function upsertBom(menuItemId: string, ingredientId: string, qty: number) {
  db.prepare(`INSERT OR IGNORE INTO recipe_bom (id, menu_item_id, ingredient_id, quantity_required) VALUES (?,?,?,?)`)
    .run(uuidv4(), menuItemId, ingredientId, qty);
}
function upsertVariant(menuItemId: string, name: string, price: number, displayOrder: number) {
  const id = `var-${menuItemId}-${name.toLowerCase()}`;
  db.prepare(`INSERT INTO item_variants (id, menu_item_id, name, price, display_order) VALUES (?,?,?,?,?) ON CONFLICT(menu_item_id, name) DO UPDATE SET price=excluded.price, display_order=excluded.display_order`).run(id, menuItemId, name, price, displayOrder);
}

console.log('[Seed] Seeding CampusBITE...');

const stall1 = 'stall-001';
const stall2 = 'stall-002';
// Per clarification: grill->Potato Corner (stall-001), brew->Matees (stall-002)
upsertStall(stall1, 'Potato Corner', 'World Famous Flavored Fries · Loaded Fries', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=200&auto=format&fit=crop&q=60', 4.8, 210);
upsertStall(stall2, 'Matees', 'Ice Cream · Sundaes · Milkshakes', 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=200&auto=format&fit=crop&q=60', 4.7, 156);

const catIceClassic = 'cat-ice-classic';
const catIceSundae = 'cat-ice-sundae';
const catFriesClassic = 'cat-fries-classic';
const catFriesLoaded = 'cat-fries-loaded';

upsertCategory(catIceClassic, stall2, 'Classic Scoops', 1);
upsertCategory(catIceSundae, stall2, 'Sundaes & Shakes', 2);
upsertCategory(catFriesClassic, stall1, 'Flavored Fries', 1);
upsertCategory(catFriesLoaded, stall1, 'Loaded Fries', 2);
// Clean legacy categories if empty
try { db.prepare(`DELETE FROM categories WHERE id IN ('cat-burgers','cat-rice','cat-drinks','cat-pastries')`).run(); } catch {}

// Ingredients - Matees (ice cream) + Potato Corner (fries) — keep legacy for migration
upsertIngredient('ing-milk', 'Fresh Milk', 'ml', 8000, 1000, 0.03);
upsertIngredient('ing-cream', 'Heavy Cream', 'ml', 6000, 800, 0.08);
upsertIngredient('ing-sugar', 'Sugar', 'g', 8000, 1000, 0.02);
upsertIngredient('ing-vanilla', 'Vanilla Syrup', 'ml', 3000, 400, 0.12);
upsertIngredient('ing-chocolate-syrup', 'Chocolate Syrup', 'ml', 3000, 400, 0.15);
upsertIngredient('ing-strawberry', 'Strawberry Sauce', 'ml', 2500, 300, 0.14);
upsertIngredient('ing-potato', 'Potatoes', 'g', 15000, 2000, 0.02);
upsertIngredient('ing-oil', 'Cooking Oil', 'ml', 8000, 1000, 0.04);
upsertIngredient('ing-cheese-powder', 'Cheese Powder', 'g', 3000, 400, 0.20);
upsertIngredient('ing-bbq-powder', 'BBQ Powder', 'g', 3000, 400, 0.18);
upsertIngredient('ing-sourcream', 'Sour Cream Powder', 'g', 2500, 300, 0.22);
upsertIngredient('ing-chili', 'Chili Cheese', 'g', 2500, 300, 0.25);
// Legacy kept for old BOM cleanup
upsertIngredient('ing-bun', 'Burger Bun', 'pcs', 100, 20, 5);
upsertIngredient('ing-patty', 'Beef Patty', 'pcs', 80, 15, 25);
upsertIngredient('ing-cheese', 'Cheese Slice', 'pcs', 120, 20, 8);

// Menu Items — swapped per brew->Matees (stall-002), grill->Potato Corner (stall-001)
upsertMenuItem('item-vanilla-scoop', stall2, catIceClassic, 'Vanilla Scoop', 45, 'Single scoop Madagascar vanilla', 'https://images.unsplash.com/photo-1495147466023-a36482277724?w=500&auto=format&fit=crop&q=60', 4.9, 89);
upsertMenuItem('item-choco-scoop', stall2, catIceClassic, 'Choco Scoop', 49, 'Belgian chocolate', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500&auto=format&fit=crop&q=60', 4.8, 72);
upsertMenuItem('item-strawberry-sundae', stall2, catIceSundae, 'Strawberry Sundae', 89, '2 scoops + strawberry sauce + cream', 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=500&auto=format&fit=crop&q=60', 4.9, 64);
upsertMenuItem('item-plain-fries', stall1, catFriesClassic, 'Plain Fries', 55, 'Crispy classic fries 150g', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500&auto=format&fit=crop&q=60', 4.7, 142);
upsertMenuItem('item-cheese-fries', stall1, catFriesClassic, 'Cheese Fries', 69, 'Fries + cheese powder', 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=500&auto=format&fit=crop&q=60', 4.8, 98);
upsertMenuItem('item-loaded-fries', stall1, catFriesLoaded, 'Loaded Chili Cheese Fries', 99, 'Fries + chili cheese + sour cream', 'https://images.unsplash.com/photo-1630384060421-c342d74f260f?w=500&auto=format&fit=crop&q=60', 4.9, 76);
// Variants — Potato Corner fries (Small/Medium/Large) + Matees (Cone/Small Cup/Large Cup/Bun)
upsertVariant('item-plain-fries', 'Small', 55, 1);
upsertVariant('item-plain-fries', 'Medium', 75, 2);
upsertVariant('item-plain-fries', 'Large', 95, 3);
upsertVariant('item-cheese-fries', 'Small', 69, 1);
upsertVariant('item-cheese-fries', 'Medium', 89, 2);
upsertVariant('item-cheese-fries', 'Large', 109, 3);
upsertVariant('item-loaded-fries', 'Small', 99, 1);
upsertVariant('item-loaded-fries', 'Medium', 119, 2);
upsertVariant('item-loaded-fries', 'Large', 139, 3);
// Matees — Cone / Small Cup / Large Cup / Bun
upsertVariant('item-vanilla-scoop', 'Cone', 45, 1);
upsertVariant('item-vanilla-scoop', 'Small Cup', 45, 2);
upsertVariant('item-vanilla-scoop', 'Large Cup', 65, 3);
upsertVariant('item-vanilla-scoop', 'Bun', 55, 4);
upsertVariant('item-choco-scoop', 'Cone', 49, 1);
upsertVariant('item-choco-scoop', 'Small Cup', 49, 2);
upsertVariant('item-choco-scoop', 'Large Cup', 69, 3);
upsertVariant('item-choco-scoop', 'Bun', 59, 4);
upsertVariant('item-strawberry-sundae', 'Small Cup', 89, 1);
upsertVariant('item-strawberry-sundae', 'Large Cup', 109, 2);
upsertVariant('item-strawberry-sundae', 'Cone', 89, 3);

// Clean legacy items for Matees/Potato demo — FK safe (delete BOM → order_items → menu)
try { db.prepare(`DELETE FROM recipe_bom WHERE menu_item_id IN ('item-burger-classic','item-burger-double','item-rice-chicken','item-coffee-latte','item-milk-tea','item-croissant')`).run(); } catch {}
try { db.prepare(`DELETE FROM order_items WHERE menu_item_id IN ('item-burger-classic','item-burger-double','item-rice-chicken','item-coffee-latte','item-milk-tea','item-croissant')`).run(); } catch {}
try { db.prepare(`DELETE FROM menu_items WHERE id IN ('item-burger-classic','item-burger-double','item-rice-chicken','item-coffee-latte','item-milk-tea','item-croissant')`).run(); } catch { db.prepare(`UPDATE menu_items SET is_available=0 WHERE id IN ('item-burger-classic','item-burger-double','item-rice-chicken','item-coffee-latte','item-milk-tea','item-croissant')`).run(); }

// BOM — Matees
upsertBom('item-vanilla-scoop', 'ing-milk', 60);
upsertBom('item-vanilla-scoop', 'ing-cream', 40);
upsertBom('item-vanilla-scoop', 'ing-sugar', 15);
upsertBom('item-vanilla-scoop', 'ing-vanilla', 10);

upsertBom('item-choco-scoop', 'ing-milk', 50);
upsertBom('item-choco-scoop', 'ing-cream', 40);
upsertBom('item-choco-scoop', 'ing-sugar', 15);
upsertBom('item-choco-scoop', 'ing-chocolate-syrup', 20);

upsertBom('item-strawberry-sundae', 'ing-milk', 80);
upsertBom('item-strawberry-sundae', 'ing-cream', 60);
upsertBom('item-strawberry-sundae', 'ing-sugar', 20);
upsertBom('item-strawberry-sundae', 'ing-strawberry', 30);
upsertBom('item-strawberry-sundae', 'ing-vanilla', 10);

// BOM — Potato Corner
upsertBom('item-plain-fries', 'ing-potato', 150);
upsertBom('item-plain-fries', 'ing-oil', 20);

upsertBom('item-cheese-fries', 'ing-potato', 150);
upsertBom('item-cheese-fries', 'ing-oil', 20);
upsertBom('item-cheese-fries', 'ing-cheese-powder', 15);

upsertBom('item-loaded-fries', 'ing-potato', 150);
upsertBom('item-loaded-fries', 'ing-oil', 20);
upsertBom('item-loaded-fries', 'ing-chili', 25);
upsertBom('item-loaded-fries', 'ing-sourcream', 15);
upsertBom('item-loaded-fries', 'ing-cheese-powder', 10);
// Legacy BOMs kept for history (no delete to avoid FK)

function upsertUser(id: string, username: string, pin: string, role: string, stallId: string | null, displayName: string) {
  db.prepare(`INSERT INTO users (id, username, pin, role, stall_id, display_name) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username, pin=excluded.pin, role=excluded.role, stall_id=excluded.stall_id, display_name=excluded.display_name`).run(id, username, pin, role, stallId, displayName);
}

// Users — per request: user-potato and user-matees (brew->Matees stall-002, grill->Potato stall-001)
try { db.prepare(`DELETE FROM users WHERE id IN ('user-grill','user-brew')`).run(); } catch {}
upsertUser('user-admin', 'admin', 'admin123', 'ADMIN', null, 'Canteen Manager');
upsertUser('user-potato', 'potato', 'potato123', 'STALL_OWNER', stall1, 'Potato Corner Owner');
upsertUser('user-matees', 'matees', 'matees123', 'STALL_OWNER', stall2, 'Matees Owner');

console.log('[Seed] Done. Sample data ready.');
const counts = {
  stalls: (db.prepare(`SELECT count(*) as c FROM stalls`).get() as any).c,
  items: (db.prepare(`SELECT count(*) as c FROM menu_items`).get() as any).c,
  ingredients: (db.prepare(`SELECT count(*) as c FROM ingredients`).get() as any).c,
  boms: (db.prepare(`SELECT count(*) as c FROM recipe_bom`).get() as any).c,
  users: (db.prepare(`SELECT count(*) as c FROM users`).get() as any).c,
};
console.log('[Seed] Counts:', counts);
console.log('[Seed] Stalls:', (db.prepare(`SELECT id, name FROM stalls`).all() as any[]).map(s=>`${s.id}:${s.name}`).join(', '));
console.log('[Seed] Logins: admin/admin123 (ADMIN), matees/matees123 (Matees), potato/potato123 (Potato Corner)');
