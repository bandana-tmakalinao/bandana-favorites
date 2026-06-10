import Link from "next/link";
import { getRepo } from "@/db/repo";
import RotatingCover from "@/components/RotatingCover";
import RankingCard from "@/components/RankingCard";
import SearchBar from "@/components/SearchBar";

export const dynamic = "force-dynamic";

export const metadata = { alternates: { canonical: "/" } };

// Lead the rotation with the two great debates, then the rest by ranked volume.
const FEATURED = ["pizza", "cheeseburger"];

export default function Home() {
  const showcase = getRepo().getHomeShowcase(10);
  const featured = FEATURED.map((s) => showcase.find((e) => e.slug === s)).filter(
    (e): e is NonNullable<typeof e> => !!e,
  );
  const marquee = [...featured, ...showcase.filter((e) => !FEATURED.includes(e.slug))].slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid items-start gap-8 pt-10 sm:pt-14 lg:grid-cols-[1fr_minmax(0,30rem)] lg:gap-10">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-ink-dim)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-good)]" />
            Now ranking · New York City
          </p>
          <h1 className="text-balance font-display text-4xl leading-[1.04] sm:text-6xl">
            The best food in NYC, ranked by the <span className="text-[var(--color-brand)]">food</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[var(--color-ink-dim)]">
            Not &ldquo;best restaurants.&rdquo; Best <em>ramen</em>. Best <em>pizza</em>. The dish is the
            headline; the place is the subtitle. Ranked by head-to-head comparisons and earned trust,
            never mass voting.
          </p>
          <div className="mt-6 max-w-xl">
            <SearchBar variant="hero" />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/explore"
              className="rounded-lg bg-[var(--color-brand)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--color-brand-soft)]"
            >
              Explore Rankings →
            </Link>
            <Link
              href="/nyc"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 font-semibold transition hover:border-[var(--color-ink-dim)]"
            >
              Browse by food
            </Link>
          </div>
        </div>

        {/* Rotating cover — the polished ranking card, cycling through top food types */}
        <div className="lg:pt-1">
          <RotatingCover>
            {marquee.map((e) => (
              <RankingCard
                key={e.slug}
                entry={e}
                variant="cover"
                rows={5}
                hook="Ranked by head-to-head duels, not star averages."
              />
            ))}
          </RotatingCover>
        </div>
      </section>

      <section className="mt-14 grid gap-4 pb-20 sm:grid-cols-3">
        {[
          {
            t: "1. Pick a food",
            d: "Ramen, pizza, tacos, dosa… you get an absolute ranked list of dishes across the city.",
          },
          {
            t: "2. Duel two dishes",
            d: "“Which is better, A or B?” The one you pick stays; comparisons drive a trust-weighted ranking.",
          },
          {
            t: "3. Earn trust",
            d: "Add photos, get them verified, rate widely. The more you’re trusted, the more your vote moves the list.",
          },
        ].map((c) => (
          <div key={c.t} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h3 className="font-semibold">{c.t}</h3>
            <p className="mt-2 text-sm text-[var(--color-ink-dim)]">{c.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
