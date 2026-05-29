import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Records a "yup, that's real" vouch. The verification gate that uses these is a later phase. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to vouch." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const photoId = body?.photoId as string | undefined;
  if (!photoId) return NextResponse.json({ error: "photoId is required." }, { status: 400 });

  const result = getRepo().vouchPhoto(user.id, photoId);
  if (!result.ok) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
