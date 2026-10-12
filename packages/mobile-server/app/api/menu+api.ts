// @ts-nocheck
export async function GET(request: Request) {
  const { db } = await import('../../lib/database');
  const url = new URL(request.url);
  const stallId = url.searchParams.get('stallId');
  const categoryId = url.searchParams.get('categoryId');
  const includeUnavailable = url.searchParams.get('includeUnavailable') === '1' || url.searchParams.get('includeUnavailable') === 'true';
  let sql = `SELECT mi.*, c.name as category_name, s.name as stall_name FROM menu_items mi JOIN categories c ON c.id=mi.category_id JOIN stalls s ON s.id=mi.stall_id WHERE 1=1`;
  const params: any[] = [];
  if (!includeUnavailable) sql += ` AND mi.is_available=1`;
  if (stallId) { sql += ` AND mi.stall_id=?`; params.push(stallId); }
  if (categoryId) { sql += ` AND mi.category_id=?`; params.push(categoryId); }
  sql += ` ORDER BY c.display_order, mi.name`;
  const items: any[] = db.prepare(sql).all(...params) as any[];
  for (const it of items) {
    try { it.variants = db.prepare(`SELECT * FROM item_variants WHERE menu_item_id=? ORDER BY display_order, price`).all(it.id); } catch { it.variants = []; }
  }
  return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } });
}
