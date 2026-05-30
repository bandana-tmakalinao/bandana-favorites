import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ contenderId: null });
  const sub = new URL(req.url).searchParams.get("sub") ?? "";
  if (!sub) return NextResponse.json({ error: "sub is required." }, { status: 400 });
  const contenderId = getRepo().getCategoryFavorite(user.id, sub);
  return NextResponse.json({ contenderId });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const sub = body?.sub as string | undefined;
  const contenderId = body?.contenderId as string | undefined;
  if (!sub || !contenderId) {
    return NextResponse.json({ error: "sub and contenderId are required." }, { status: 400 });
  }
  const result = getRepo().setCategoryFavorite(user.id, sub, contenderId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
