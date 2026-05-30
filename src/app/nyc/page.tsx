import Link from "next/link";
import { getRepo } from "@/db/repo";

export const dynamic = "force-dynamic";

export const metadata = { title: "NYC — browse by food · Bandana Favorites" };

// A warm tint per category kind, so the grid reads as a vibrant menu even before photos exist.
const KIND_TINT: Record<string, string> = {
  cuisine: "from-[#fde7dc] to-[#fbd9c6]", // coral cream
  format: "from-[#fdf0cf] to-[#f8e3a6]", // gold cream
  dessert: "from-[#fce4ec] to-[#f7cdd9]", // rose
  drink: "from-[#e3f0ea] to-[#c9e4d8]", // sage
};

export default function NycPage() {
  const groups = getRepo().listCategories();
  const totalSubs = groups.reduce((n, g) => n + g.subcategories.length, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="max-w-2xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-brand)]">
          Browse New York City
        </p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">What are you craving?</h1>
        <p className="mt-3 text-[var(--color-ink-dim)]">
          Pick a food type to see its absolute, crowd-ranked list. The dish is the headline; the place is
          the subtitle. {totalSubs} rankings and counting.
        </p>
      </header>

      <div className="mt-10 space-y-12">
        {groups.map(({ category, subcategories }) => (
          <section key={category.id}>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black tracking-tight">
              <span className="text-xl">{category.emoji}</span>
              {category.name}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {subcategories.map((s) => {
                const tint = KIND_TINT[category.kind] ?? KIND_TINT.cuisine;
                return (
                  <Link
                    key={s.id}
                    href={`/nyc/${s.slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_2px_12px_-8px_rgba(35,28,22,0.25)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--color-brand)] hover:shadow-[0_10px_28px_-12px_rgba(35,28,22,0.35)]"
                  >
                    {/* Emoji hero on a warm gradient — the art when there are no photos yet */}
                    <div className={`relative grid h-28 place-items-center bg-gradient-to-br ${tint}`}>
                      {s.topPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.topPhotoUrl} alt={s.name} className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <span className="text-5xl drop-shadow-sm transition-transform duration-200 group-hover:scale-110">
                          {s.emoji}
                        </span>
                      )}
                      <span className="absolute right-2 top-2 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-[var(--color-ink)] backdrop-blur-sm">
                        {s.contenderCount} ranked
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <span className="truncate font-bold tracking-tight group-hover:text-[var(--color-brand)]">
                        {s.name}
                      </span>
                      {s.topTitle ? (
                        <span className="mt-1 truncate text-xs text-[var(--color-ink-dim)]">
                          <span className="font-semibold text-[var(--color-ink)]">#1</span> {s.topTitle}
                          {s.topPlaceName ? ` · ${s.topPlaceName}` : ""}
                        </span>
                      ) : (
                        <span className="mt-1 text-xs text-[var(--color-ink-dim)]">Be the first to rank it</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
