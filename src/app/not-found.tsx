import Link from "next/link";
import SearchBar from "@/components/SearchBar";

/**
 * Custom 404 — a useful dead-end (search + evergreen rankings), not a shrug.
 * MUST stay repo-free: this page prerenders during `next build`, where the data store
 * doesn't exist (see the guard in getRepo()). Links are hardcoded evergreens.
 */
const POPULAR: { slug: string; name: string; emoji: string }[] = [
  { slug: "pizza", name: "Pizza", emoji: "🍕" },
  { slug: "ramen", name: "Ramen", emoji: "🍜" },
  { slug: "bagel", name: "Bagels", emoji: "🥯" },
  { slug: "tacos", name: "Tacos", emoji: "🌮" },
  { slug: "cheeseburger", name: "Burgers", emoji: "🍔" },
  { slug: "ice-cream", name: "Ice Cream", emoji: "🍦" },
];

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <p className="text-5xl">🍽️</p>
      <h1 className="mt-4 font-display text-3xl sm:text-4xl">This plate came back empty.</h1>
      <p className="mx-auto mt-3 max-w-md text-[var(--color-ink-dim)]">
        The page you&apos;re looking for doesn&apos;t exist (or got eaten). Try a search, or jump
        into one of the city&apos;s big rankings.
      </p>

      <div className="mx-auto mt-6 max-w-md">
        <SearchBar variant="hero" />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {POPULAR.map((p) => (
          <Link
            key={p.slug}
            href={`/nyc/${p.slug}`}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-sm font-semibold transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
          >
            {p.emoji} Best {p.name} in NYC
          </Link>
        ))}
      </div>

      <p className="mt-8 text-sm">
        <Link href="/nyc" className="font-semibold text-[var(--color-brand)] hover:underline">
          Browse every ranking →
        </Link>{" "}
        <span className="text-[var(--color-ink-dim)]">or</span>{" "}
        <Link href="/explore" className="font-semibold text-[var(--color-brand)] hover:underline">
          explore the Power Rankings →
        </Link>
      </p>
    </div>
  );
}
