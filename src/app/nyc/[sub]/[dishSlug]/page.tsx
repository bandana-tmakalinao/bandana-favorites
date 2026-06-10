import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import { ConfidenceDot, PhotoThumb, ScoreBadge } from "@/components/bits";
import PhotoUpload from "@/components/PhotoUpload";
import PinButton from "@/components/PinButton";
import ShareButton from "@/components/ShareButton";
import { categoryGradient } from "@/lib/categoryTheme";
import { dishPath } from "@/lib/links";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ sub: string; dishSlug: string }> }) {
  const { sub, dishSlug } = await params;
  const detail = getRepo().getContenderBySlug(sub, dishSlug);
  if (!detail) return { title: "Not found" };
  const { contender: c, subcategory, place } = detail;
  const title = c.rank
    ? `${c.title} at ${place.name} — #${c.rank} best ${subcategory.name.toLowerCase()} in NYC`
    : `${c.title} at ${place.name}`;
  const description =
    c.description ||
    `${c.title} at ${place.name}, ${place.neighborhood} — ranked head-to-head on Bandana Faves.`;
  return {
    title,
    description,
    // Canonical is ALWAYS the slug URL, even when this page was reached via a raw contender id.
    alternates: { canonical: dishPath(c) },
    openGraph: {
      title,
      description,
      images: [{ url: `/share/dish/${c.id}/image?og=1`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image" as const },
  };
}

export default async function DishPage({ params }: { params: Promise<{ sub: string; dishSlug: string }> }) {
  const { sub, dishSlug } = await params;
  const detail = getRepo().getContenderBySlug(sub, dishSlug);
  if (!detail) notFound();

  const { contender: c, category, subcategory, place, photos, neighbors } = detail;
  // Reached via a raw id or a stale slug → one hop to the canonical URL.
  if (c.slug !== dishSlug) permanentRedirect(dishPath(c));

  const user = await getCurrentUser();
  const alreadyRanked = user
    ? getRepo().getPersonalRankedList(user.id, subcategory.slug).some((v) => v.id === c.id)
    : false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-3 flex items-center gap-2 text-sm text-[var(--color-ink-dim)]">
        <Link href={`/nyc/${subcategory.slug}`} className="hover:text-[var(--color-ink)]">
          ← Best {subcategory.name} in NYC
        </Link>
      </div>

      {c.photoUrl ? (
        <PhotoThumb url={c.photoUrl} alt={c.title} className="h-64 w-full" />
      ) : (
        <div
          className="relative grid h-44 w-full place-items-center overflow-hidden rounded-3xl text-white shadow-[0_14px_40px_-18px_rgba(35,28,22,0.55)]"
          style={{ backgroundImage: categoryGradient(subcategory.slug) }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -right-2 select-none text-[10rem] opacity-20"
          >
            {subcategory.emoji || category.emoji}
          </span>
          <span className="text-6xl drop-shadow-md">{subcategory.emoji || category.emoji}</span>
          {c.rank != null && (
            <span className="absolute bottom-3 left-5 font-display text-5xl text-white/90 drop-shadow-sm">
              #{c.rank}
            </span>
          )}
          <span className="absolute right-3 top-3 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
            {subcategory.name} · NYC
          </span>
        </div>
      )}

      <div className="mt-4 flex items-start gap-4">
        <ScoreBadge score={c.score} size="lg" standing={c.standing} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl sm:text-3xl">{c.title}</h1>
          <p className="text-[var(--color-ink-dim)]">
            <Link href={`/p/${place.id}`} className="font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)] hover:underline">
              {place.name}
            </Link>{" "}
            · {place.neighborhood}, {place.borough}
          </p>
          <p className="text-sm text-[var(--color-ink-dim)]">{place.address}</p>
          {c.description && <p className="mt-2 text-sm text-[var(--color-ink)]">{c.description}</p>}
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
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/duel?sub=${subcategory.slug}&target=${c.id}`}
            className="rounded-lg bg-[var(--color-brand)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--color-brand-soft)]"
          >
            {alreadyRanked ? "↻ Re-rank this for me" : "⚔️ Rank this for me"}
          </Link>
          <PinButton contenderId={c.id} signedIn={!!user} initialPinned={(user?.pinnacle ?? []).includes(c.id)} />
          <ShareButton
            kind="dish"
            id={c.id}
            title={c.rank ? `${c.title} at ${place.name} — #${c.rank} best ${subcategory.name.toLowerCase()} in NYC` : `${c.title} at ${place.name}`}
            pageHref={dishPath(c)}
            variant="ghost"
          />
          <PhotoUpload contenderId={c.id} signedIn={!!user} />
          <Link
            href={`/duel?sub=${subcategory.slug}&keep=${c.id}&mode=open`}
            className="text-sm text-[var(--color-ink-dim)] transition hover:text-[var(--color-ink)]"
          >
            or open-duel it →
          </Link>
        </div>
        {alreadyRanked && (
          <p className="mt-2 text-xs text-[var(--color-ink-dim)]">
            You&apos;ve ranked this — re-ranking pulls it out and places it fresh against your other picks.
          </p>
        )}
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
                href={dishPath(n)}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 transition hover:border-[var(--color-brand)] hover:shadow-[0_4px_14px_-10px_rgba(35,28,22,0.4)]"
              >
                <span className="w-5 text-center text-sm font-bold text-[var(--color-ink-dim)]">
                  {n.rank ?? "–"}
                </span>
                <PhotoThumb url={n.photoUrl} alt={n.title} className="h-10 w-10" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium">{n.title}</span>{" "}
                  <span className="text-[var(--color-ink-dim)]">· {n.placeName}</span>
                </span>
                <ScoreBadge score={n.score} size="sm" standing={n.standing} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
