import Link from "next/link";
import { getRepo } from "@/db/repo";
import { categoryGradient } from "@/lib/categoryTheme";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "NYC — browse by food",
  description:
    "Browse every crowd-ranked NYC food list: pizza, ramen, bagels, tacos and more — each an absolute ranking built from head-to-head duels.",
  alternates: { canonical: "/nyc" },
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
        <h1 className="font-display text-3xl sm:text-4xl">What are you craving?</h1>
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
                return (
                  <Link
                    key={s.id}
                    href={`/nyc/${s.slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_2px_12px_-8px_rgba(35,28,22,0.25)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--color-brand)] hover:shadow-[0_10px_28px_-12px_rgba(35,28,22,0.35)]"
                  >
                    {/* Emoji hero on the category's poster gradient — the art when there are no photos yet */}
                    <div
                      className="relative grid h-28 place-items-center overflow-hidden"
                      style={{ backgroundImage: categoryGradient(s.slug) }}
                    >
                      {s.topPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.topPhotoUrl} alt={s.name} className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <span className="text-5xl drop-shadow-md transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                          {s.emoji}
                        </span>
                      )}
                      <span className="absolute right-2 top-2 rounded-full bg-white/85 px-2 py-0.5 text-xs font-semibold text-[var(--color-ink)] backdrop-blur-sm">
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
