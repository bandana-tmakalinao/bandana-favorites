import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isModerator } from "@/lib/moderation";
import { getRepo } from "@/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Moderator: hide one or more contenders (e.g. a wrong-store menu import). Hidden contenders drop from
 * every list + search. Body: { contenderId } or { contenderIds: [...] }. Curator-gated.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  if (!isModerator(user)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.contenderIds)
    ? body.contenderIds
    : body?.contenderId
      ? [body.contenderId]
      : [];
  if (!ids.length) return NextResponse.json({ ok: false, error: "contenderId(s) required" }, { status: 400 });

  const repo = getRepo();
  const results = ids.map((id) => ({ id, ...repo.hideContender(id) }));
  return NextResponse.json({ ok: true, hidden: results.filter((r) => r.ok).length, results });
}
