// @ts-nocheck
export async function GET(request: Request) {
  const { db } = await import('../../lib/database');
  const url = new URL(request.url);
  const stallId = url.searchParams.get('stallId');
  const includeEmpty = url.searchParams.get('includeEmpty') === '1';
  if (includeEmpty || !stallId) {
    let sql = `SELECT * FROM categories`;
    const params: any[] = [];
    if (stallId) { sql += ` WHERE stall_id=?`; params.push(stallId); }
    sql += ` ORDER BY display_order`;
    return new Response(JSON.stringify(db.prepare(sql).all(...params)), { headers: { 'Content-Type': 'application/json' } });
  }
  const rows = db.prepare(`SELECT DISTINCT c.* FROM categories c JOIN menu_items mi ON mi.category_id=c.id AND mi.is_available=1 WHERE c.stall_id=? ORDER BY c.display_order`).all(stallId);
  return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });
}
