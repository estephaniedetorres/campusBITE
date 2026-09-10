// CampusBITE API helper for Expo Go
// Expo Go runs on phone's LAN, server is either:
// - Termux phone server at http://192.168.43.1:3000 (hotspot)
// - PC server at http://192.168.1.104:3000 (dev, joins hotspot)
// We let user edit IP in UI and persist via AsyncStorage-like memory (here simple global).

export const DEFAULT_HOTSPOT_URL = 'http://192.168.43.1:3000';
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
