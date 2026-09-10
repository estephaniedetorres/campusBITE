// CampusBITE API helper for Expo (Go + Dev Build embedded Node)
// - Dev Build with embedded Node: RN UI on same phone fetches http://127.0.0.1:3000 (loopback), hotspot clients use http://192.168.43.1:3000
// - Expo Go + Termux: RN UI fetches http://192.168.43.1:3000
// - Expo Go + PC dev: http://192.168.1.104:3000
// User can edit IP in UI.

export const DEFAULT_HOTSPOT_URL = 'http://192.168.43.1:3000';
export const DEFAULT_EMBEDDED_URL = 'http://127.0.0.1:3000';
export const DEFAULT_DEV_URL = 'http://192.168.1.104:3000';

let _apiBase = DEFAULT_HOTSPOT_URL;

export function setApiBase(url: string) {
  _apiBase = url.replace(/\/$/, '');
}
export function getApiBase() {
  return _apiBase;
}

export async function apiGet(path: string) {
  const res = await fetch(`${getApiBase()}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}
export async function apiPost(path: string, body: any) {
  const token: Record<string, string> = _token ? { 'x-user-id': _token } : {};
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...token };
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: headers as HeadersInit,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}
let _token: string | null = null;
export function setToken(t: string | null) { _token = t; }
export function getToken() { return _token; }
