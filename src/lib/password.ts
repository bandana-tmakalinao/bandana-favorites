/**
 * Password hashing with Node's built-in scrypt (a strong, memory-hard KDF) — no external dependency.
 * Stored form is `salt:derivedKey` (both hex). Verification is constant-time.
 *
 * Hashing is done in the API route (async, off the repo's synchronous interface); the repo only ever
 * stores/reads the resulting hash string — plaintext passwords never reach the store.
 */
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  if (!stored) return false;
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const keyBuf = Buffer.from(key, "hex");
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return keyBuf.length === derived.length && timingSafeEqual(keyBuf, derived);
}

/** Basic validators (kept lightweight; the route surfaces the messages). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
export function passwordProblem(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 200) return "Password is too long.";
  return null;
}
