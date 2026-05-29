import Link from "next/link";
import { getRepo } from "@/db/repo";
import RotatingTopList from "@/components/RotatingTopList";

export const dynamic = "force-dynamic";

export default function Home() {
  const showcase = getRepo().getHomeShowcase(10);

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid items-start gap-10 py-12 sm:py-16 lg:grid-cols-2">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-ink-dim)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-good)]" />
            Now ranking — New York City
          </p>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            The best food in NYC,
            <br />
            ranked by the <span className="text-[var(--color-brand)]">food</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[var(--color-ink-dim)]">
            Not &ldquo;best restaurants.&rdquo; Best <em>ramen</em>. Best slice. Best soup dumpling. The
            dish is the headline; the place is the subtitle. Ranked by head-to-head comparisons and
            earned trust — never mass voting.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
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
        </div>

        <div className="lg:pt-2">
          <RotatingTopList entries={showcase} />
        </div>
      </section>

      <section className="grid gap-4 pb-20 sm:grid-cols-3">
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
      </section>
    </div>
  );
}
