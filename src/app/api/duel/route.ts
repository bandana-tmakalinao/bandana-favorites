import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const sub = params.get("sub") ?? undefined;
  const keep = params.get("keep") ?? undefined;
  const pair = getRepo().getDuelPair(sub, keep);
  return NextResponse.json({ pair });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to settle duels." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const winnerId = body?.winnerId as string | undefined;
  const loserId = body?.loserId as string | undefined;
  const sub = (body?.sub as string | undefined) ?? undefined;
  if (!winnerId || !loserId) {
    return NextResponse.json({ error: "winnerId and loserId are required." }, { status: 400 });
  }

  const repo = getRepo();
  const result = repo.recordDuel(user.id, winnerId, loserId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // King of the hill: the winner stays, a fresh challenger rotates in.
  const next = repo.getDuelPair(sub, winnerId);
  return NextResponse.json({ ok: true, next });
}
