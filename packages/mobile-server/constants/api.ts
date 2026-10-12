// @ts-nocheck
// CampusBITE API helper — Full-stack Expo (8081 only, no :3000)
// Expo web at http://localhost:8081 now serves API at same origin via app/api/[...all]+api.ts
// → web fetch('/api/stalls') hits Expo's 8081 API same port (no external 3000 needed)
// Native (Expo Go) → http://<LAN_IP>:8081/api/...

export const DEFAULT_HOTSPOT_URL = ''; // same-origin on web (Expo 8081)
export const DEFAULT_DEV_URL = ''; // same-origin
export const DEFAULT_LOCAL_URL = ''; // same-origin (web uses relative /api/...)
export const DEFAULT_EXPO_PORT = 8081;
export const STORAGE_KEY = 'campusbite_api_base';

// Auto-detect: web = same origin (''), native = LAN_IP:8081
function detectDefault(): string {
  try {
    if (typeof window !== 'undefined' && (window as any).location?.hostname) {
      // Full-stack Expo: web uses relative URL → same origin 8081, no :3000
      return '';
    }
    // Native (Expo Go app, no window) — try expo-constants hostUri
    try {
      const Constants: any = require('expo-constants').default || require('expo-constants');
      const hostUri: string | undefined =
        Constants?.expoConfig?.hostUri || Constants?.manifest?.hostUri || Constants?.manifest2?.extra?.expoGo?.hostUri;
      if (hostUri) {
        const ip = hostUri.split(':')[0];
        if (ip && ip !== 'localhost' && ip !== '127.0.0.1') return `http://${ip}:${DEFAULT_EXPO_PORT}`;
      }
    } catch {}
  } catch {}
  return `http://localhost:${DEFAULT_EXPO_PORT}`;
}
let _apiBase = detectDefault();

// Persisted override via AsyncStorage — call once at app start (non-blocking)
export async function initApiBase(): Promise<string> {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) _apiBase = saved.replace(/\/$/, '');
  } catch {}
  return _apiBase;
}

export function setApiBase(url: string) {
  _apiBase = url.replace(/\/$/, '');
  // fire-and-forget persist
  import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
    AsyncStorage.setItem(STORAGE_KEY, _apiBase).catch(() => {});
  }).catch(() => {});
}
export function getApiBase() {
  return _apiBase;
}

async function parseJsonSafe(res: Response, path: string) {
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!ct.includes('application/json') && (text.trim().startsWith('<!') || text.trim().startsWith('<html'))) {
    // Expo web static fallback (no API) — try fallback to hidden server-core at 3000
    const fallbackBase = `http://localhost:3000`;
    if (getApiBase() === '' || getApiBase().includes('8081')) {
      try {
        const tokenHeader2: Record<string, string> = _token ? { 'x-user-id': _token } : {};
        const r2 = await fetch(`${fallbackBase}${path}`, { headers: tokenHeader2 as HeadersInit });
        const ct2 = r2.headers.get('content-type') || '';
        const t2 = await r2.text();
        if (!r2.ok) throw new Error(`${r2.status} ${t2}`);
        if (ct2.includes('application/json') || t2.trim().startsWith('{') || t2.trim().startsWith('[')) return JSON.parse(t2);
        throw new Error(`Fallback also HTML: ${t2.slice(0,120)}`);
      } catch (e:any) {
        throw new Error(`Expo API not serving ${path} at ${getApiBase()||'same-origin:8081'} (got HTML). Tried fallback ${fallbackBase} failed: ${e.message}. Ensure server-core running at 3000 (npm run server) AND restart Expo: npx expo start --web --host lan --clear --port 8081. Got: ${text.slice(0,120)}...`);
      }
    }
    throw new Error(`Expo API not serving ${path} (got HTML). Restart Expo: npx expo start --web --host lan --clear --port 8081. Got: ${text.slice(0,120)}...`);
  }
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  try { return JSON.parse(text); } catch (e:any) {
    throw new Error(`Bad JSON from ${path}: ${e.message} — body: ${text.slice(0,200)}`);
  }
}
function getFetchUrl(path: string) {
  const base = getApiBase();
  // In Node (SSR/test), '' relative URL fails — fallback to 3000 immediately
  if (!base && typeof window === 'undefined') return `http://localhost:3000${path}`;
  return `${base}${path}`;
}
export async function apiGet(path: string) {
  const tokenHeader: Record<string, string> = _token ? { 'x-user-id': _token } : {};
  const url = getFetchUrl(path);
  let res = await fetch(url, { headers: tokenHeader as HeadersInit });
  // HTML fallback (Expo web returns index.html for /api/* when API not wired) → retry at 3000
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const t = await res.clone().text().catch(()=> '');
    if (t.trim().startsWith('<!') || t.trim().startsWith('<html')) {
      const fb = `http://localhost:3000${path}`;
      try {
        const r2 = await fetch(fb, { headers: tokenHeader as HeadersInit });
        if (r2.ok) return r2.json();
      } catch {}
    }
  }
  return parseJsonSafe(res, path);
}
export async function apiPost(path: string, body: any) {
  const token: Record<string, string> = _token ? { 'x-user-id': _token } : {};
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...token };
  const url = getFetchUrl(path);
  let res = await fetch(url, { method: 'POST', headers: headers as HeadersInit, body: JSON.stringify(body) });
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const t = await res.clone().text().catch(()=> '');
    if (t.trim().startsWith('<!') || t.trim().startsWith('<html')) {
      const fb = `http://localhost:3000${path}`;
      try {
        const r2 = await fetch(fb, { method: 'POST', headers: headers as HeadersInit, body: JSON.stringify(body) });
        if (r2.ok) return r2.json();
      } catch {}
    }
  }
  return parseJsonSafe(res, path);
}
export async function apiPatch(path: string, body: any) {
  const url = getFetchUrl(path);
  const token: Record<string, string> = _token ? { 'x-user-id': _token } : {};
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...token };
  let res = await fetch(url, { method: 'PATCH', headers: headers as HeadersInit, body: JSON.stringify(body) });
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const t = await res.clone().text().catch(()=> '');
    if (t.trim().startsWith('<!') || t.trim().startsWith('<html')) {
      const fb = `http://localhost:3000${path}`;
      try {
        const r2 = await fetch(fb, { method: 'PATCH', headers: headers as HeadersInit, body: JSON.stringify(body) });
        if (r2.ok && (r2.headers.get('content-type')||'').includes('application/json')) return r2.json();
      } catch {}
    }
  }
  if (ct.includes('application/json')) return parseJsonSafe(res, path);
  const text = await res.clone().text().catch(()=> '');
  if (text.trim().startsWith('<!') || text.trim().startsWith('<html')) {
    // already tried fallback above
  }
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  try { return JSON.parse(text); } catch { return text; }
}
let _token: string | null = null;
export function setToken(t: string | null) { _token = t; }
export function getToken() { return _token; }
