/**
 * Idempotent dish-slug backfill — the slug twin of the seedScore backfill in pg.ts.
 *
 * Mints a URL slug for every contender that doesn't have one, unique per subcategory,
 * via the single mint helper (src/lib/slug.ts). Contenders that already carry a slug are
 * never touched (slugs are minted once, forever). Deterministic: candidates are minted in
 * (createdAt, id) order so collision suffixes land identically wherever this first runs.
 *
 * Called from: initPgStore (prod boot), getRepo() local boot, topUpSeed, scripts/topup_local.ts.
 * Returns the number of slugs minted; callers persist when > 0.
 */
import { mintDishSlug } from "@/lib/slug";
import type { StoreData } from "@/lib/types";

export function backfillDishSlugs(store: StoreData): number {
  const placeById = new Map(store.places.map((p) => [p.id, p]));

  // Taken-sets seeded from every slug that already exists, keyed by subcategory.
  const taken = new Map<string, Set<string>>();
  const takenFor = (subId: string): Set<string> => {
    let set = taken.get(subId);
    if (!set) {
      set = new Set();
      taken.set(subId, set);
    }
    return set;
  };
  for (const c of store.contenders) {
    if (c.slug) takenFor(c.subcategoryId).add(c.slug);
  }

  const missing = store.contenders
    .filter((c) => !c.slug)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  let minted = 0;
  for (const c of missing) {
    const placeName = placeById.get(c.placeId)?.name ?? "";
    c.slug = mintDishSlug(takenFor(c.subcategoryId), c.title, placeName, c.id);
    minted++;
  }
  return minted;
}
