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
  const rating = body?.rating as number | undefined;
  if (!contenderId || typeof rating !== "number" || rating < 0 || rating > 100) {
    return NextResponse.json({ error: "contenderId and rating (0–100) are required." }, { status: 400 });
  }

  const repo = getRepo();
  const result = repo.recordVote(user.id, contenderId, rating);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const detail = repo.getContenderDetail(contenderId);
  return NextResponse.json({ ok: true, score: detail?.contender.score, rank: detail?.contender.rank });
}
