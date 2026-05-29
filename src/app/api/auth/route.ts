import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { clearedCookie, getCurrentUser, sessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}

export async function POST(req: Request) {
  const { name } = await req.json().catch(() => ({ name: "" }));
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Enter a name (at least 2 characters)." }, { status: 400 });
  }
  const user = getRepo().getOrCreateUser(name);
  const res = NextResponse.json({ user });
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
