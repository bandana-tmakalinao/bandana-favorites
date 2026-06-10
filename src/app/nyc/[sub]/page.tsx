import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/db/repo";
import CategoryClient from "@/components/CategoryClient";
import ShareButton from "@/components/ShareButton";
import { categoryGradient } from "@/lib/categoryTheme";

// ISR: the ranked list is a public, cacheable shell (5 min); everything viewer-specific hydrates
// via CategoryClient. generateStaticParams() => [] keeps this page OUT of `next build` (the data
// store only exists at runtime — see the guard in getRepo()).
export const revalidate = 300;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const list = getRepo().getRankedList(sub);
  if (!list) return { title: "Not found" };
  const title = `Best ${list.subcategory.name} in NYC`;
  const top = list.ranked[0];
  const description = top
    ? `${list.ranked.length} ${list.subcategory.name.toLowerCase()} ranked head-to-head. #1 right now: ${top.title} at ${top.placeName}.`
    : `The best ${list.subcategory.name.toLowerCase()} in NYC, ranked head-to-head.`;
  return {
    title,
    description,
    alternates: { canonical: `/nyc/${sub}` },
    openGraph: {
      title,
      description,
      images: [{ url: `/share/category/${sub}/image?og=1`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image" as const },
  };
}

export default async function SubcategoryPage({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const list = getRepo().getRankedList(sub);
  if (!list) notFound();

  const { subcategory, category, region, ranked, contenders } = list;
  const dishNames = Array.from(new Set([...ranked, ...contenders].map((v) => v.title).filter(Boolean))).slice(0, 40);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Poster hero — the category's share-image gradient, so the page IS the poster */}
      <header
        className="relative overflow-hidden rounded-3xl px-5 py-6 text-white shadow-[0_14px_40px_-18px_rgba(35,28,22,0.55)] sm:px-7 sm:py-8"
        style={{ backgroundImage: categoryGradient(subcategory.slug) }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-8 -right-4 select-none text-[9rem] opacity-20"
        >
          {subcategory.emoji || category.emoji}
        </span>
        <div className="relative">
          <nav className="flex items-center gap-2 text-xs font-medium text-white/75">
            <Link href="/nyc" className="hover:text-white">
              {category.emoji} {category.name}
            </Link>
            <span>/</span>
            <span>NYC</span>
          </nav>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
            Best in NYC · ranked by duels
          </p>
          <h1 className="font-display text-4xl drop-shadow-sm sm:text-5xl">{subcategory.name}</h1>
          <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">{subcategory.blurb}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur-sm">
              {ranked.length} ranked
            </span>
            {contenders.length > 0 && (
              <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur-sm">
                {contenders.length} contenders
              </span>
            )}
            <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur-sm">
              updated live from duels
            </span>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Link
              href={`/duel?sub=${subcategory.slug}`}
              className="rounded-xl bg-white px-4 py-2 font-semibold text-ink shadow-sm transition hover:bg-white/90"
            >
              ⚔️ Rank these
            </Link>
            {ranked.length > 0 && (
              <ShareButton
                kind="category"
                id={subcategory.slug}
                title={`Best ${subcategory.name} in NYC`}
                pageHref={`/nyc/${subcategory.slug}`}
                variant="hero"
              />
            )}
            <Link
              href={`/duel?sub=${subcategory.slug}&mode=open`}
              className="text-xs font-medium text-white/80 hover:text-white"
            >
              or open duel →
            </Link>
          </div>
        </div>
      </header>

      <div className="mt-6">
        <CategoryClient
          sub={subcategory.slug}
          subName={subcategory.name}
          ranked={ranked}
          provisional={contenders}
          center={region.center}
          dishNames={dishNames}
        />
      </div>
    </div>
  );
}
