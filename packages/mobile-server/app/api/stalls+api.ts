// @ts-nocheck
export async function GET(request: Request) {
  const { db } = await import('../../lib/database');
  const stalls = db.prepare(`SELECT * FROM stalls WHERE is_active=1`).all();
  return new Response(JSON.stringify(stalls), { headers: { 'Content-Type': 'application/json' } });
}
