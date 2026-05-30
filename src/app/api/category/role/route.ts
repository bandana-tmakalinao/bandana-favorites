import { NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Curator-only: grant or revoke a community-member role for a user in a food category.
 * Granting lifts that user's per-category trust cap (TRUST.NORMAL_CAP → TRUST.EXPERT_CAP).
 * body: { targetUserId, sub, role: "member" | null }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const targetUserId = body?.targetUserId as string | undefined;
  const sub = body?.sub as string | undefined;
  const role = body?.role === "member" ? "member" : null;
  if (!targetUserId || !sub) {
    return NextResponse.json({ error: "targetUserId and sub are required." }, { status: 400 });
  }

  // The repo enforces curator access; non-curators get a 403-style error back.
  const result = getRepo().setCategoryRole(user.id, targetUserId, sub, role);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json({ ok: true });
}
