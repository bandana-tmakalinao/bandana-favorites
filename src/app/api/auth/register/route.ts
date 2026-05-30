import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { sessionCookie } from "@/lib/auth";
import { hashPassword, isValidEmail, passwordProblem } from "@/lib/password";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rl = rateLimit(`register:${clientIp(req)}`, 10, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  const pwProblem = passwordProblem(password);
  if (pwProblem) return NextResponse.json({ error: pwProblem }, { status: 400 });
  if (name.length < 2) return NextResponse.json({ error: "Enter a display name (2+ characters)." }, { status: 400 });

  const passwordHash = await hashPassword(password);
  const result = getRepo().createPasswordUser({ email, name, passwordHash });
  if (!result.ok || !result.user) {
    return NextResponse.json({ error: result.error ?? "Could not create account." }, { status: 400 });
  }
  const res = NextResponse.json({ user: { handle: result.user.handle, name: result.user.name } });
  const c = sessionCookie(result.user.id);
  res.cookies.set(c.name, c.value, c);
  return res;
}
