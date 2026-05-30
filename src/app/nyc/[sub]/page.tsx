import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import BrowseView from "@/components/BrowseView";
import AddPlace from "@/components/AddPlace";
import CategoryFavoriteBanner from "@/components/CategoryFavoriteBanner";
import CategoryOnboarding from "@/components/CategoryOnboarding";

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

  const user = await getCurrentUser();
  const personal = user ? getRepo().getPersonalRankedList(user.id, sub) : [];
  const { subcategory, category, region, ranked, contenders } = list;
  const dishNames = Array.from(new Set([...ranked, ...contenders].map((v) => v.title).filter(Boolean))).slice(0, 40);

  const favoriteId = user ? getRepo().getCategoryFavorite(user.id, sub) : null;
  let favoriteView = favoriteId ? ([...ranked, ...contenders].find((v) => v.id === favoriteId) ?? null) : null;
  if (favoriteId && !favoriteView) {
    const detail = getRepo().getContenderDetail(favoriteId);
    if (detail) favoriteView = detail.contender;
  }

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
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--color-brand-soft)]"
        >
          ⚔️ Rank these
        </Link>
      </div>

      <div className="mt-6">
        {favoriteView && (
          <CategoryFavoriteBanner sub={subcategory.slug} subName={subcategory.name} favorite={favoriteView} />
        )}
        {user && !favoriteId && (
          <CategoryOnboarding sub={subcategory.slug} subName={subcategory.name} top20={ranked.slice(0, 20)} />
        )}
        <BrowseView
          ranked={ranked}
          provisional={contenders}
          center={region.center}
          personal={personal}
          signedIn={!!user}
          subName={subcategory.name}
        />
      </div>

      <AddPlace subSlug={subcategory.slug} subName={subcategory.name} signedIn={!!user} dishNames={dishNames} />
    </div>
  );
}
