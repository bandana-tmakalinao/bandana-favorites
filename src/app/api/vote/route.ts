import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to vote." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const contenderId = body?.contenderId as string | undefined;
  const value = body?.value as number | undefined;
  if (!contenderId || (value !== 1 && value !== -1)) {
    return NextResponse.json({ error: "contenderId and value (1 or -1) are required." }, { status: 400 });
  }

  const repo = getRepo();
  const result = repo.recordVote(user.id, contenderId, value as 1 | -1);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const detail = repo.getContenderDetail(contenderId);
  return NextResponse.json({ ok: true, score: detail?.contender.score, rank: detail?.contender.rank });
}
