import { randomUUID as uuidv4 } from 'node:crypto';
import { db } from './database';

export interface BomDeductionResult {
  success: boolean;
  deductions: { ingredientId: string; ingredientName: string; deducted: number; remaining: number }[];
  error?: string;
}

const getBomStmt = db.prepare(`
  SELECT rb.ingredient_id, rb.quantity_required, i.name, i.current_stock
  FROM recipe_bom rb
  JOIN ingredients i ON i.id = rb.ingredient_id
  WHERE rb.menu_item_id = ?
`);
const updateStockStmt = db.prepare(`UPDATE ingredients SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
const insertLogStmt = db.prepare(`INSERT INTO stock_logs (id, ingredient_id, change_type, quantity_delta, reason, order_id) VALUES (?, ?, 'BOM_DEDUCTION', ?, ?, ?)`);
const checkStockStmt = db.prepare(`SELECT current_stock FROM ingredients WHERE id = ?`);

export const deductBomTransaction = db.transaction((
  orderId: string,
  items: { menuItemId: string; quantity: number }[],
  options: { allowNegative?: boolean } = {}
): BomDeductionResult => {
  const needs = new Map<string, { total: number; name: string }>();
  for (const item of items) {
    const boms = getBomStmt.all(item.menuItemId) as { ingredient_id: string; quantity_required: number; name: string; current_stock: number }[];
    for (const bom of boms) {
      const need = bom.quantity_required * item.quantity;
      const prev = needs.get(bom.ingredient_id);
      if (prev) prev.total += need;
      else needs.set(bom.ingredient_id, { total: need, name: bom.name });
    }
  }
  if (!options.allowNegative) {
    for (const [ingId, { total, name }] of needs) {
      const row = checkStockStmt.get(ingId) as { current_stock: number } | undefined;
      if (!row) throw new Error(`Ingredient ${name} (${ingId}) not found`);
      if (row.current_stock < total) throw new Error(`Insufficient stock for ${name}: need ${total}, have ${row.current_stock}`);
    }
  }
  const deductions: BomDeductionResult['deductions'] = [];
  for (const [ingId, { total, name }] of needs) {
    updateStockStmt.run(total, ingId);
    insertLogStmt.run(uuidv4(), ingId, -total, `BOM deduction for order ${orderId}`, orderId);
    const after = checkStockStmt.get(ingId) as { current_stock: number };
    deductions.push({ ingredientId: ingId, ingredientName: name, deducted: total, remaining: after.current_stock });
  }
  return { success: true, deductions };
});

export const rollbackBomTransaction = db.transaction((
  orderId: string,
  items: { menuItemId: string; quantity: number }[]
) => {
  const needs = new Map<string, { total: number; name: string }>();
  for (const item of items) {
    const boms = getBomStmt.all(item.menuItemId) as { ingredient_id: string; quantity_required: number; name: string }[];
    for (const bom of boms) {
      const need = bom.quantity_required * item.quantity;
      const prev = needs.get(bom.ingredient_id);
      if (prev) prev.total += need;
      else needs.set(bom.ingredient_id, { total: need, name: bom.name });
    }
  }
  for (const [ingId, { total }] of needs) {
    db.prepare(`UPDATE ingredients SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(total, ingId);
    db.prepare(`INSERT INTO stock_logs (id, ingredient_id, change_type, quantity_delta, reason, order_id) VALUES (?,?,'ROLLBACK',?,?,?)`).run(uuidv4(), ingId, total, `Rollback for cancelled order ${orderId}`, orderId);
  }
});
