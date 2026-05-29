import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/places/all?q=joe — category-agnostic fuzzy place search for the restaurant-first add flow.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ places: [] });
  return NextResponse.json({ places: getRepo().searchAllPlaces(q, 10) });
}
