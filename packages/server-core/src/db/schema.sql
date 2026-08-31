-- CampusBITE SQLite Schema
-- Enable WAL for concurrent reads + atomic writes (critical on phone hardware)

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. STALLS
CREATE TABLE IF NOT EXISTS stalls (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    stall_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY(stall_id) REFERENCES stalls(id) ON DELETE CASCADE
);

-- 3. MENU ITEMS
CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    stall_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL CHECK(price >= 0),
    image_url TEXT,
    is_available INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(stall_id) REFERENCES stalls(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- 4. INGREDIENTS (Inventory)
CREATE TABLE IF NOT EXISTS ingredients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    unit TEXT NOT NULL CHECK(unit IN ('g','kg','ml','L','pcs')),
    current_stock REAL NOT NULL DEFAULT 0,
    min_threshold REAL NOT NULL DEFAULT 10,
    cost_per_unit REAL NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. RECIPE BOM (Bill of Materials: which ingredients per menu item)
CREATE TABLE IF NOT EXISTS recipe_bom (
    id TEXT PRIMARY KEY,
    menu_item_id TEXT NOT NULL,
    ingredient_id TEXT NOT NULL,
    quantity_required REAL NOT NULL CHECK(quantity_required > 0),
    FOREIGN KEY(menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    FOREIGN KEY(ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    UNIQUE(menu_item_id, ingredient_id)
);

-- 6. ORDERS
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    pickup_code TEXT NOT NULL UNIQUE,
    stall_id TEXT NOT NULL,
    total_amount REAL NOT NULL CHECK(total_amount >= 0),
    status TEXT NOT NULL CHECK(status IN ('PENDING_PAYMENT','CONFIRMED','PREPARING','READY','COMPLETED','CANCELLED')),
    customer_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(stall_id) REFERENCES stalls(id)
);
CREATE INDEX IF NOT EXISTS idx_orders_pickup ON orders(pickup_code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- 7. ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    menu_item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
);

-- 8. STOCK LOGS (audit trail)
CREATE TABLE IF NOT EXISTS stock_logs (
    id TEXT PRIMARY KEY,
    ingredient_id TEXT NOT NULL,
    change_type TEXT NOT NULL CHECK(change_type IN ('STOCK_IN','BOM_DEDUCTION','WASTAGE','AUDIT_ADJUSTMENT','ROLLBACK')),
    quantity_delta REAL NOT NULL,
    reason TEXT,
    order_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ingredient_id) REFERENCES ingredients(id)
);
CREATE INDEX IF NOT EXISTS idx_stock_logs_ingredient ON stock_logs(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_created ON stock_logs(created_at);

-- 9. DAILY AUDITS (EOD variance)
CREATE TABLE IF NOT EXISTS daily_audits (
    id TEXT PRIMARY KEY,
    audit_date TEXT NOT NULL, -- YYYY-MM-DD
    ingredient_id TEXT NOT NULL,
    system_expected_stock REAL NOT NULL,
    physical_actual_stock REAL NOT NULL,
    variance REAL NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ingredient_id) REFERENCES ingredients(id),
    UNIQUE(audit_date, ingredient_id)
);

-- 10. USERS (Hybrid auth: ADMIN can manage all, STALL_OWNER limited to own stall)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    pin TEXT NOT NULL, -- simple 4-6 digit PIN for offline use (not hashed for demo, hash in production)
    role TEXT NOT NULL CHECK(role IN ('ADMIN','STALL_OWNER')),
    stall_id TEXT,
    display_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(stall_id) REFERENCES stalls(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
