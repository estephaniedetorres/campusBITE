// @ts-nocheck
export async function POST(request: Request) {
  const { db } = await import('../../../lib/database');
  let body: any = {};
  try { body = await request.json(); } catch {}
  if (!body?.username || !body?.pin) return new Response(JSON.stringify({ error: 'username and pin required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  const user = db.prepare(`SELECT id, username, role, stall_id, display_name, is_active, pin FROM users WHERE username=?`).get(body.username) as any;
  if (!user || user.pin !== body.pin) return new Response(JSON.stringify({ error: 'Invalid username or PIN' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  if (!user.is_active) return new Response(JSON.stringify({ error: 'Account disabled' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  const stall = user.stall_id ? db.prepare(`SELECT name FROM stalls WHERE id=?`).get(user.stall_id) as any : null;
  const { pin: _p, ...safe } = user;
  return new Response(JSON.stringify({ user: { ...safe, stall_name: stall?.name || null }, token: user.id }), { headers: { 'Content-Type': 'application/json' } });
}
