/**
 * Data-driven editorial blocks for category pages — every sentence here is computed from the
 * live ranking, never fabricated. (The one human-written piece, the intro paragraph, lives in
 * src/content/category-intros.ts.)
 */
import { publicationName } from "@/lib/config";
import type { ContenderView, RankedList } from "@/lib/types";

export interface NeighborhoodGroup {
  label: string; // "Williamsburg, Brooklyn"
  dishes: ContenderView[]; // top dishes there, rank order
}

/** Top neighborhoods by presence in the ranked top 25, each with its best 3 dishes. */
export function neighborhoodBreakdown(ranked: ContenderView[], maxHoods = 5): NeighborhoodGroup[] {
  const groups = new Map<string, ContenderView[]>();
  for (const v of ranked.slice(0, 25)) {
    const label = v.neighborhood
      ? v.borough && v.neighborhood !== v.borough
        ? `${v.neighborhood}, ${v.borough}`
        : v.neighborhood
      : v.borough;
    if (!label) continue;
    (groups.get(label) ?? groups.set(label, []).get(label)!).push(v);
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || (a[1][0].rank ?? 99) - (b[1][0].rank ?? 99))
    .slice(0, maxHoods)
    .map(([label, dishes]) => ({ label, dishes: dishes.slice(0, 3) }));
}

export interface PublicationCredit {
  name: string;
  dishCount: number;
}

/** Which 2025+ publications back this list's seed, by how many ranked dishes cite them. */
export function publicationCredits(list: RankedList): PublicationCredit[] {
  const counts = new Map<string, number>();
  for (const v of list.ranked) {
    const seen = new Set<string>();
    for (const src of v.seedSources) {
      const name = publicationName(src);
      if (seen.has(name)) continue;
      seen.add(name);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, dishCount]) => ({ name, dishCount }))
    .sort((a, b) => b.dishCount - a.dishCount);
}

export interface Faq {
  q: string;
  a: string;
}

/** 3–5 Q&As, every answer computed from the live list. Rendered visibly AND as FAQPage JSON-LD. */
export function buildFaq(list: RankedList): Faq[] {
  const name = list.subcategory.name;
  const lower = name.toLowerCase();
  const ranked = list.ranked;
  const faqs: Faq[] = [];

  const top = ranked[0];
  if (top) {
    const where = [top.placeName, top.neighborhood || top.borough].filter(Boolean).join(" in ");
    faqs.push({
      q: `What's the best ${lower} in NYC right now?`,
      a:
        `${top.title} at ${where} currently holds #1` +
        (top.comparisonCount > 0 ? `, after ${top.comparisonCount} head-to-head duels` : "") +
        `. The order moves as people keep dueling, so the live list above is always current.`,
    });
  }

  const hoods = neighborhoodBreakdown(ranked);
  if (hoods.length >= 2) {
    const [first, second] = hoods;
    faqs.push({
      q: `Which NYC neighborhood is best for ${lower}?`,
      a: `${first.label} leads with ${first.dishes.length === 1 ? "a top-25 pick" : `${first.dishes.length}+ of the top-ranked spots`}, including ${first.dishes[0].title} at ${first.dishes[0].placeName}. ${second.label} is the strongest challenger.`,
    });
  }

  faqs.push({
    q: "How is this ranking decided?",
    a: "Not star averages. Each list is seeded from 2025-or-newer editorial guides, then re-ordered by head-to-head duels — people pick which dish is better, and a trust-weighted comparison model (Bradley-Terry) computes the order. New entries stay provisional until enough independent votes corroborate them.",
  });

  const sources = publicationCredits(list);
  faqs.push({
    q: `How many ${lower} spots are ranked?`,
    a:
      `${ranked.length} ${lower} ${ranked.length === 1 ? "dish is" : "dishes are"} currently ranked` +
      (list.contenders.length > 0 ? `, with ${list.contenders.length} more still earning their spot` : "") +
      (sources.length > 0
        ? `. The seed draws on ${sources.length} publication${sources.length === 1 ? "" : "s"}, led by ${sources[0].name}.`
        : "."),
  });

  const contested = [...ranked].sort((a, b) => b.comparisonCount - a.comparisonCount)[0];
  if (contested && contested.comparisonCount >= 5) {
    faqs.push({
      q: `What's the most debated ${lower} on the list?`,
      a: `${contested.title} at ${contested.placeName} — it's been through ${contested.comparisonCount} duels, more than any other ${lower} here${contested.rank ? `, and currently sits at #${contested.rank}` : ""}.`,
    });
  }

  return faqs;
}
