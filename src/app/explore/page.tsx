import Link from "next/link";
import { getRepo } from "@/db/repo";
import type { ShowcaseEntry } from "@/db/repo";
import RankingCard from "@/components/RankingCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Explore the NYC Food Power Rankings · Bandana Faves",
  description:
    "Every great dish in NYC, ranked head-to-head. Best pizza, best burger, best ramen — the food is the headline, the place is the subtitle.",
};

// The two lists everyone has an opinion about — the hero of the page.
// (The burger food type's slug is "cheeseburger".)
const FEATURED_SLUGS = ["pizza", "cheeseburger"];
const HOOKS: Record<string, string> = {
  pizza: "The eternal NYC debate, settled slice by slice.",
  cheeseburger: "Smashed, stacked, or pub-style — the city's best, ranked.",
};
// Desserts + drinks get their own closing shelf; everything else is "Most Popular".
const SWEET_KINDS = new Set(["dessert", "drink"]);
// Two distinct warm tints so the hero cards never read as a repeat (they're the same kind).
const FEATURED_TINTS = ["from-[#fde7dc] to-[#fbd9c6]", "from-[#fdf0cf] to-[#f8e3a6]"];
// Warm tint per category kind — mirrors the /nyc hub cards so the page reads as a vibrant
// menu with zero photos.
const KIND_TINT: Record<string, string> = {
  cuisine: "from-[#fde7dc] to-[#fbd9c6]", // coral cream
  format: "from-[#fdf0cf] to-[#f8e3a6]", // gold cream
  dessert: "from-[#fce4ec] to-[#f7cdd9]", // rose
  drink: "from-[#e3f0ea] to-[#c9e4d8]", // sage
};

// Large enough to return every ranked dish in any food type (no list is near this big),
// so each card's "See all {N}" reflects the true total, not a truncated slice.
const ALL_RANKED = 500;

export default function ExplorePage() {
  const repo = getRepo();
  // getHomeShowcase is already sorted by ranked volume (liveliest first).
  const rawShowcase = repo.getHomeShowcase(ALL_RANKED);
  // Subcategory slugs can repeat across categories (e.g. bagel under both Cuisines and Iconic
  // NYC); dedupe by slug so a ranking never renders twice and keys stay unique.
  const showcase = [...new Map(rawShowcase.map((e) => [e.slug, e])).values()];
  const groups = repo.listCategories();

  const bySlug = new Map<string, ShowcaseEntry>(showcase.map((e) => [e.slug, e]));
  const kindByCategory = new Map(groups.map((g) => [g.category.name, g.category.kind]));
  const tintFor = (e: ShowcaseEntry) =>
    KIND_TINT[kindByCategory.get(e.categoryName) ?? "cuisine"] ?? KIND_TINT.cuisine;

  // Featured = pizza + burger; fall back to the two biggest lists if those slugs ever change.
  let featured = FEATURED_SLUGS.map((s) => bySlug.get(s)).filter((e): e is ShowcaseEntry => !!e);
  if (featured.length < 2) {
    const extra = showcase.filter((e) => !featured.includes(e)).slice(0, 2 - featured.length);
    featured = [...featured, ...extra];
  }
  const featSet = new Set(featured.map((e) => e.slug));

  // Most NYC categories hold a single food type (Pizza, Japanese=ramen…), so grouping by
  // category would scatter the page into ~11 single-card sections. Instead bucket by KIND:
  // a dense, volume-sorted "Most Popular" wall of savory lists, then a "Sweet & Sips" shelf.
  const rest = showcase.filter((e) => !featSet.has(e.slug)); // already volume-sorted desc
  const isSweet = (e: ShowcaseEntry) => SWEET_KINDS.has(kindByCategory.get(e.categoryName) ?? "");
  const buckets = [
    { id: "popular", label: "Most Popular", entries: rest.filter((e) => !isSweet(e)) },
    { id: "sweet", label: "Sweet & Sips", entries: rest.filter(isSweet) },
  ].filter((b) => b.entries.length > 0);

  const totalTypes = showcase.length;
  const totalRanked = showcase.reduce((n, e) => n + e.items.length, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 [overflow-x:clip]">
      {/* Masthead */}
      <header className="max-w-2xl pt-10 sm:pt-12">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-ink-dim)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-good)]" />
          New York City · Live rankings
        </p>
        <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
          The NYC Food <span className="text-[var(--color-brand)]">Power Rankings</span>
        </h1>
        <p className="mt-4 text-lg text-[var(--color-ink-dim)]">
          Every great dish in the city, ranked head-to-head. Not best restaurants — best <em>ramen</em>,
          best <em>slice</em>, best <em>dumpling</em>. The food is the headline; the place is the subtitle.
        </p>
        <p className="mt-4 text-sm font-medium text-[var(--color-ink-dim)]">
          <span className="font-bold text-[var(--color-ink)]">{totalTypes}</span> food types ·{" "}
          <span className="font-bold text-[var(--color-ink)]">{totalRanked}</span> ranked dishes · every
          score out of 100
        </p>
      </header>

      {/* Featured covers */}
      <section className="pt-8">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">
          Featured · the two great debates
        </h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {featured.map((e, i) => (
            <RankingCard
              key={e.slug}
              entry={e}
              variant="cover"
              rows={10}
              tint={FEATURED_TINTS[i % FEATURED_TINTS.length]}
              hook={HOOKS[e.slug] ?? `The best ${e.name.toLowerCase()} in NYC, ranked.`}
            />
          ))}
        </div>
      </section>

      {/* How scoring works — taught once */}
      <section className="pt-10">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-5 py-6">
          <h2 className="text-lg font-black tracking-tight">How a ranking earns its order</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--color-ink-dim)]">
            No stars, no five-star inflation. Two dishes go head-to-head — &ldquo;which is better?&rdquo; —
            and winners climb. The 0–100 score is deliberately harsh: a 90 is rare air, a 50 is genuinely
            average. The dot shows how settled a rank is — Established, Rising, or still Provisional.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-[var(--color-ink-dim)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[var(--color-good)]" /> 75–100 · elite
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[var(--color-gold)]" /> 60–74 · very good
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[var(--color-border)]" /> below 60 · the pack
            </span>
          </div>
        </div>
      </section>

      {/* Rankings, bucketed by kind */}
      {buckets.map((bucket) => (
        <section key={bucket.id} className="pt-12">
          <h2 className="mb-1 text-2xl font-black tracking-tight sm:text-3xl">{bucket.label}</h2>
          <p className="mb-5 text-sm text-[var(--color-ink-dim)]">
            {bucket.entries.length} ranking{bucket.entries.length === 1 ? "" : "s"} · best dish first
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:items-start lg:grid-cols-3">
            {bucket.entries.map((e) => (
              <RankingCard key={e.slug} entry={e} variant="feed" rows={6} tint={tintFor(e)} />
            ))}
          </div>
        </section>
      ))}

      {/* Explore more → /nyc */}
      <section className="pt-14">
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-6 py-10 text-center">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">That&apos;s not all of New York.</h2>
          <p className="mx-auto mt-2 max-w-xl text-[var(--color-ink-dim)]">
            {totalTypes} food types and counting — each one an absolute, crowd-built ranking. Browse them
            all, or weigh in with a duel.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/nyc"
              className="rounded-lg bg-[var(--color-brand)] px-6 py-3 font-semibold text-white transition hover:bg-[var(--color-brand-soft)]"
            >
              Browse all rankings →
            </Link>
            <Link
              href="/duel"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 font-semibold transition hover:border-[var(--color-ink-dim)]"
            >
              Start a duel
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
