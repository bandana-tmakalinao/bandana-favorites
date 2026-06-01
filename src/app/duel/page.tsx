import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import DuelBoard from "@/components/DuelBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Duel · Bandana Faves" };

export default async function DuelPage({
  searchParams,
}: {
  searchParams: Promise<{
    sub?: string;
    mode?: string;
    target?: string;
    tried?: string; // legacy: community picks the user marked tried (CategoryAlsoTried)
    keep?: string;
    prefer?: string;
    placeId?: string;
    place?: string;
  }>;
}) {
  const { sub, mode, target, tried, keep, prefer, placeId, place } = await searchParams;
  const user = await getCurrentUser();
  const wantOpen = mode === "open";

  // Default: tried-gated placement. You only ever duel dishes you've actually tried. Requires sign-in
  // (we need to know your history) and a known food type.
  if (user && sub && !wantOpen) {
    const targetIds = [
      ...(target?.split(",").filter(Boolean) ?? []),
      ...(tried?.split(",").filter(Boolean) ?? []),
    ];
    const session = getRepo().getRankSession(user.id, sub, targetIds);
    if (session) {
      const template = {
        category: { emoji: session.category.emoji, name: session.category.name },
        subcategory: { slug: session.subcategory.slug, name: session.subcategory.name },
      };
      return (
        <div className="mx-auto max-w-2xl px-4 py-8 lg:max-w-3xl">
          <DuelBoard
            mode="place"
            sub={sub}
            signedIn
            template={template}
            placed={session.placed}
            candidates={session.candidates}
            targets={session.targets}
            placeId={placeId}
            placeName={place ? decodeURIComponent(place) : undefined}
            initialStanding={session.standing}
          />
        </div>
      );
    }
  }

  // Open / king-of-the-hill — the secondary "open duel" mode (and the not-signed-in teaser).
  const preferList = prefer?.split(",").filter(Boolean);
  const pair = getRepo().getDuelPair(sub, keep, preferList);
  const initialStanding = user && sub ? getRepo().getCategoryStanding(user.id, sub) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 lg:max-w-3xl">
      <DuelBoard
        mode="open"
        initialPair={pair}
        sub={sub}
        signedIn={!!user}
        initialKeepId={keep}
        initialPrefer={preferList}
        initialStanding={initialStanding}
      />
    </div>
  );
}
