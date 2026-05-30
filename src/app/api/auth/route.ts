import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { clearedCookie, getCurrentUser, publicUser, sessionCookie } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // publicUser() strips passwordHash / email / oauth — never send the raw user to the client.
  return NextResponse.json({ user: publicUser(await getCurrentUser()) });
}

export async function POST(req: Request) {
  const rl = rateLimit(`signin:${clientIp(req)}`, 15, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many sign-in attempts. Try again in ${rl.retryAfter}s.` },
      { status: 429 },
    );
  }
  const { name } = await req.json().catch(() => ({ name: "" }));
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Enter a name (at least 2 characters)." }, { status: 400 });
  }
  const user = getRepo().getOrCreateUser(name);
  const res = NextResponse.json({ user: publicUser(user) });
  const c = sessionCookie(user.id);
  res.cookies.set(c.name, c.value, c);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  const c = clearedCookie();
  res.cookies.set(c.name, c.value, c);
  return res;
}
