import { db } from './database.js';
import { v4 as uuidv4 } from 'uuid';

function upsertStall(id: string, name: string, desc: string) {
  db.prepare(`INSERT OR IGNORE INTO stalls (id, name, description) VALUES (?,?,?)`).run(id, name, desc);
}
function upsertCategory(id: string, stallId: string, name: string, order: number) {
  db.prepare(`INSERT OR IGNORE INTO categories (id, stall_id, name, display_order) VALUES (?,?,?,?)`).run(id, stallId, name, order);
}
function upsertIngredient(id: string, name: string, unit: string, stock: number, threshold: number, cost: number) {
  db.prepare(`INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit) VALUES (?,?,?,?,?,?)`)
    .run(id, name, unit, stock, threshold, cost);
}
function upsertMenuItem(id: string, stallId: string, catId: string, name: string, price: number, desc: string) {
  db.prepare(`INSERT OR IGNORE INTO menu_items (id, stall_id, category_id, name, price, description) VALUES (?,?,?,?,?,?)`)
    .run(id, stallId, catId, name, price, desc);
}
function upsertBom(menuItemId: string, ingredientId: string, qty: number) {
  db.prepare(`INSERT OR IGNORE INTO recipe_bom (id, menu_item_id, ingredient_id, quantity_required) VALUES (?,?,?,?)`)
    .run(uuidv4(), menuItemId, ingredientId, qty);
}

console.log('[Seed] Seeding CampusBITE...');

// Clear? No, just insert ignores to allow re-run
const stall1 = 'stall-001';
const stall2 = 'stall-002';
upsertStall(stall1, 'Campus Grill', 'Burgers, Rice Meals & More');
upsertStall(stall2, 'Brew & Bites', 'Coffee, Milk Tea & Pastries');

const catBurgers = 'cat-burgers';
const catRice = 'cat-rice';
const catDrinks = 'cat-drinks';
const catPastries = 'cat-pastries';

upsertCategory(catBurgers, stall1, 'Burgers', 1);
upsertCategory(catRice, stall1, 'Rice Meals', 2);
upsertCategory(catDrinks, stall2, 'Drinks', 1);
upsertCategory(catPastries, stall2, 'Pastries', 2);

// Ingredients - with realistic units
upsertIngredient('ing-bun', 'Burger Bun', 'pcs', 100, 20, 5);
upsertIngredient('ing-patty', 'Beef Patty', 'pcs', 80, 15, 25);
upsertIngredient('ing-cheese', 'Cheese Slice', 'pcs', 120, 20, 8);
upsertIngredient('ing-lettuce', 'Lettuce', 'g', 5000, 1000, 0.05);
upsertIngredient('ing-sauce', 'Special Sauce', 'g', 3000, 500, 0.1);
upsertIngredient('ing-rice', 'Steamed Rice', 'g', 10000, 2000, 0.02);
upsertIngredient('ing-chicken', 'Fried Chicken', 'pcs', 50, 10, 30);
upsertIngredient('ing-coffee-beans', 'Coffee Beans', 'g', 2000, 300, 0.5);
upsertIngredient('ing-milk', 'Fresh Milk', 'ml', 5000, 1000, 0.03);
upsertIngredient('ing-flour', 'Flour', 'g', 8000, 1500, 0.04);
upsertIngredient('ing-sugar', 'Sugar', 'g', 5000, 1000, 0.02);

// Menu Items
upsertMenuItem('item-burger-classic', stall1, catBurgers, 'Classic Burger', 89, '1 patty, cheese, lettuce, sauce');
upsertMenuItem('item-burger-double', stall1, catBurgers, 'Double Cheeseburger', 139, '2 patties, double cheese');
upsertMenuItem('item-rice-chicken', stall1, catRice, 'Chicken Rice Meal', 99, '1 fried chicken + 250g rice');
upsertMenuItem('item-coffee-latte', stall2, catDrinks, 'Iced Latte', 65, 'Espresso + milk');
upsertMenuItem('item-milk-tea', stall2, catDrinks, 'Milk Tea', 55, 'Classic milk tea');
upsertMenuItem('item-croissant', stall2, catPastries, 'Butter Croissant', 45, 'Freshly baked');

// BOM Recipes
// Classic Burger: 1 bun, 1 patty, 1 cheese, 30g lettuce, 20g sauce
upsertBom('item-burger-classic', 'ing-bun', 1);
upsertBom('item-burger-classic', 'ing-patty', 1);
upsertBom('item-burger-classic', 'ing-cheese', 1);
upsertBom('item-burger-classic', 'ing-lettuce', 30);
upsertBom('item-burger-classic', 'ing-sauce', 20);

// Double: 1 bun, 2 patty, 2 cheese, 30g lettuce, 30g sauce
upsertBom('item-burger-double', 'ing-bun', 1);
upsertBom('item-burger-double', 'ing-patty', 2);
upsertBom('item-burger-double', 'ing-cheese', 2);
upsertBom('item-burger-double', 'ing-lettuce', 30);
upsertBom('item-burger-double', 'ing-sauce', 30);

// Chicken Rice: 1 chicken, 250g rice, 15g sauce
upsertBom('item-rice-chicken', 'ing-chicken', 1);
upsertBom('item-rice-chicken', 'ing-rice', 250);
upsertBom('item-rice-chicken', 'ing-sauce', 15);

// Latte: 15g coffee beans, 200ml milk, 10g sugar
upsertBom('item-coffee-latte', 'ing-coffee-beans', 15);
upsertBom('item-coffee-latte', 'ing-milk', 200);
upsertBom('item-coffee-latte', 'ing-sugar', 10);

// Milk Tea: 150ml milk, 20g sugar
upsertBom('item-milk-tea', 'ing-milk', 150);
upsertBom('item-milk-tea', 'ing-sugar', 20);

// Croissant: 80g flour, 10g sugar, 20g milk (simplified)
upsertBom('item-croissant', 'ing-flour', 80);
upsertBom('item-croissant', 'ing-sugar', 10);
upsertBom('item-croissant', 'ing-milk', 20);

function upsertUser(id: string, username: string, pin: string, role: string, stallId: string | null, displayName: string) {
  db.prepare(`INSERT OR IGNORE INTO users (id, username, pin, role, stall_id, display_name) VALUES (?,?,?,?,?,?)`)
    .run(id, username, pin, role, stallId, displayName);
}

// Users - Hybrid auth: ADMIN manages all, STALL_OWNER limited to own stall
upsertUser('user-admin', 'admin', 'admin123', 'ADMIN', null, 'Canteen Manager');
upsertUser('user-grill', 'grill', 'grill123', 'STALL_OWNER', stall1, 'Campus Grill Owner');
upsertUser('user-brew', 'brew', 'brew123', 'STALL_OWNER', stall2, 'Brew & Bites Owner');

console.log('[Seed] Done. Sample data ready.');
// Quick check
const counts = {
  stalls: (db.prepare(`SELECT count(*) as c FROM stalls`).get() as any).c,
  items: (db.prepare(`SELECT count(*) as c FROM menu_items`).get() as any).c,
  ingredients: (db.prepare(`SELECT count(*) as c FROM ingredients`).get() as any).c,
  boms: (db.prepare(`SELECT count(*) as c FROM recipe_bom`).get() as any).c,
  users: (db.prepare(`SELECT count(*) as c FROM users`).get() as any).c,
};
console.log('[Seed] Counts:', counts);
console.log('[Seed] Logins: admin/admin123 (ADMIN), grill/grill123 (Campus Grill), brew/brew123 (Brew & Bites)');
