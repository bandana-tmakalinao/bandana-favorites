import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import DuelBoard from "@/components/DuelBoard";
import type { ContenderView } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Duel · Bandana Faves" };

export default async function DuelPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string; keep?: string; tried?: string; placeId?: string; place?: string }>;
}) {
  const { sub, keep, tried, placeId, place } = await searchParams;
  const triedIds = tried?.split(",").filter(Boolean) ?? [];

  // Resolve tried IDs to ContenderViews for adaptive mode (use the ranked list as the source).
  let adaptiveItems: ContenderView[] | undefined;
  let kingView: ContenderView | undefined;
  if (keep && triedIds.length > 0 && sub) {
    const list = getRepo().getRankedList(sub);
    if (list) {
      const all = [...list.ranked, ...list.contenders];
      kingView = all.find((v) => v.id === keep);
      // Preserve community rank order — items already sorted by list position.
      adaptiveItems = triedIds
        .map((id) => all.find((v) => v.id === id))
        .filter((v): v is ContenderView => v !== undefined);
    }
  }

  // For non-adaptive mode, pass prefer so getDuelPair can seed the first challenger.
  const prefer = adaptiveItems ? undefined : triedIds.length > 0 ? triedIds : undefined;
  const pair = getRepo().getDuelPair(sub, keep, prefer);
  const user = await getCurrentUser();
  const initialStanding = user && sub ? getRepo().getCategoryStanding(user.id, sub) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <DuelBoard
        initialPair={pair}
        sub={sub}
        signedIn={!!user}
        initialKeepId={keep}
        initialPrefer={prefer}
        adaptiveItems={adaptiveItems}
        kingView={kingView}
        placeId={placeId}
        placeName={place ? decodeURIComponent(place) : undefined}
        initialStanding={initialStanding}
      />
    </div>
  );
}
