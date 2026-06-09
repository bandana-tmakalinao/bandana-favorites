import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import BrowseView from "@/components/BrowseView";
import ShareButton from "@/components/ShareButton";
import { categoryGradient } from "@/lib/categoryTheme";
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
          sub={subcategory.slug}
          meHandle={user?.handle}
          meName={user?.name}
        />
      </div>

      <AddPlace subSlug={subcategory.slug} subName={subcategory.name} signedIn={!!user} dishNames={dishNames} />
    </div>
  );
}
