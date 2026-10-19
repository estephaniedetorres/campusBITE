// CampusBITE seed data (stalls, menu, variants, ingredients, BOM, demo staff).
// Idempotent: safe to run repeatedly. Never overwrites an existing user's password.
import { randomUUID } from 'node:crypto';
import { hashPasswordSync } from './server/password';
import { stockImage } from './stockImages';

export const DEMO_USERS = [
  { id: 'user-admin', username: 'admin', password: 'admin123', role: 'ADMIN', stallId: null, displayName: 'Canteen Manager' },
  { id: 'user-potato', username: 'potato', password: 'potato123', role: 'STALL_OWNER', stallId: 'stall-001', displayName: 'Potato Corner Owner' },
  { id: 'user-matees', username: 'matees', password: 'matees123', role: 'STALL_OWNER', stallId: 'stall-002', displayName: 'Matees Owner' },
] as const;

export function seedDatabase(db: any, log: (msg: string) => void = () => {}) {
  const run = db.transaction(() => {
    const stall = (id: string, name: string, desc: string, logo: string, rating: number, count: number) =>
      db.prepare(`INSERT INTO stalls (id, name, description, logo_url, rating, rating_count) VALUES (?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, logo_url=excluded.logo_url`)
        .run(id, name, desc, logo, rating, count);
    const category = (id: string, stallId: string, name: string, order: number) =>
      db.prepare(`INSERT INTO categories (id, stall_id, name, display_order) VALUES (?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, display_order=excluded.display_order, stall_id=excluded.stall_id`)
        .run(id, stallId, name, order);
    const ingredient = (id: string, name: string, unit: string, stock: number, min: number, cost: number) => {
      const stallId = /potato|oil|cheese-powder|sourcream|chili/.test(id) ? 'stall-001' : 'stall-002';
      db.prepare(`INSERT OR IGNORE INTO ingredients (id, stall_id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES (?,?,?,?,?,?,?)`)
        .run(id, stallId, name, unit, stock, min, cost);
    };
    const item = (id: string, stallId: string, catId: string, name: string, price: number, desc: string, img: string, rating: number, count: number) =>
      db.prepare(`INSERT INTO menu_items (id, stall_id, category_id, name, price, description, image_url, rating, rating_count) VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, price=excluded.price, description=excluded.description, image_url=excluded.image_url,
        stall_id=excluded.stall_id, category_id=excluded.category_id`)
        .run(id, stallId, catId, name, price, desc, img, rating, count);
    const variant = (menuItemId: string, name: string, price: number, order: number) =>
      db.prepare(`INSERT INTO item_variants (id, menu_item_id, name, price, display_order) VALUES (?,?,?,?,?)
        ON CONFLICT(menu_item_id, name) DO UPDATE SET price=excluded.price, display_order=excluded.display_order`)
        .run(`var-${menuItemId}-${name.toLowerCase().replace(/\s+/g, '-')}`, menuItemId, name, price, order);
    const bom = (menuItemId: string, ingredientId: string, qty: number) =>
      db.prepare(`INSERT OR IGNORE INTO recipe_bom (id, menu_item_id, ingredient_id, quantity_required) VALUES (?,?,?,?)`)
        .run(randomUUID(), menuItemId, ingredientId, qty);

    stall('stall-001', 'Potato Corner', 'World Famous Flavored Fries · Loaded Fries', stockImage('potato-corner'), 4.8, 210);
    stall('stall-002', 'Matees', 'Ice Cream · Sundaes · Milkshakes', stockImage('matees'), 4.7, 156);

    category('cat-fries-classic', 'stall-001', 'Flavored Fries', 1);
    category('cat-fries-loaded', 'stall-001', 'Loaded Fries', 2);
    category('cat-ice-classic', 'stall-002', 'Classic Scoops', 1);
    category('cat-ice-sundae', 'stall-002', 'Sundaes & Shakes', 2);

    ingredient('ing-milk', 'Fresh Milk', 'ml', 8000, 1000, 0.03);
    ingredient('ing-cream', 'Heavy Cream', 'ml', 6000, 800, 0.08);
    ingredient('ing-sugar', 'Sugar', 'g', 8000, 1000, 0.02);
    ingredient('ing-vanilla', 'Vanilla Syrup', 'ml', 3000, 400, 0.12);
    ingredient('ing-chocolate-syrup', 'Chocolate Syrup', 'ml', 3000, 400, 0.15);
    ingredient('ing-strawberry', 'Strawberry Sauce', 'ml', 2500, 300, 0.14);
    ingredient('ing-potato', 'Potatoes', 'g', 15000, 2000, 0.02);
    ingredient('ing-oil', 'Cooking Oil', 'ml', 8000, 1000, 0.04);
    ingredient('ing-cheese-powder', 'Cheese Powder', 'g', 3000, 400, 0.2);
    ingredient('ing-sourcream', 'Sour Cream Powder', 'g', 2500, 300, 0.22);
    ingredient('ing-chili', 'Chili Cheese', 'g', 2500, 300, 0.25);

    item('item-vanilla-scoop', 'stall-002', 'cat-ice-classic', 'Vanilla Scoop', 45, 'Single scoop Madagascar vanilla', stockImage('matees'), 4.9, 89);
    item('item-choco-scoop', 'stall-002', 'cat-ice-classic', 'Choco Scoop', 49, 'Belgian chocolate', stockImage('choco-scoop'), 4.8, 72);
    item('item-strawberry-sundae', 'stall-002', 'cat-ice-sundae', 'Strawberry Sundae', 89, '2 scoops + strawberry sauce + cream', stockImage('matees'), 4.9, 64);
    item('item-plain-fries', 'stall-001', 'cat-fries-classic', 'Plain Fries', 55, 'Crispy classic fries 150g', stockImage('potato-corner'), 4.7, 142);
    item('item-cheese-fries', 'stall-001', 'cat-fries-classic', 'Cheese Fries', 69, 'Fries + cheese powder', stockImage('cheese-fries'), 4.8, 98);
    item('item-loaded-fries', 'stall-001', 'cat-fries-loaded', 'Loaded Chili Cheese Fries', 99, 'Fries + chili cheese + sour cream', stockImage('cheese-fries'), 4.9, 76);

    for (const id of ['item-plain-fries', 'item-cheese-fries', 'item-loaded-fries']) {
      const base = id === 'item-plain-fries' ? 55 : id === 'item-cheese-fries' ? 69 : 99;
      variant(id, 'Small', base, 1); variant(id, 'Medium', base + 20, 2); variant(id, 'Large', base + 40, 3);
    }
    for (const [id, base] of [['item-vanilla-scoop', 45], ['item-choco-scoop', 49]] as const) {
      variant(id, 'Cone', base, 1); variant(id, 'Small Cup', base, 2); variant(id, 'Large Cup', base + 20, 3); variant(id, 'Bun', base + 10, 4);
    }
    variant('item-strawberry-sundae', 'Small Cup', 89, 1); variant('item-strawberry-sundae', 'Large Cup', 109, 2); variant('item-strawberry-sundae', 'Cone', 89, 3);

    bom('item-vanilla-scoop', 'ing-milk', 60); bom('item-vanilla-scoop', 'ing-cream', 40); bom('item-vanilla-scoop', 'ing-sugar', 15); bom('item-vanilla-scoop', 'ing-vanilla', 10);
    bom('item-choco-scoop', 'ing-milk', 50); bom('item-choco-scoop', 'ing-cream', 40); bom('item-choco-scoop', 'ing-sugar', 15); bom('item-choco-scoop', 'ing-chocolate-syrup', 20);
    bom('item-strawberry-sundae', 'ing-milk', 80); bom('item-strawberry-sundae', 'ing-cream', 60); bom('item-strawberry-sundae', 'ing-sugar', 20); bom('item-strawberry-sundae', 'ing-strawberry', 30); bom('item-strawberry-sundae', 'ing-vanilla', 10);
    bom('item-plain-fries', 'ing-potato', 150); bom('item-plain-fries', 'ing-oil', 20);
    bom('item-cheese-fries', 'ing-potato', 150); bom('item-cheese-fries', 'ing-oil', 20); bom('item-cheese-fries', 'ing-cheese-powder', 15);
    bom('item-loaded-fries', 'ing-potato', 150); bom('item-loaded-fries', 'ing-oil', 20); bom('item-loaded-fries', 'ing-chili', 25); bom('item-loaded-fries', 'ing-sourcream', 15); bom('item-loaded-fries', 'ing-cheese-powder', 10);

    // Demo staff: inserted once; existing accounts (and their changed passwords) are left alone.
    for (const u of DEMO_USERS) {
      db.prepare(`INSERT INTO users (id, username, pin, password_hash, must_change_password, role, stall_id, display_name)
        VALUES (?,?,'',?,0,?,?,?) ON CONFLICT(id) DO NOTHING`)
        .run(u.id, u.username, hashPasswordSync(u.password), u.role, u.stallId, u.displayName);
    }
  });
  run();
  const count = (t: string) => (db.prepare(`SELECT count(*) AS c FROM ${t}`).get() as any).c;
  log(`[Seed] stalls=${count('stalls')} items=${count('menu_items')} ingredients=${count('ingredients')} users=${count('users')}`);
}
