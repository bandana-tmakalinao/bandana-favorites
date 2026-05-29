import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q") ?? "";
  const sub = params.get("sub") ?? "";
  return NextResponse.json({ places: getRepo().searchPlaces(q, sub, 8) });
}
