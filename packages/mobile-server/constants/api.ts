// CampusBITE API client — the Expo dev server (:8081) serves both the app and /api/*.
// Web: same origin (''). Expo Go (native): http://<PC LAN IP>:8081 detected from the Metro host.
// Staff requests carry `Authorization: Bearer <session token>`.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_EXPO_PORT = 8081;
export const STORAGE_KEY = 'campusbite_api_base';
export const AUTH_USER_KEY = 'campusbite_user';
export const AUTH_TOKEN_KEY = 'campusbite_token';

function detectDefault(): string {
  if (typeof window !== 'undefined' && (window as any).location?.hostname) return '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: any = require('expo-constants');
    const Constants: any = mod.default || mod;
    const hostUri: string | undefined =
      Constants?.expoConfig?.hostUri || Constants?.manifest?.hostUri || Constants?.manifest2?.extra?.expoGo?.hostUri;
    if (hostUri) {
      const [ip, port] = hostUri.split(':');
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') return `http://${ip}:${port || DEFAULT_EXPO_PORT}`;
    }
  } catch {}
  return `http://localhost:${DEFAULT_EXPO_PORT}`;
}

let _apiBase = detectDefault();
let _token: string | null = null;

export async function initApiBase(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) _apiBase = saved.replace(/\/$/, '');
  } catch {}
  return _apiBase;
}
export function setApiBase(url: string) {
  _apiBase = url.replace(/\/$/, '');
  AsyncStorage.setItem(STORAGE_KEY, _apiBase).catch(() => {});
}
export function getApiBase() {
  return _apiBase;
}

export function setToken(t: string | null) { _token = t; }
export function getToken() { return _token; }

/** Clear the stored staff session (used on logout and when the server rejects the token). */
export async function clearStoredAuth() {
  _token = null;
  try { await AsyncStorage.multiRemove([AUTH_USER_KEY, AUTH_TOKEN_KEY]); } catch {}
}

/**
 * Origin other phones can open (for stall QR codes). Uses the browser origin unless it's
 * localhost, else the LAN address reported by /api/health, else the Expo Go API base.
 */
export function publicOrigin(health?: { ip?: string; port?: number } | null): string {
  let origin = '';
  try { origin = (typeof window !== 'undefined' && (window as any).location?.origin) || ''; } catch {}
  const isLoopback = (h: string) => /^(localhost|127\.|\[::1\])/.test(h);
  if (origin && !isLoopback(new URL(origin).hostname)) return origin;
  if (health?.ip && !isLoopback(health.ip)) return `http://${health.ip}:${health.port || DEFAULT_EXPO_PORT}`;
  return getApiBase() || origin || `http://localhost:${DEFAULT_EXPO_PORT}`;
}

/** Relative app URLs (/api/images/…, /api/uploads/…) need the server origin on native. */
export function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith('/') ? `${getApiBase()}${url}` : url;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  retryAfter?: number;
  constructor(message: string, status: number, code?: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/** One request helper for the whole app. Pass `token` to override the module-level session token. */
export async function apiRequest(method: string, path: string, body?: unknown, token: string | null = _token): Promise<any> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const base = getApiBase() || (typeof window === 'undefined' ? `http://localhost:${DEFAULT_EXPO_PORT}` : '');
  const res = await fetch(`${base}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data: any = text;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    if (res.status === 401 && token && path !== '/api/auth/login') await clearStoredAuth();
    const msg = (data && typeof data === 'object' && data.error) || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data?.code, data?.retryAfter);
  }
  return data;
}

export const apiGet = (path: string, token?: string | null) => apiRequest('GET', path, undefined, token === undefined ? _token : token);
export const apiPost = (path: string, body: unknown, token?: string | null) => apiRequest('POST', path, body, token === undefined ? _token : token);
export const apiPatch = (path: string, body: unknown, token?: string | null) => apiRequest('PATCH', path, body, token === undefined ? _token : token);
export const apiDelete = (path: string, token?: string | null) => apiRequest('DELETE', path, undefined, token === undefined ? _token : token);
