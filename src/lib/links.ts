/**
 * Canonical in-app paths. Every dish link goes through dishPath so the URL shape
 * (/nyc/[sub]/[dishSlug] — the SEO-facing identity) lives in exactly one place.
 */

/** Path to a dish page. `slug` falls back to the contender id upstream (toView), so this never 404s. */
export function dishPath(v: { subSlug: string; slug: string }): string {
  return `/nyc/${v.subSlug}/${v.slug}`;
}

/** Path to a category ranking page. */
export function categoryPath(subSlug: string): string {
  return `/nyc/${subSlug}`;
}
