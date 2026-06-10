/**
 * URL slugs for dishes — the SEO-facing identity of a contender.
 *
 * Invariants (load-bearing — see docs/architecture and the SEO overhaul plan):
 * - A slug is minted exactly ONCE, when the contender has none, and is never recomputed.
 *   Title or place renames must not change a published URL.
 * - Uniqueness is scoped PER SUBCATEGORY: the URL namespace is /nyc/[sub]/[dishSlug].
 * - Minting is the only dedupe layer (no DB unique constraint) — always mint through
 *   mintDishSlug with the subcategory's taken-set.
 */
import { normalizeName } from "./match";

const MAX_LEN = 80;

/** Kebab-case URL form of a name: normalize (accents/punctuation), hyphenate, cap length. */
export function slugify(s: string): string {
  let out = normalizeName(s).replace(/ /g, "-");
  if (out.length > MAX_LEN) {
    const cut = out.slice(0, MAX_LEN);
    const atHyphen = cut.lastIndexOf("-");
    out = atHyphen > 40 ? cut.slice(0, atHyphen) : cut; // prefer a clean word boundary
  }
  return out.replace(/^-+|-+$/g, "");
}

/** The natural slug for a dish: title + place ("Three-Cheese Pie" at "Lucali" → three-cheese-pie-lucali). */
export function dishSlugBase(title: string, placeName: string): string {
  return slugify(`${title} ${placeName}`);
}

/**
 * Mint a unique dish slug within a subcategory. `taken` is that subcategory's set of
 * existing slugs; the minted slug is added to it before returning.
 * Collisions get -2, -3, …; an empty base falls back to dish-<id prefix>.
 */
export function mintDishSlug(taken: Set<string>, title: string, placeName: string, id: string): string {
  let base = dishSlugBase(title, placeName);
  if (!base) base = `dish-${id.slice(0, 8)}`;
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  taken.add(slug);
  return slug;
}
