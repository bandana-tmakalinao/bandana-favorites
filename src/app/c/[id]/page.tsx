import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import { ConfidenceDot, PhotoThumb, ScoreBadge, tierLabel } from "@/components/bits";
import RatingControl from "@/components/RatingControl";
import PhotoUpload from "@/components/PhotoUpload";

export const dynamic = "force-dynamic";

export default async function ContenderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getRepo().getContenderDetail(id);
  if (!detail) notFound();

  const user = await getCurrentUser();
  const { contender: c, category, subcategory, place, photos, neighbors } = detail;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-3 flex items-center gap-2 text-sm text-[var(--color-ink-dim)]">
        <Link href={`/nyc/${subcategory.slug}`} className="hover:text-[var(--color-ink)]">
          ← Best {subcategory.name} in NYC
        </Link>
      </div>

      <PhotoThumb url={c.photoUrl} alt={c.title} className="h-64 w-full" />

      <div className="mt-4 flex items-start gap-4">
        <ScoreBadge score={c.score} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black tracking-tight">{c.title}</h1>
          <p className="text-[var(--color-ink-dim)]">
            {place.name} · {place.neighborhood}, {place.borough}
          </p>
          <p className="text-sm text-[var(--color-ink-dim)]">{place.address}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {c.rank && (
              <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 font-semibold">
                #{c.rank} {category.emoji} {subcategory.name}
              </span>
            )}
            <ConfidenceDot tier={c.tier} withLabel />
            <span className="text-[var(--color-ink-dim)]">
              · {c.comparisonCount} duels · {c.weightedVotes} weighted votes
            </span>
          </div>
        </div>
      </div>

      {c.seedSources.length > 0 && (
        <p className="mt-3 text-sm text-[var(--color-ink-dim)]">
          <span className="text-[var(--color-gold)]">★</span> Seed informed by:{" "}
          <span className="text-[var(--color-ink)]">{c.seedSources.join(", ")}</span>
          <span className="block text-xs">
            Starting position from public best-of lists — your duels decide the real order.
          </span>
        </p>
      )}

      {c.tier === "provisional" && (
        <p className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-ink-dim)]">
          Provisional — not enough trusted votes yet to lock in a rank. Duel it to help the crowd
          decide.
        </p>
      )}

      <div className="mt-6 space-y-4 border-t border-[var(--color-border)] pt-6">
        <RatingControl contenderId={c.id} signedIn={!!user} />
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/duel?sub=${subcategory.slug}&keep=${c.id}`}
            className="rounded-lg bg-[var(--color-brand)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--color-brand-soft)]"
          >
            ⚔️ Duel this vs others
          </Link>
          <PhotoUpload contenderId={c.id} signedIn={!!user} />
        </div>
      </div>

      {photos.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-ink-dim)]">
            Photos {photos.some((p) => p.placeholder) && "(placeholder stock — real photos are user-uploaded)"}
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {photos.map((p) => (
              <span key={p.id} className="relative">
                <PhotoThumb url={p.url} alt={c.title} className="h-28 w-36 shrink-0" />
                {p.status === "pending" && (
                  <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-[var(--color-gold)]">
                    pending
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {neighbors.length > 0 && (
        <div className="mt-8 border-t border-[var(--color-border)] pt-6">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-ink-dim)]">Nearby in the ranking</h2>
          <div className="space-y-2">
            {neighbors.map((n) => (
              <Link
                key={n.id}
                href={`/c/${n.id}`}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 transition hover:border-[var(--color-ink-dim)]"
              >
                <span className="w-5 text-center text-sm font-bold text-[var(--color-ink-dim)]">
                  {n.rank ?? "–"}
                </span>
                <PhotoThumb url={n.photoUrl} alt={n.title} className="h-10 w-10" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium">{n.title}</span>{" "}
                  <span className="text-[var(--color-ink-dim)]">· {n.placeName}</span>
                </span>
                <ScoreBadge score={n.score} size="sm" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
