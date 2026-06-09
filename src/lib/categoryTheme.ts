import { SHARE_CORAL, SHARE_GRADIENT } from "./shareTheme";

/**
 * Per-category color identity for the APP UI, derived from the share-poster gradients
 * (src/lib/shareTheme.ts) so the product and its posters always agree on what "pizza red" is.
 * The poster gradients are the single source of truth; everything here is parsed from them.
 */

/** The full poster gradient — hero bands, category covers, duel headers. */
export function categoryGradient(slug?: string): string {
  return (slug && SHARE_GRADIENT[slug]) || SHARE_CORAL;
}

const HEX = /#[0-9a-fA-F]{6}/g;

function stops(slug?: string): string[] {
  return categoryGradient(slug).match(HEX) ?? ["#f59568", "#ed7f54", "#d9551f"];
}

/** The category's headline color — the gradient's middle stop. */
export function categoryAccent(slug?: string): string {
  const s = stops(slug);
  return s[1] ?? s[0];
}

/** The darkest stop — text-safe on cream/white surfaces (chips, links, numerals). */
export function categoryDeep(slug?: string): string {
  const s = stops(slug);
  return s[s.length - 1];
}

/** A soft wash of the accent for light surfaces — tinted chips, hero underlays, hovers. */
export function categoryWash(slug?: string, pct = 12): string {
  return `color-mix(in srgb, ${categoryAccent(slug)} ${pct}%, white)`;
}
