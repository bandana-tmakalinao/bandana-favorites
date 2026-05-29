import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import SearchBar from "@/components/SearchBar";

export const metadata: Metadata = {
  title: "Bandana Favorites — the best food in NYC, ranked by the food",
  description:
    "Crowd-ranked best-of lists by food type. Best ramen in NYC. Best slice. Best dumpling. The food is the headline; the place is the subtitle.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-brand)] text-sm font-black text-white">
                  B
                </span>
                <span className="tracking-tight">
                  Bandana <span className="text-[var(--color-brand)]">Favorites</span>
                </span>
              </Link>
              <span className="ml-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-ink-dim)]">
                NYC
              </span>
              <div className="mx-2 hidden flex-1 justify-center sm:flex">
                <SearchBar variant="header" />
              </div>
              <div className="ml-auto flex items-center gap-4 text-sm text-[var(--color-ink-dim)] sm:ml-0">
                <Link
                  href="/add"
                  className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 font-semibold text-white transition hover:bg-[var(--color-brand-soft)]"
                >
                  ＋ Add
                </Link>
                <Link href="/map" className="hover:text-[var(--color-ink)]">
                  Map
                </Link>
                <Link href="/duel" className="hover:text-[var(--color-ink)]">
                  Duel
                </Link>
                <Link href="/review" className="hidden hover:text-[var(--color-ink)] sm:inline">
                  Review
                </Link>
                <Link href="/me" className="hover:text-[var(--color-ink)]">
                  Sign in
                </Link>
              </div>
            </div>
          </header>
          <div className="border-b border-[var(--color-border)] bg-[var(--color-banner)] px-4 py-1.5 text-center text-xs font-medium text-[var(--color-ink)]">
            ⭐ Every list is seeded from NYC&apos;s 2025+ best-of guides — rankings move as people duel &amp; rate. Photos are coming (user-uploaded).
          </div>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[var(--color-border)] px-4 py-6 text-center text-xs text-[var(--color-ink-dim)]">
            Bandana Favorites · ranked by comparisons & earned trust, not mass voting · NYC
          </footer>
        </div>
      </body>
    </html>
  );
}
