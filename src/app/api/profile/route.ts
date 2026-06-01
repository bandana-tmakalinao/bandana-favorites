import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const repo = getRepo();

  // Username (handle) change — unique, validated. Reject early so the rest of the profile isn't half-saved.
  let handle = user.handle;
  if (typeof body?.handle === "string" && body.handle.trim()) {
    const res = repo.setHandle(user.id, body.handle);
    if (!res.ok) return NextResponse.json({ error: res.error ?? "Couldn't set username." }, { status: 409 });
    handle = res.handle ?? handle;
  }

  const patch: { name?: string; bio?: string; showcase?: string[]; expertCategories?: string[] } = {};
  if (typeof body?.name === "string") patch.name = body.name;
  if (typeof body?.bio === "string") patch.bio = body.bio;
  if (Array.isArray(body?.showcase)) patch.showcase = body.showcase;
  if (Array.isArray(body?.expertCategories)) patch.expertCategories = body.expertCategories;
  repo.updateProfile(user.id, patch);
  return NextResponse.json({ ok: true, handle });
}
