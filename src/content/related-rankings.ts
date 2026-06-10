import { HIDDEN_SUBCATEGORIES } from "@/lib/config";
import type { CategoryWithSubs } from "@/db/repo";

/**
 * Cross-category internal linking ("Hungry for something else?"). A curated adjacency map
 * (what a reader of X plausibly also craves) topped up with same-kind categories to 5 links.
 * This is the site's main cross-silo link equity path — every ranking links 5 others.
 */
const RELATED: Record<string, string[]> = {
  pizza: ["cheeseburger", "pastrami", "bagel", "hot-dog"],
  bagel: ["bacon-egg-cheese", "pastrami", "black-and-white-cookie"],
  "black-and-white-cookie": ["cheesecake", "cannoli", "bagel"],
  pastrami: ["bagel", "hot-dog", "chopped-cheese", "pizza"],
  "chopped-cheese": ["bacon-egg-cheese", "cheeseburger", "halal-cart"],
  "bacon-egg-cheese": ["bagel", "chopped-cheese", "hot-dog"],
  ramen: ["pho", "soup-dumplings", "korean-fried-chicken"],
  "soup-dumplings": ["dim-sum", "ramen", "dosa"],
  "dim-sum": ["soup-dumplings", "pho", "dosa"],
  tacos: ["halal-cart", "korean-fried-chicken", "cheeseburger"],
  "korean-fried-chicken": ["ramen", "tacos", "hot-dog"],
  pho: ["ramen", "dim-sum", "dosa"],
  dosa: ["dim-sum", "pho", "halal-cart"],
  cheeseburger: ["pizza", "steak", "hot-dog", "chopped-cheese"],
  steak: ["cheeseburger", "lobster-roll", "pastrami"],
  "lobster-roll": ["steak", "tacos", "hot-dog"],
  "halal-cart": ["tacos", "chopped-cheese", "dosa"],
  "hot-dog": ["cheeseburger", "pastrami", "pizza"],
  cheesecake: ["cannoli", "ice-cream", "black-and-white-cookie"],
  cannoli: ["cheesecake", "ice-cream", "black-and-white-cookie"],
  "ice-cream": ["cheesecake", "cannoli", "black-and-white-cookie"],
};

export interface RelatedLink {
  slug: string;
  name: string;
  emoji: string;
}

/** Up to 5 related rankings for a category page — curated first, same-kind fill, hidden excluded. */
export function relatedRankings(slug: string, groups: CategoryWithSubs[], max = 5): RelatedLink[] {
  const bySlug = new Map<string, { name: string; emoji: string; kind: string }>();
  for (const g of groups) {
    for (const s of g.subcategories) {
      bySlug.set(s.slug, { name: s.name, emoji: s.emoji, kind: g.category.kind });
    }
  }
  const self = bySlug.get(slug);
  const picked: string[] = [];
  const add = (s: string) => {
    if (s !== slug && !picked.includes(s) && bySlug.has(s) && !HIDDEN_SUBCATEGORIES.has(s)) picked.push(s);
  };
  for (const s of RELATED[slug] ?? []) add(s);
  if (self) {
    for (const [s, meta] of bySlug) {
      if (picked.length >= max) break;
      if (meta.kind === self.kind) add(s);
    }
  }
  for (const s of bySlug.keys()) {
    if (picked.length >= max) break;
    add(s);
  }
  return picked.slice(0, max).map((s) => ({ slug: s, name: bySlug.get(s)!.name, emoji: bySlug.get(s)!.emoji }));
}
