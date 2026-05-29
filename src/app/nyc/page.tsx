import Link from "next/link";
import { getRepo } from "@/db/repo";
import { PhotoThumb } from "@/components/bits";

export const dynamic = "force-dynamic";

export const metadata = { title: "NYC — browse by food · Bandana Favorites" };

export default function NycPage() {
  const groups = getRepo().listCategories();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-black tracking-tight">What are you craving in NYC?</h1>
      <p className="mt-2 text-[var(--color-ink-dim)]">
        Pick a food type to see its absolute, crowd-ranked list. The dish is the headline; the place is
        the subtitle.
      </p>

      <div className="mt-8 space-y-10">
        {groups.map(({ category, subcategories }) => (
          <section key={category.id}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <span>{category.emoji}</span>
              {category.name}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {subcategories.map((s) => (
                <Link
                  key={s.id}
                  href={`/nyc/${s.slug}`}
                  className="group overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] transition hover:border-[var(--color-brand)]"
                >
                  <PhotoThumb url={s.topPhotoUrl} alt={s.name} className="h-28 w-full" />
                  <div className="p-3">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span>{s.emoji}</span>
                      <span className="truncate">{s.name}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--color-ink-dim)]">
                      {s.contenderCount} ranked
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
