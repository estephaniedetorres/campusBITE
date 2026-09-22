// CampusBITE API helper for Expo Go
// Expo Go runs on phone's LAN, server is either:
// - Termux phone server at http://192.168.43.1:3000 (hotspot)
// - PC server at http://192.168.1.104:3000 (dev, joins hotspot)
// We let user edit IP in UI and persist via AsyncStorage-like memory (here simple global).

export const DEFAULT_HOTSPOT_URL = 'http://192.168.43.1:3000';
export const DEFAULT_DEV_URL = 'http://192.168.1.104:3000';

// Auto-detect Expo host (192.168.1.104:8081) → use same IP with :3000 for canteen
function detectDefault(): string {
  try {
    if (typeof window !== 'undefined' && (window as any).location?.hostname) {
      const h = (window as any).location.hostname;
      if (h && h !== 'localhost' && h !== '127.0.0.1') return `http://${h}:3000`;
    }
  } catch {}
  return DEFAULT_HOTSPOT_URL;
}
let _apiBase = detectDefault();

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
