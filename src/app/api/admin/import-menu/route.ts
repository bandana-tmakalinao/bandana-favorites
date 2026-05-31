import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isModerator } from "@/lib/moderation";
import { getRepo } from "@/db/repo";
import type { MenuImportInput } from "@/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Moderator menu import. Body = MenuImportInput. Every imported dish lands UNRANKED (score 0) and
 * has to earn its way up — there is no third-party rating, only the place×dish association. Gated to
 * moderators because it writes directly to the public catalog.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  if (!isModerator(user)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as MenuImportInput | null;
  if (!body || !body.placeName || !Array.isArray(body.items)) {
    return NextResponse.json({ ok: false, error: "placeName + items[] required" }, { status: 400 });
  }
  if (body.items.length > 100) {
    return NextResponse.json({ ok: false, error: "Max 100 items per import." }, { status: 400 });
  }

  const result = getRepo().importMenu(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
