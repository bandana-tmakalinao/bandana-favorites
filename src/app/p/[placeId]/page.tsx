import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import { ScoreBadge, ConfidenceDot } from "@/components/bits";
import AddDishHere from "@/components/AddDishHere";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  const d = getRepo().getPlaceDetail(decodeURIComponent(placeId));
  return { title: d ? `${d.place.name} · Bandana Faves` : "Not found · Bandana Faves" };
}

export default async function PlacePage({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  const detail = getRepo().getPlaceDetail(decodeURIComponent(placeId));
  if (!detail) notFound();

  const user = await getCurrentUser();
  const { place, dishes, categories } = detail;
  const groups = categories
    .map((c) => ({
      name: c.category.name,
      emoji: c.category.emoji,
      subs: c.subcategories.map((s) => ({ slug: s.slug, name: s.name, emoji: s.emoji })),
    }))
    .filter((g) => g.subs.length > 0);
  // Dishes already logged here, grouped by food type — shown as quick "rate it" links in the adder
  // (a place can hold several dishes of one type, so this no longer blocks adding another).
  const existing: Record<string, { id: string; title: string }[]> = {};
  for (const d of dishes) if (d.subSlug) (existing[d.subSlug] ??= []).push({ id: d.id, title: d.title });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-2 text-sm text-[var(--color-ink-dim)]">
        <Link href="/add" className="hover:text-[var(--color-ink)]">
          ← Find a restaurant
        </Link>
      </div>

      {place.borough && (
        <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--color-brand)]">
          {place.neighborhood && place.neighborhood !== place.borough
            ? `${place.neighborhood} · ${place.borough}`
            : place.borough}
        </p>
      )}
      <h1 className="text-3xl font-black tracking-tight">{place.name}</h1>
      <p className="mt-1 text-[var(--color-ink-dim)]">{place.address}</p>

      {place.isProposed && (
        <p className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-ink-dim)]">
          This spot was suggested by a member and is awaiting curator review.
        </p>
      )}

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-ink-dim)]">
          {dishes.length > 0 ? `Dishes logged here (${dishes.length})` : "No dishes logged here yet"}
        </h2>

        {dishes.length === 0 ? (
          <p className="mb-4 text-[var(--color-ink-dim)]">
            Be the first to log what you had at {place.name}.
          </p>
        ) : (
          <div className="mb-5 space-y-2">
            {dishes.map((d) => (
              <Link
                key={d.id}
                href={`/c/${d.id}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition hover:border-[var(--color-brand)]"
              >
                {d.tier === "provisional" ? (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-2)] text-[10px] font-semibold text-[var(--color-ink-dim)]">
                    New
                  </span>
                ) : (
                  <ScoreBadge score={d.score} size="sm" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{d.title}</span>
                  <span className="block truncate text-xs text-[var(--color-ink-dim)]">
                    {d.emoji} {d.subName}
                    {d.rank ? ` · #${d.rank} in NYC` : " · provisional"}
                    {d.description ? ` · ${d.description}` : ""}
                  </span>
                </span>
                <ConfidenceDot tier={d.tier} />
              </Link>
            ))}
          </div>
        )}

        <AddDishHere placeId={place.id} groups={groups} signedIn={!!user} existing={existing} />
      </div>
    </div>
  );
}
