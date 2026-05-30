import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { sessionCookie } from "@/lib/auth";
import { verifyPassword, TIMING_DUMMY } from "@/lib/password";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rl = rateLimit(`login:${clientIp(req)}`, 10, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const user = getRepo().getUserByEmail(email);
  // Always run a verify (against a dummy hash when the email is unknown) so timing doesn't leak
  // whether an account exists, and return a single generic message either way.
  const valid = await verifyPassword(password, user?.passwordHash ?? TIMING_DUMMY);
  if (!user || !valid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  const res = NextResponse.json({ user: { handle: user.handle, name: user.name } });
  const c = sessionCookie(user.id);
  res.cookies.set(c.name, c.value, c);
  return res;
}
