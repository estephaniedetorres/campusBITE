// Growing delay per username after failed logins (1s, 2s, 4s … capped at 30s). No lockout.
// Kept on globalThis so it survives Metro reloading the API module.
type Entry = { failures: number; blockedUntil: number };
const MAX_DELAY_S = 30;
const MAX_ENTRIES = 5000;

const g = globalThis as any;
const store: Map<string, Entry> = g.__cbLoginThrottle || (g.__cbLoginThrottle = new Map());

const key = (username: string) => String(username || '').trim().toLowerCase();

/** Seconds the caller must wait before trying again (0 = allowed now). */
export function retryAfterSeconds(username: string, now = Date.now()): number {
  const e = store.get(key(username));
  if (!e || e.blockedUntil <= now) return 0;
  return Math.ceil((e.blockedUntil - now) / 1000);
}

export function recordFailure(username: string, now = Date.now()): number {
  const k = key(username);
  const e = store.get(k) || { failures: 0, blockedUntil: 0 };
  e.failures += 1;
  const delay = Math.min(MAX_DELAY_S, 2 ** (e.failures - 1));
  e.blockedUntil = now + delay * 1000;
  store.set(k, e);
  if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
  return delay;
}

export function recordSuccess(username: string) {
  store.delete(key(username));
}

export function resetThrottle() {
  store.clear();
}
