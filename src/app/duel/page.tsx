import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import DuelBoard from "@/components/DuelBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Duel · Bandana Favorites" };

export default async function DuelPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string; keep?: string }>;
}) {
  const { sub, keep } = await searchParams;
  const pair = getRepo().getDuelPair(sub, keep);
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <DuelBoard initialPair={pair} sub={sub} signedIn={!!user} initialKeepId={keep} />
    </div>
  );
}
