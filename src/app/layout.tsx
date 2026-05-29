import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

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
                <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-brand)] text-sm font-black text-black">
                  B
                </span>
                <span className="tracking-tight">
                  Bandana <span className="text-[var(--color-brand)]">Favorites</span>
                </span>
              </Link>
              <span className="ml-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-ink-dim)]">
                NYC
              </span>
              <div className="ml-auto flex items-center gap-4 text-sm text-[var(--color-ink-dim)]">
                <Link href="/duel" className="hover:text-[var(--color-ink)]">
                  Duel
                </Link>
                <Link href="/me" className="hover:text-[var(--color-ink)]">
                  Sign in
                </Link>
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[var(--color-border)] px-4 py-6 text-center text-xs text-[var(--color-ink-dim)]">
            Bandana Favorites · ranked by comparisons & earned trust, not mass voting · NYC
          </footer>
        </div>
      </body>
    </html>
  );
}
