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
const SECRET = process.env.SESSION_SECRET || "dev-insecure-secret-change-me";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function sign(uid: string): string {
  const sig = crypto.createHmac("sha256", SECRET).update(uid).digest("base64url");
  return `${uid}.${sig}`;
}

export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const uid = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = crypto.createHmac("sha256", SECRET).update(uid).digest("base64url");
  try {
    if (sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return uid;
    }
  } catch {
    /* fall through */
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
