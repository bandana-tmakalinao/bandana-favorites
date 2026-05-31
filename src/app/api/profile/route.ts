import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const patch: { name?: string; bio?: string; showcase?: string[]; expertCategories?: string[] } = {};
  if (typeof body?.name === "string") patch.name = body.name;
  if (typeof body?.bio === "string") patch.bio = body.bio;
  if (Array.isArray(body?.showcase)) patch.showcase = body.showcase;
  if (Array.isArray(body?.expertCategories)) patch.expertCategories = body.expertCategories;
  getRepo().updateProfile(user.id, patch);
  return NextResponse.json({ ok: true });
}
