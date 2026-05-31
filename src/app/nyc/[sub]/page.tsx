import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import BrowseView from "@/components/BrowseView";
import ShareButton from "@/components/ShareButton";
import AddPlace from "@/components/AddPlace";
import CategoryFavoriteBanner from "@/components/CategoryFavoriteBanner";
import CategoryOnboarding from "@/components/CategoryOnboarding";
import CategoryAlsoTried from "@/components/CategoryAlsoTried";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const list = getRepo().getRankedList(sub);
  if (!list) return { title: "Not found · Bandana Faves" };
  return { title: `Best ${list.subcategory.name} in NYC · Bandana Faves` };
}

export default async function SubcategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ sub: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { sub } = await params;
  const { welcome } = await searchParams;
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
        <div className="flex items-center gap-2">
          {ranked.length > 0 && (
            <ShareButton
              kind="category"
              id={subcategory.slug}
              title={`Best ${subcategory.name} in NYC`}
              pageHref={`/nyc/${subcategory.slug}`}
              variant="ghost"
            />
          )}
          <Link
            href={`/duel?sub=${subcategory.slug}`}
            className="rounded-lg bg-[var(--color-brand)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--color-brand-soft)]"
          >
            ⚔️ Rank these
          </Link>
        </div>
      </div>

      <div className="mt-6">
        {!user && (
          <div className="mb-4 flex items-center gap-4 rounded-xl border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/5 p-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/15 text-2xl">
              🍴
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Rank your favorite {subcategory.name.toLowerCase()}</p>
              <p className="text-sm text-[var(--color-ink-dim)]">
                Sign in or create an account to set your favorite and add the spots you&apos;ve tried.
              </p>
            </div>
            <Link
              href={`/me?returnTo=${encodeURIComponent(`/nyc/${subcategory.slug}`)}`}
              className="shrink-0 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-soft)]"
            >
              Sign in →
            </Link>
          </div>
        )}
        {favoriteView && (
          <CategoryFavoriteBanner sub={subcategory.slug} subName={subcategory.name} favorite={favoriteView} />
        )}
        {user && favoriteId && welcome && (
          <CategoryAlsoTried
            sub={subcategory.slug}
            subName={subcategory.name}
            favoriteId={favoriteId}
            others={ranked.filter((v) => v.id !== favoriteId).slice(0, 20)}
          />
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
