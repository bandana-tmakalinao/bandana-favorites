import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dishes/match?sub=ramen&q=tonkotsu
// Returns the fuzzy resolution of a typed dish name against the category vocabulary.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sub = searchParams.get("sub") ?? "";
  const q = searchParams.get("q") ?? "";
  if (!sub || !q.trim()) return NextResponse.json({ decision: "new", suggestion: null, score: 0 });
  const r = getRepo().matchDish(sub, q);
  return NextResponse.json(r);
}
