// Simple typed fetch wrapper. Auto-detects base URL.
// On phone hotspot: http://192.168.43.1:3000 ; on dev: vite proxy -> /api

export const API_BASE = ''; // relative - works for both dev proxy and phone IP

function getToken(): string | null {
  try { return localStorage.getItem('campusbite_token'); } catch { return null; }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const authHeader: Record<string,string> = token ? { 'x-user-id': token } : {};
  const { headers: optHeaders, ...rest } = opts as any;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader, ...((optHeaders as any) || {}) },
    ...(rest as any),
  });
  if (!res.ok) {
    const text = await res.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = text; }
    throw new Error(typeof body === 'string' ? body : body.error || JSON.stringify(body));
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json() as Promise<T>;
  return res.text() as unknown as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: any) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: any) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// Domain helpers
export type Stall = { id: string; name: string; description: string };
export type MenuItem = { id: string; stall_id: string; category_id: string; name: string; price: number; description: string; is_available: number };
export type Order = { id: string; pickup_code: string; stall_id: string; total_amount: number; status: string; created_at: string; updated_at: string };
