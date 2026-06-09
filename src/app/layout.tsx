import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import { archivo, inter } from "./fonts";

export const metadata: Metadata = {
  // Absolute URLs for OG images & canonical links; falls back to localhost in dev.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Bandana Faves · the best food in NYC, ranked by the food",
  description:
    "Crowd-ranked best-of lists by food type. Best ramen in NYC. Best slice. Best dumpling. The food is the headline; the place is the subtitle.",
  openGraph: {
    siteName: "Bandana Faves",
    type: "website",
    images: [{ url: "/share/site/og/image?og=1", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${inter.variable}`}>
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
