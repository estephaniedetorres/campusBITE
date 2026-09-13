import { db } from './database.js';
import { v4 as uuidv4 } from 'uuid';
// Pre-prepared statements for performance (important on low-end phone CPU)
const getBomStmt = db.prepare(`
  SELECT rb.ingredient_id, rb.quantity_required, i.name, i.current_stock
  FROM recipe_bom rb
  JOIN ingredients i ON i.id = rb.ingredient_id
  WHERE rb.menu_item_id = ?
`);
const updateStockStmt = db.prepare(`
  UPDATE ingredients SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);
const insertLogStmt = db.prepare(`
  INSERT INTO stock_logs (id, ingredient_id, change_type, quantity_delta, reason, order_id)
  VALUES (?, ?, 'BOM_DEDUCTION', ?, ?, ?)
`);
const checkStockStmt = db.prepare(`SELECT current_stock FROM ingredients WHERE id = ?`);
/**
 * Atomic deduction transaction.
 * Call this ONLY when order moves PENDING_PAYMENT -> CONFIRMED / PREPARING.
 * Returns success=false if any ingredient insufficient (but allows negative if you want - here we block).
 */
export const deductBomTransaction = db.transaction((orderId, items, options = {}) => {
    // Step 1: Aggregate total needs per ingredient across all items
    const needs = new Map();
    for (const item of items) {
        const boms = getBomStmt.all(item.menuItemId);
        for (const bom of boms) {
            const need = bom.quantity_required * item.quantity;
            const prev = needs.get(bom.ingredient_id);
            if (prev)
                prev.total += need;
            else
                needs.set(bom.ingredient_id, { total: need, name: bom.name });
        }
    }
    // Step 2: Validate stock (if not allowing negative)
    if (!options.allowNegative) {
        for (const [ingId, { total, name }] of needs) {
            const row = checkStockStmt.get(ingId);
            if (!row)
                throw new Error(`Ingredient ${name} (${ingId}) not found`);
            if (row.current_stock < total) {
                throw new Error(`Insufficient stock for ${name}: need ${total}, have ${row.current_stock}`);
            }
        }
    }
    // Step 3: Perform deductions + logs
    const deductions = [];
    for (const [ingId, { total, name }] of needs) {
        updateStockStmt.run(total, ingId);
        insertLogStmt.run(uuidv4(), ingId, -total, `BOM deduction for order ${orderId}`, orderId);
        const after = checkStockStmt.get(ingId);
        deductions.push({ ingredientId: ingId, ingredientName: name, deducted: total, remaining: after.current_stock });
    }
    return { success: true, deductions };
});
/**
 * Rollback deductions if order is CANCELLED after being CONFIRMED.
 * Adds back the same quantities.
 */
export const rollbackBomTransaction = db.transaction((orderId, items) => {
    const needs = new Map();
    for (const item of items) {
        const boms = getBomStmt.all(item.menuItemId);
        for (const bom of boms) {
            const need = bom.quantity_required * item.quantity;
            const prev = needs.get(bom.ingredient_id);
            if (prev)
                prev.total += need;
            else
                needs.set(bom.ingredient_id, { total: need, name: bom.name });
        }
    }
    for (const [ingId, { total }] of needs) {
        db.prepare(`UPDATE ingredients SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(total, ingId);
        db.prepare(`INSERT INTO stock_logs (id, ingredient_id, change_type, quantity_delta, reason, order_id) VALUES (?,?,?,?,?,?)`)
            .run(uuidv4(), ingId, total, `ROLLBACK for cancelled order ${orderId}`, 'ROLLBACK', orderId);
    }
});
// Helper: get ingredient burn rate (useful for analytics)
export function getIngredientUsage(ingredientId, fromDate, toDate) {
    return db.prepare(`
    SELECT COALESCE(SUM(ABS(quantity_delta)),0) as total_used
    FROM stock_logs
    WHERE ingredient_id = ? AND change_type='BOM_DEDUCTION'
      AND date(created_at) BETWEEN date(?) AND date(?)
  `).get(ingredientId, fromDate, toDate);
}
//# sourceMappingURL=bomEngine.js.map