import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dishes/list?sub=ramen — the existing dish names in a food type (for autocomplete).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sub = searchParams.get("sub") ?? "";
  if (!sub) return NextResponse.json({ names: [] });
  return NextResponse.json({ names: getRepo().listDishNames(sub) });
}
