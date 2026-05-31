import Link from "next/link";
import { getRepo } from "@/db/repo";
import RankingCard from "@/components/RankingCard";
import SearchBar from "@/components/SearchBar";

export const dynamic = "force-dynamic";

// Lead the feed with the two great debates, then the rest by ranked volume.
const FEATURED = ["pizza", "cheeseburger"];
const HOOKS: Record<string, string> = {
  pizza: "The eternal NYC debate, settled slice by slice.",
  cheeseburger: "Smashed, stacked, or pub-style — the city's best.",
};
const TINTS = [
  "from-[#fde7dc] to-[#fbd9c6]", // coral cream
  "from-[#fdf0cf] to-[#f8e3a6]", // gold cream
  "from-[#fce4ec] to-[#f7cdd9]", // rose
  "from-[#e3f0ea] to-[#c9e4d8]", // sage
];

export default function Home() {
  const showcase = getRepo().getHomeShowcase(10);
  const featured = FEATURED.map((s) => showcase.find((e) => e.slug === s)).filter(
    (e): e is NonNullable<typeof e> => !!e,
  );
  const ordered = [...featured, ...showcase.filter((e) => !FEATURED.includes(e.slug))];
  const feed = ordered.slice(0, 6);
  const totalLists = showcase.length;

  return (
    <div className="mx-auto max-w-2xl px-4">
      {/* Hero */}
      <section className="pt-10 sm:pt-12">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-ink-dim)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-good)]" />
          Now ranking · New York City
        </p>
        <h1 className="text-balance text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
          The best food in NYC, ranked by the <span className="text-[var(--color-brand)]">food</span>.
        </h1>
        <p className="mt-4 text-lg text-[var(--color-ink-dim)]">
          Not &ldquo;best restaurants.&rdquo; Best <em>ramen</em>. Best <em>pizza</em>. The dish is the
          headline; the place is the subtitle — ranked by head-to-head duels, never mass voting.
        </p>
        <div className="mt-6">
          <SearchBar variant="hero" />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
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
      </section>

      {/* The lists — a vertical scroll of ranking cards (pizza, then burger, then more) */}
      <section className="mt-10 space-y-5">
        {feed.map((e, i) => (
          <RankingCard
            key={e.slug}
            entry={e}
            variant="cover"
            rows={5}
            tint={TINTS[i % TINTS.length]}
            hook={HOOKS[e.slug]}
          />
        ))}

        <Link
          href="/explore"
          className="block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-5 py-4 text-center font-semibold text-[var(--color-brand)] transition hover:bg-[var(--color-surface)]"
        >
          Explore all {totalLists} rankings →
        </Link>
      </section>

      {/* How it works */}
      <section className="mt-12 grid gap-4 pb-20 sm:grid-cols-3">
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
