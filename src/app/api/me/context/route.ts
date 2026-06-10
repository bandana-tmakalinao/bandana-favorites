import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import { isModerator } from "@/lib/moderation";
import type { ContenderView } from "@/lib/types";

/**
 * Consolidated viewer context — the ONE personalization fetch that lets the public pages
 * (header, category, dish, place) render as cached/ISR shells while everything
 * viewer-specific hydrates client-side.
 *
 *   GET /api/me/context           → { user, pinnacle }
 *   GET /api/me/context?sub=pizza → + { sub: { favoriteId, favorite, personal } }
 *
 * Never exposes email/oauth/trust internals — only what the UI renders.
 */
export const dynamic = "force-dynamic";

type SubContext = {
  favoriteId: string | null;
  favorite: ContenderView | null;
  personal: ContenderView[];
};

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const subSlug = req.nextUrl.searchParams.get("sub");

  let sub: SubContext | undefined;
  if (user && subSlug) {
    const repo = getRepo();
    const favoriteId = repo.getCategoryFavorite(user.id, subSlug);
    // Resolve the favorite exactly as the category page used to server-side: prefer the live
    // list view (has rank), fall back to a detail lookup for an off-list favorite.
    let favorite: ContenderView | null = null;
    if (favoriteId) {
      const list = repo.getRankedList(subSlug);
      favorite =
        [...(list?.ranked ?? []), ...(list?.contenders ?? [])].find((v) => v.id === favoriteId) ??
        repo.getContenderDetail(favoriteId)?.contender ??
        null;
    }
    sub = { favoriteId, favorite, personal: repo.getPersonalRankedList(user.id, subSlug) };
  } else if (subSlug) {
    sub = { favoriteId: null, favorite: null, personal: [] };
  }

  return NextResponse.json(
    {
      user: user
        ? {
            handle: user.handle,
            name: user.name,
            avatarUrl: user.avatarUrl ?? null,
            isCurator: user.isCurator,
            isModerator: isModerator(user),
          }
        : null,
      pinnacle: user?.pinnacle ?? [],
      ...(sub ? { sub } : {}),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
