import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { CATEGORY_INTROS } from "@/content/category-intros";
import { relatedRankings } from "@/content/related-rankings";
import { buildFaq, neighborhoodBreakdown, publicationCredits } from "@/lib/seo/categoryContent";
import { faqLd } from "@/lib/seo/jsonld";
import { dishPath } from "@/lib/links";
import { getRepo } from "@/db/repo";
import type { RankedList } from "@/lib/types";

/**
 * The crawlable editorial layer under a category's ranked list: curated intro, neighborhood
 * breakdown, FAQ (rendered visibly AND emitted as FAQPage JSON-LD from the same data, so the
 * markup can never drift from the page), publication credits, and cross-category links.
 * Server component inside an ISR page — all of this is in the cached HTML.
 */
export default function CategoryEditorial({ list }: { list: RankedList }) {
  const { subcategory } = list;
  const name = subcategory.name;
  const lower = name.toLowerCase();
  const intro = CATEGORY_INTROS[subcategory.slug];
  const hoods = neighborhoodBreakdown(list.ranked);
  const faqs = buildFaq(list);
  const credits = publicationCredits(list);
  const related = relatedRankings(subcategory.slug, getRepo().listCategories());

  return (
    <section className="mt-12 space-y-10 border-t border-[var(--color-border)] pt-8">
      {intro && (
        <div>
          <h2 className="mb-2 font-display text-xl">About this ranking</h2>
          <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--color-ink)]">{intro}</p>
        </div>
      )}

      {hoods.length >= 2 && (
        <div>
          <h2 className="mb-1 font-display text-xl">Best {lower} by neighborhood</h2>
          <p className="mb-4 text-sm text-[var(--color-ink-dim)]">
            Where the top-ranked {lower} actually clusters, from the live top 25.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {hoods.map((h) => (
              <div key={h.label} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <h3 className="font-bold">{h.label}</h3>
                <ul className="mt-2 space-y-1.5">
                  {h.dishes.map((v) => (
                    <li key={v.id} className="text-sm">
                      <Link href={dishPath(v)} className="font-medium hover:text-[var(--color-brand)] hover:underline">
                        {v.title}
                      </Link>{" "}
                      <span className="text-[var(--color-ink-dim)]">
                        · {v.placeName}
                        {v.rank ? ` · #${v.rank}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {faqs.length > 0 && (
        <div>
          <JsonLd data={faqLd(faqs)} />
          <h2 className="mb-4 font-display text-xl">
            {name} in NYC — common questions
          </h2>
          <div className="space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="max-w-2xl">
                <h3 className="font-bold">{f.q}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-dim)]">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {credits.length > 0 && (
        <p className="max-w-2xl text-xs text-[var(--color-ink-dim)]">
          <span className="text-[var(--color-gold)]">★</span> Seed informed by 2025+ best-of lists from{" "}
          {credits.map((c) => c.name).join(", ")} — the starting order only; head-to-head duels decide
          the real ranking.
        </p>
      )}

      {related.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-xl">Hungry for something else?</h2>
          <div className="flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/nyc/${r.slug}`}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-sm font-semibold transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
              >
                {r.emoji} Best {r.name} in NYC
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
