import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import JsonLd from "@/components/JsonLd";
import SiteHeader from "@/components/SiteHeader";
import { organizationLd, webSiteLd } from "@/lib/seo/jsonld";
import { archivo, inter } from "./fonts";

export const metadata: Metadata = {
  // Absolute URLs for OG images & canonical links; falls back to localhost in dev.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Bandana Faves · the best food in NYC, ranked by the food",
    // Every page title gets the brand suffix from here — pages set just their own part.
    template: "%s · Bandana Faves",
  },
  description:
    "Crowd-ranked best-of lists by food type. Best ramen in NYC. Best slice. Best dumpling. The food is the headline; the place is the subtitle.",
  openGraph: {
    siteName: "Bandana Faves",
    type: "website",
    images: [{ url: "/share/site/og/image?og=1", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

// Footer interlinking — static evergreen routes only (the layout must stay repo-free so it can
// render at build time for static pages like the 404).
const FOOTER_RANKINGS: { slug: string; name: string }[] = [
  { slug: "pizza", name: "Pizza" },
  { slug: "ramen", name: "Ramen" },
  { slug: "bagel", name: "Bagels" },
  { slug: "cheeseburger", name: "Burgers" },
  { slug: "tacos", name: "Tacos" },
  { slug: "pastrami", name: "Pastrami" },
  { slug: "soup-dumplings", name: "Soup Dumplings" },
  { slug: "ice-cream", name: "Ice Cream" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: browser extensions inject attributes onto <html> (seen live:
    // style="--ro-scrollbar-height") before React hydrates, tripping a false mismatch warning.
    // Scope: this one element's attributes only — child-tree mismatches still surface.
    <html lang="en" className={`${archivo.variable} ${inter.variable}`} suppressHydrationWarning>
      <body>
        <JsonLd data={webSiteLd()} />
        <JsonLd data={organizationLd()} />
        <div className="min-h-screen flex flex-col">
          <SiteHeader />
          <div className="border-b border-[var(--color-border)] bg-[var(--color-banner)] px-4 py-1.5 text-center text-xs font-medium text-[var(--color-ink)]">
            ⭐ Every list is seeded from NYC&apos;s 2025+ best-of guides. Rankings move as people duel &amp; rate. Photos are coming (user-uploaded).
          </div>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[var(--color-border)] px-4 py-8 text-xs text-[var(--color-ink-dim)]">
            <div className="mx-auto max-w-5xl">
              <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2" aria-label="Popular rankings">
                {FOOTER_RANKINGS.map((r) => (
                  <Link key={r.slug} href={`/nyc/${r.slug}`} className="hover:text-[var(--color-ink)]">
                    Best {r.name} in NYC
                  </Link>
                ))}
              </nav>
              <nav className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2" aria-label="Site">
                <Link href="/nyc" className="font-semibold hover:text-[var(--color-ink)]">
                  All rankings
                </Link>
                <Link href="/explore" className="font-semibold hover:text-[var(--color-ink)]">
                  Explore
                </Link>
                <Link href="/map" className="font-semibold hover:text-[var(--color-ink)]">
                  Map
                </Link>
                <Link href="/discover" className="font-semibold hover:text-[var(--color-ink)]">
                  Discover
                </Link>
              </nav>
              <p className="mt-4 text-center">
                Bandana Faves · ranked by comparisons &amp; earned trust, not mass voting · NYC
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
