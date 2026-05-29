import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to add a place." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const placeId = body?.placeId as string | undefined;
  const sub = body?.sub as string | undefined;
  if (!placeId || !sub) return NextResponse.json({ error: "placeId and sub are required." }, { status: 400 });

  const result = getRepo().addContenderAtPlace(user.id, placeId, sub);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, contenderId: result.contenderId });
}
