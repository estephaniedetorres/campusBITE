/**
 * BOM Engine - Atomic Recipe Inventory Deduction
 *
 * HOW IT WORKS (for learning):
 * 1. Every menu_item has rows in recipe_bom: e.g., Burger -> 1 bun, 150g patty, 20g sauce
 * 2. When order transitions to CONFIRMED, we calculate total ingredient needs:
 *    total_needed = sum(quantity_required * order_item.quantity) per ingredient
 * 3. We do ALL deductions inside a single SQLite TRANSACTION.
 *    If ANY ingredient would go negative or any step fails, ROLLBACK entire order.
 * 4. This is ACID - no half-deducted orders even with 50 concurrent clients.
 */
export interface BomDeductionResult {
    success: boolean;
    deductions: {
        ingredientId: string;
        ingredientName: string;
        deducted: number;
        remaining: number;
    }[];
    error?: string;
}
/**
 * Atomic deduction transaction.
 * Call this ONLY when order moves PENDING_PAYMENT -> CONFIRMED / PREPARING.
 * Returns success=false if any ingredient insufficient (but allows negative if you want - here we block).
 */
export declare const deductBomTransaction: any;
/**
 * Rollback deductions if order is CANCELLED after being CONFIRMED.
 * Adds back the same quantities.
 */
export declare const rollbackBomTransaction: any;
export declare function getIngredientUsage(ingredientId: string, fromDate: string, toDate: string): {
    total_used: number;
};
//# sourceMappingURL=bomEngine.d.ts.map