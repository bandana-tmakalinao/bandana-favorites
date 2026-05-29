/**
 * Fuzzy name matching + dedupe engine.
 *
 * One place for "are these two names the same thing?" — used to (a) snap a typed dish name to an
 * existing canonical one so the vocabulary stays clean, and (b) flag likely-duplicate place
 * suggestions for a curator. Pure functions, no I/O, fully unit-tested.
 *
 * The key idea for dish names: strip the *category* word ("ramen", "pizza", "pie") before comparing,
 * so the distinctive part ("tonkotsu", "margherita") drives the match — otherwise every dish in a
 * category shares a token and everything looks similar.
 */

import { MATCH } from "./config";

/** Lowercase, strip accents + punctuation, collapse whitespace. The canonical comparison form. */
export function normalizeName(s: string): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // combining accents
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['‘’]/g, "") // straight + curly apostrophes: don't split contractions
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Generic food words that carry no distinguishing signal within a category. */
const GENERIC_TOKENS = new Set([
  "the", "a", "an", "of", "with", "and", "style", "classic", "original", "house",
  "special", "signature", "fresh", "homemade", "pie", "bowl", "plate", "sandwich",
]);

/**
 * Distinctive tokens of a name: normalized tokens minus generic words and the supplied
 * category/stop words. e.g. tokens("Tonkotsu Ramen", ["ramen"]) -> ["tonkotsu"].
 */
export function distinctiveTokens(s: string, stop: string[] = []): string[] {
  const stopSet = new Set(stop.flatMap((w) => normalizeName(w).split(" ")).filter(Boolean));
  return normalizeName(s)
    .split(" ")
    .filter((t) => t.length > 1 && !GENERIC_TOKENS.has(t) && !stopSet.has(t));
}

/** Classic Levenshtein edit distance. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let cur = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Edit-distance similarity in [0,1] over normalized strings. */
function editRatio(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na && !nb) return 1;
  const max = Math.max(na.length, nb.length);
  return max === 0 ? 0 : 1 - levenshtein(na, nb) / max;
}

/**
 * Similarity of two names in [0,1]. `stop` removes category words so distinctive parts dominate.
 * Blends distinctive-token overlap (Jaccard + containment) with whole-string edit distance, and
 * guards against a single shared generic token producing a false match.
 */
export function similarity(a: string, b: string, stop: string[] = []): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb && na.length > 0) return 1;

  const dta = distinctiveTokens(a, stop);
  const dtb = distinctiveTokens(b, stop);
  const ta = new Set(dta);
  const tb = new Set(dtb);

  // No distinctive tokens on either side (e.g. both were just the category word): fall back to whole-string edit.
  if (ta.size === 0 || tb.size === 0) return editRatio(a, b);

  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  const jaccard = union === 0 ? 0 : inter / union;
  const containment = inter / Math.min(ta.size, tb.size); // subset match ("tonkotsu" ⊂ "tonkotsu ramen")
  const tokenScore = Math.max(jaccard, 0.92 * containment);

  // Edit distance over ONLY the distinctive parts (sorted for order-independence) — catches typos in
  // the meaningful word ("margarita" ≈ "margherita") without the category word diluting the ratio.
  const da = [...ta].sort().join(" ");
  const db = [...tb].sort().join(" ");
  const editDistinctive = editRatio(da, db);

  return Math.max(tokenScore, editDistinctive);
}

export interface MatchHit<T> {
  value: T;
  name: string;
  score: number;
}

/** Best candidate by similarity to `input`. `nameOf` extracts the comparable name from each candidate. */
export function bestMatch<T>(
  input: string,
  candidates: T[],
  nameOf: (c: T) => string,
  stop: string[] = [],
): MatchHit<T> | null {
  let best: MatchHit<T> | null = null;
  for (const c of candidates) {
    const name = nameOf(c);
    const score = similarity(input, name, stop);
    if (!best || score > best.score) best = { value: c, name, score };
  }
  return best;
}

export interface DishResolution {
  /** The name to actually store: an existing canonical name when matched, else the cleaned input. */
  name: string;
  /** "snap": auto-merged into an existing name. "suggest": close, surface a "did you mean". "new": unique. */
  decision: "snap" | "suggest" | "new";
  /** The closest existing canonical name, when decision is "snap" or "suggest". */
  suggestion: string | null;
  score: number;
}

/**
 * Resolve a typed dish name against a category's existing canonical names.
 * - score ≥ SNAP  → return the existing name (dedupe).
 * - score ≥ SUGGEST → keep the input but offer the close existing name.
 * - otherwise        → it's a new dish.
 * `categoryName` is stripped as a stop word so "tonkotsu" matches "Tonkotsu Ramen".
 */
export function resolveDishName(
  input: string,
  existing: string[],
  categoryName = "",
): DishResolution {
  const cleaned = (input ?? "").trim().replace(/\s+/g, " ");
  if (!cleaned) return { name: cleaned, decision: "new", suggestion: null, score: 0 };

  const stop = categoryName ? [categoryName] : [];
  const hit = bestMatch(cleaned, existing, (s) => s, stop);
  if (!hit) return { name: cleaned, decision: "new", suggestion: null, score: 0 };

  if (hit.score >= MATCH.SNAP) {
    return { name: hit.value, decision: "snap", suggestion: hit.value, score: hit.score };
  }
  if (hit.score >= MATCH.SUGGEST) {
    return { name: cleaned, decision: "suggest", suggestion: hit.value, score: hit.score };
  }
  return { name: cleaned, decision: "new", suggestion: null, score: hit.score };
}
