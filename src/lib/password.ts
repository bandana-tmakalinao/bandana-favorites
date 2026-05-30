/**
 * Password hashing — defense in depth, no external dependency.
 *
 *  1. scrypt (memory-hard KDF) at OWASP-aligned cost (N=2^15, r=8, p=1).
 *  2. A unique random 16-byte SALT per password (stops rainbow tables / cross-user attacks).
 *  3. An optional server-side PEPPER (HMAC-SHA256 pre-hash, keyed by PASSWORD_PEPPER): a stolen DB
 *     dump alone CANNOT be cracked without also stealing this app secret (which lives only in env).
 *  4. A self-describing, UPGRADEABLE format `s1$N$r$p$salt$hash` — the cost params travel with each
 *     hash, so we can raise the cost later and old hashes still verify (and re-hash on next login).
 *  5. Constant-time comparison (timingSafeEqual).
 *
 * Plaintext passwords never leave the request handler; only the derived hash is stored.
 */
import { scrypt, randomBytes, timingSafeEqual, createHmac, type ScryptOptions } from "node:crypto";

// Explicit wrapper (promisify's types omit the options arg we need for the cost params).
function scryptAsync(password: string | Buffer, salt: string | Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => (err ? reject(err) : resolve(derivedKey)));
  });
}

// OWASP-aligned scrypt cost. Memory per hash ≈ 128 · N · r ≈ 32 MB; maxmem set with headroom.
const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 96 * 1024 * 1024;

if (process.env.NODE_ENV === "production" && !process.env.PASSWORD_PEPPER) {
  console.warn(
    "[auth] PASSWORD_PEPPER is unset in production — password hashes lack the server-side pepper. " +
      "Set a strong PASSWORD_PEPPER before the first real sign-up.",
  );
}

/** Apply the optional pepper: HMAC the password with the app secret before the KDF (when configured). */
function peppered(password: string): string | Buffer {
  const pepper = process.env.PASSWORD_PEPPER;
  return pepper ? createHmac("sha256", pepper).update(password, "utf8").digest() : password;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(peppered(password), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM })) as Buffer;
  return `s1$${N}$${R}$${P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length === 6 && parts[0] === "s1") {
    const n = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    if (!n || !r || !p) return false;
    const salt = Buffer.from(parts[4], "hex");
    const expected = Buffer.from(parts[5], "hex");
    const derived = (await scryptAsync(peppered(password), salt, expected.length, {
      N: n, r, p, maxmem: MAXMEM,
    })) as Buffer;
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  }
  return false;
}

/** A valid `s1` hash of nothing — fed to verifyPassword on unknown emails so login timing is identical
 *  whether or not the account exists (defeats account-enumeration via response time). */
export const TIMING_DUMMY = `s1$${N}$${R}$${P}$${"0".repeat(32)}$${"0".repeat(128)}`;

/** Basic validators (kept lightweight; the route surfaces the messages). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
export function passwordProblem(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 200) return "Password is too long.";
  return null;
}
