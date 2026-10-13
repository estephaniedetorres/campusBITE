// Password hashing with scrypt (node:crypto, no dependencies — works offline).
// Stored format: scrypt$N$r$p$<salt base64>$<hash base64>
import { randomBytes, randomInt, scrypt as scryptCb, scryptSync, timingSafeEqual } from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

function scryptAsync(password: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

function encode(salt: Buffer, key: Buffer, n = N, r = R, p = P) {
  return `scrypt$${n}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

function decode(stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [, n, r, p, salt, key] = parts;
  return { N: Number(n), r: Number(r), p: Number(p), salt: Buffer.from(salt, 'base64'), key: Buffer.from(key, 'base64') };
}

export function isHashed(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('scrypt$');
}

/** Synchronous hash — used for startup migration and CLI scripts. */
export function hashPasswordSync(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  return encode(salt, scryptSync(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  return encode(salt, await scryptAsync(password, salt, KEYLEN, { N, r: R, p: P }));
}

/** Constant-time verify. Returns false for malformed or missing hashes. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const d = stored ? decode(stored) : null;
  if (!d || !d.key.length) return false;
  const key = await scryptAsync(password, d.salt, d.key.length, { N: d.N, r: d.r, p: d.p });
  return key.length === d.key.length && timingSafeEqual(key, d.key);
}

// A real hash of a random string, so unknown usernames cost the same time as wrong passwords.
let dummyHash: string | null = null;
export function getDummyHash() {
  if (!dummyHash) dummyHash = hashPasswordSync(randomBytes(16).toString('hex'));
  return dummyHash;
}

/** Returns an error message, or null when the password is acceptable. */
export function passwordPolicyError(password: unknown): string | null {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
  return null;
}

/** 12-char one-time password from an unambiguous alphabet (no 0/O/1/l/I). */
export function generateTempPassword(length = 12): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}
