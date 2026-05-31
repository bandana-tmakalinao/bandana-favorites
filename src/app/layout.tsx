import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Bandana Faves · the best food in NYC, ranked by the food",
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
          <SiteHeader />
          <div className="border-b border-[var(--color-border)] bg-[var(--color-banner)] px-4 py-1.5 text-center text-xs font-medium text-[var(--color-ink)]">
            ⭐ Every list is seeded from NYC&apos;s 2025+ best-of guides. Rankings move as people duel &amp; rate. Photos are coming (user-uploaded).
          </div>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[var(--color-border)] px-4 py-6 text-center text-xs text-[var(--color-ink-dim)]">
            Bandana Faves · ranked by comparisons & earned trust, not mass voting · NYC
          </footer>
        </div>
      </body>
    </html>
  );
}
