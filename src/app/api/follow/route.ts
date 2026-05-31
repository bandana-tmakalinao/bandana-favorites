import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRepo } from "@/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to follow." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const handle = typeof body?.handle === "string" ? body.handle : "";
  const follow = body?.follow !== false; // default to follow
  if (!handle) return NextResponse.json({ ok: false, error: "Missing handle." }, { status: 400 });

  const result = getRepo().setFollow(user.id, handle, follow);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
