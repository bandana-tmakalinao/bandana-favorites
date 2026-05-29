import Link from "next/link";
import { getRepo } from "@/db/repo";
import { PhotoThumb, ScoreBadge } from "@/components/bits";
import SearchBar from "@/components/SearchBar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search · Bandana Favorites" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const res = getRepo().search(q, 40);
  const term = q.trim();
  const empty = term && res.subcategories.length === 0 && res.contenders.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SearchBar variant="hero" autoFocus={!term} />

      {!term && (
        <p className="mt-6 text-[var(--color-ink-dim)]">
          Search a food type (ramen, pizza, bagels) or a place/dish (Lucali, tonkotsu) to explore the
          rankings.
        </p>
      )}

      {term && (
        <p className="mt-6 text-sm text-[var(--color-ink-dim)]">
          Results for <span className="text-[var(--color-ink)]">&ldquo;{term}&rdquo;</span>
        </p>
      )}

      {res.subcategories.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-ink-dim)]">Food types</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {res.subcategories.map((s) => (
              <Link
                key={s.slug}
                href={`/nyc/${s.slug}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition hover:border-[var(--color-brand)]"
              >
                <span className="text-2xl">{s.emoji}</span>
                <span className="flex-1">
                  <span className="block font-semibold">Best {s.name} in NYC</span>
                  <span className="block text-xs text-[var(--color-ink-dim)]">
                    {s.categoryName} · {s.contenderCount} ranked
                  </span>
                </span>
                <span className="text-[var(--color-ink-dim)]">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {res.contenders.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-ink-dim)]">Dishes &amp; places</h2>
          <div className="space-y-2">
            {res.contenders.map((c) => (
              <Link
                key={c.id}
                href={`/c/${c.id}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition hover:border-[var(--color-ink-dim)]"
              >
                <PhotoThumb url={c.photoUrl} alt={c.title} className="h-12 w-12 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.title}</span>
                  <span className="block truncate text-sm text-[var(--color-ink-dim)]">
                    {c.placeName} · {c.neighborhood} · {c.subName}
                  </span>
                </span>
                <ScoreBadge score={c.score} size="sm" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {empty && (
        <p className="mt-8 text-[var(--color-ink-dim)]">
          No matches for &ldquo;{term}&rdquo;. Try a food type like <em>ramen</em> or <em>pizza</em>, or a
          place name.
        </p>
      )}
    </div>
  );
}
