import { handle } from '../lib/server/router';
import { resetThrottle } from '../lib/server/loginThrottle';

export const BASE = 'http://192.168.43.10:8081';

export async function call(method: string, path: string, opts: { token?: string | null; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await handle(new Request(BASE + path, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }));
  const text = await res.text();
  let data: any = text;
  try { data = JSON.parse(text); } catch {}
  return { status: res.status, data, headers: res.headers };
}

export async function login(username: string, password: string) {
  resetThrottle();
  const r = await call('POST', '/api/auth/login', { body: { username, password } });
  if (r.status !== 200) throw new Error(`login ${username} failed: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.token as string;
}
