import Link from "next/link";
import { getRepo } from "@/db/repo";
import RotatingTopList from "@/components/RotatingTopList";
import TopTenPanel from "@/components/TopTenPanel";
import SearchBar from "@/components/SearchBar";

export const dynamic = "force-dynamic";

const FEATURED = ["ramen", "pizza"];

export default function Home() {
  const showcase = getRepo().getHomeShowcase(10);
  const featured = FEATURED.map((s) => showcase.find((e) => e.slug === s)).filter(
    (e): e is NonNullable<typeof e> => !!e,
  );
  const others = showcase.filter((e) => !FEATURED.includes(e.slug));

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="pt-12 sm:pt-16">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-ink-dim)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-good)]" />
          Now ranking — New York City
        </p>
        <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          The best food in NYC, ranked by the{" "}
          <span className="text-[var(--color-brand)]">food</span>.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-[var(--color-ink-dim)]">
          Not &ldquo;best restaurants.&rdquo; Best <em>ramen</em>. Best <em>pizza</em>. The dish is the
          headline; the place is the subtitle. Ranked by head-to-head comparisons and earned trust —
          never mass voting.
        </p>
        <div className="mt-6">
          <SearchBar variant="hero" />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/nyc"
            className="rounded-lg bg-[var(--color-brand)] px-5 py-3 font-semibold text-black transition hover:bg-[var(--color-brand-soft)]"
          >
            Explore NYC rankings
          </Link>
          <Link
            href="/duel"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 font-semibold transition hover:border-[var(--color-ink-dim)]"
          >
            Settle a duel →
          </Link>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-dim)]">
            The lists · seeded from 2025+ best-of guides, ranked by you
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {featured.map((e) => (
              <TopTenPanel key={e.slug} entry={e} />
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-12 grid items-start gap-6 lg:grid-cols-[1fr_minmax(0,22rem)]">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                t: "1. Pick a food",
                d: "Choose a category — ramen, pizza, tacos. You get an absolute ranked list of dishes across the city.",
              },
              {
                t: "2. Duel two dishes",
                d: "“Which is better, A or B?” Your comparisons drive a trust-weighted Bradley-Terry ranking.",
              },
              {
                t: "3. Earn trust",
                d: "Add photos, get them verified, rate widely. The more you’re trusted, the more your vote moves the list.",
              },
            ].map((c) => (
              <div
                key={c.t}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
              >
                <h3 className="font-semibold">{c.t}</h3>
                <p className="mt-2 text-sm text-[var(--color-ink-dim)]">{c.d}</p>
              </div>
            ))}
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-dim)]">
              More flavors being ranked
            </h2>
            <RotatingTopList entries={others} />
          </div>
        </section>
      )}

      <div className="pb-20" />
    </div>
  );
}
