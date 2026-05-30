/**
 * Lightweight cookie session for the scaffold ("pick a name to sign in"). The cookie is an
 * HMAC-signed user id — enough to attach votes to a stable identity in dev. The real anti-Sybil
 * floor (OAuth + phone OTP + earned trust) is a later phase; see DECISIONS.md.
 */
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getRepo } from "@/db/repo";
import type { User } from "@/lib/types";

export const SESSION_COOKIE = "bf_session";
const DEFAULT_SECRET = "dev-insecure-secret-change-me";
const SECRET = process.env.SESSION_SECRET || DEFAULT_SECRET;
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Guardrail: a forgeable session in production is a hard security hole. Warn loudly at boot.
if (process.env.NODE_ENV === "production" && SECRET === DEFAULT_SECRET) {
  console.warn(
    "[auth] SESSION_SECRET is unset in production — session cookies are FORGEABLE. Set a strong SESSION_SECRET before launch.",
  );
}

function hmac(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function timingEq(a: string, b: string): boolean {
  try {
    return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// Token = `uid.issuedAt.sig` — binding issuedAt bounds a leaked cookie's lifetime (not valid forever).
function sign(uid: string): string {
  const iat = Math.floor(Date.now() / 1000).toString(36);
  return `${uid}.${iat}.${hmac(`${uid}.${iat}`)}`;
}

export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length === 3) {
    const [uid, iatB36, sig] = parts;
    if (!timingEq(sig, hmac(`${uid}.${iatB36}`))) return null;
    const iat = parseInt(iatB36, 36);
    if (!Number.isFinite(iat) || Date.now() / 1000 - iat > MAX_AGE) return null; // expired
    return uid;
  }
  // Legacy `uid.sig` tokens (no bound expiry) — accept once so existing sessions survive; the next
  // sign-in re-issues the hardened format. User ids carry no dots, so this split is unambiguous.
  if (parts.length === 2) {
    const [uid, sig] = parts;
    if (timingEq(sig, hmac(uid))) return uid;
  }
  return null;
}

/** The signed cookie payload to set after sign-in (attach to a NextResponse). */
export function sessionCookie(uid: string) {
  return {
    name: SESSION_COOKIE,
    value: sign(uid),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
}

export function clearedCookie() {
  return { name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 };
}

/** Read the current signed-in user (server components + route handlers). */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const uid = verifyToken(jar.get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  return getRepo().getUser(uid);
}
