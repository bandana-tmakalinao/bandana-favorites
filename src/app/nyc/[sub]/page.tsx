import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/db/repo";
import BrowseView from "@/components/BrowseView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const list = getRepo().getRankedList(sub);
  if (!list) return { title: "Not found · Bandana Favorites" };
  return { title: `Best ${list.subcategory.name} in NYC · Bandana Favorites` };
}

export default async function SubcategoryPage({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const list = getRepo().getRankedList(sub);
  if (!list) notFound();

  const { subcategory, category, region, ranked, contenders } = list;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 flex items-center gap-2 text-sm text-[var(--color-ink-dim)]">
        <Link href="/nyc" className="hover:text-[var(--color-ink)]">
          {category.emoji} {category.name}
        </Link>
        <span>/</span>
        <span>NYC</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            Best <span className="text-[var(--color-brand)]">{subcategory.name}</span> in NYC
          </h1>
          <p className="mt-1 max-w-xl text-[var(--color-ink-dim)]">{subcategory.blurb}</p>
          <p className="mt-1 text-xs text-[var(--color-ink-dim)]">
            {ranked.length} ranked{contenders.length > 0 ? ` · ${contenders.length} contenders` : ""} ·
            updated live from duels
          </p>
        </div>
        <Link
          href={`/duel?sub=${subcategory.slug}`}
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2 font-semibold text-black transition hover:bg-[var(--color-brand-soft)]"
        >
          ⚔️ Rank these
        </Link>
      </div>

      <div className="mt-6">
        <BrowseView ranked={ranked} provisional={contenders} center={region.center} />
      </div>
    </div>
  );
}
