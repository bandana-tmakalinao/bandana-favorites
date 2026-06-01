/**
 * The single source of truth for ranking + trust tuning constants.
 *
 * Every other module consumes these — the ranking math lives in exactly one place
 * (src/lib/ranking.ts) and reads its knobs from here. See the build plan for the rationale
 * behind each value. All are safe to tune; `SHRINKAGE_M` is the most important.
 */
export const RANKING = {
  /**
   * Bayesian shrinkage prior strength (the "~200 ratings is worth a lot more" knob).
   * score = (v/(v+m))·R + (m/(v+m))·C, where C is the category midpoint (50).
   * m=40 → an item is ~83% its own score by ~200 weighted votes; "fast-ish but not flighty".
   */
  SHRINKAGE_M: Number(process.env.RANKING_SHRINKAGE_M ?? 6),

  /** Category prior the displayed score shrinks toward, on the public 0–100 scale. */
  CATEGORY_PRIOR_C: 50,

  /**
   * Harshness of the 0–100 curve. scoreRaw = 100·logistic(HARSHNESS · z), where z = (θ − category-mean θ)
   * / category-std θ. Normalizing by the category's spread makes the shape consistent regardless of how
   * compressed the BT strengths are: the AVERAGE spot ≈ 50, the elite approach ~100, weak spots sink low.
   * Higher = harsher/wider. 2.2 is genuinely punishing — only the clear greats break the 80s. Parameter #11.
   */
  HARSHNESS: 2.2,

  /** Tiny regularizing tie vs the baseline anchor added per contender — prevents BT divergence. */
  PRIOR_TIE_WEIGHT: 0.5,

  /** Bradley-Terry MM solver iterations (converges in ~5–15 at this scale). */
  BT_ITERATIONS: 40,

  /** Rating-deviation model: RD = RD_BASE / sqrt(1 + v/RD_Q). Lower RD = more confident. */
  RD_BASE: 350,
  RD_Q: 40,
  /** RD below this ⇒ "established"; above ⇒ "rising" (once past the provisional gate). */
  RD_ESTABLISHED: 110,

  /** Lower-confidence-bound penalty: sortKey = score − LCB_LAMBDA·(RD/RD_BASE)·100. */
  LCB_LAMBDA: 0.8,

  /** Eligibility gate to enter the visible top list (else shown in the "contenders" shelf). */
  MIN_WEIGHTED_VOTES: 3, // v_floor — low for the placeholder seed so lists aren't empty
  MIN_DISTINCT_OPPONENTS: 2,
} as const;

/**
 * Ranking v2 — source-weighted blend, start-at-zero, top-100 cap, risers. See
 * docs/architecture/ranking-v2.md. The public score is a weighted blend of three source classes,
 * each of which only exerts its share once it has real volume; an item with no evidence scores 0.
 */
export const SOURCE = {
  /** Target share of the blended score per class. Renormalized over whichever classes are active. */
  TARGET: { publication: 0.5, user: 0.25, power: 0.25 },
  /** Per-class activation half-volume: a_c = vol_c/(vol_c + M_c). Higher = slower to earn the share. */
  M: { publication: 1.5, user: 6, power: 3 },
  /** A user is "power" in a category at/above this category trust (curators always count as power). */
  POWER_USER_TRUST: 0.8,
  /** Only the top N per category are "ranked"; the rest are "unranked". */
  RANKED_CAP: 100,
  /**
   * Distinct real voters required for a user-created item (no publication backing) to be RANKED at all.
   * Below the bar it shows "Unranked" (no number). A ranking needs real corroboration — one person's
   * enthusiasm, even a curator dueling a new dish to the top, is not a community ranking. An item earns
   * a rank with EITHER ≥ `user` distinct voters OR ≥ `power` distinct power-users of that category
   * (power users count for more). Publication-backed (editorial) items bypass this entirely.
   */
  MIN_VOTERS: { user: 5, power: 2 },
  /** Min real (user+power) weighted evidence to leave "new" when there's no publication backing.
   *  ~one rating or one duel clears it → the item becomes "unranked" with a real blended score;
   *  zero evidence stays "new" at score 0. */
  MIN_EVIDENCE: 0.5,
  /** Riser window: weighted evidence in the last N days drives the "up & coming" shelf. */
  RISER_WINDOW_DAYS: 14,
} as const;

export type SourceClass = "publication" | "user" | "power";
export type Standing = "ranked" | "unranked" | "new";

/**
 * Publication quality registry — the editorial sources we trust, and how much. Drives the
 * publication-class volume (a contender backed by MICHELIN + Infatuation outweighs one on a single
 * lesser list) and is surfaced on the /admin publications panel. Match is case-insensitive substring,
 * so "MICHELIN Guide" and "The Infatuation NYC" resolve. Unlisted sources get DEFAULT_PUBLICATION_WEIGHT.
 */
export const PUBLICATIONS: ReadonlyArray<{ key: string; name: string; weight: number }> = [
  { key: "michelin", name: "MICHELIN", weight: 1.0 },
  { key: "infatuation", name: "The Infatuation", weight: 0.9 },
  { key: "eater", name: "Eater", weight: 0.85 },
  { key: "new york times", name: "New York Times", weight: 0.85 },
  { key: "nyt", name: "New York Times", weight: 0.85 },
  { key: "time out", name: "Time Out", weight: 0.75 },
  { key: "grub street", name: "Grub Street", weight: 0.7 },
  { key: "new york magazine", name: "New York Magazine", weight: 0.7 },
  { key: "one bite", name: "One Bite (Barstool)", weight: 0.65 },
  { key: "bon appetit", name: "Bon Appétit", weight: 0.7 },
  { key: "thrillist", name: "Thrillist", weight: 0.6 },
];
export const DEFAULT_PUBLICATION_WEIGHT = 0.5;

/** Resolve a free-text seed source to its publication weight (case-insensitive substring match). */
export function publicationWeight(source: string): number {
  const s = source.toLowerCase();
  for (const p of PUBLICATIONS) if (s.includes(p.key)) return p.weight;
  return DEFAULT_PUBLICATION_WEIGHT;
}

/** Resolve a free-text seed source to its canonical publication name (or the source itself). */
export function publicationName(source: string): string {
  const s = source.toLowerCase();
  for (const p of PUBLICATIONS) if (s.includes(p.key)) return p.name;
  return source;
}

export const TRUST = {
  /** Vote weight = W_MIN + (W_MAX − W_MIN)·trust^GAMMA. New users start near W_MIN. */
  W_MIN: 0.2,
  W_MAX: 3,
  GAMMA: 1.5,
  /** New-account starting trust (near-zero influence; earned upward). */
  NEW_USER_TRUST: 0.1,
  /**
   * Per-category trust cap for normal users. Keeps casual participation from dominating —
   * a maxed-out normal user lands at weight ≈ 1.84 (vs W_MAX 3.0 reserved for category experts).
   */
  NORMAL_CAP: 0.7,
  /**
   * Per-category trust cap for curator-designated community members ("category experts").
   * Lifts them to the full W_MAX weight — but ONLY in the category they were vouched for.
   * Curator-assigned, never self-declared.
   */
  EXPERT_CAP: 1.0,
  /**
   * Linear per-category trust earned per comparison, until the user's cap.
   * 0.01 ⇒ a new user (start 0.1) reaches the 0.7 normal cap after ~60 comparisons in that category.
   */
  GROWTH_PER_COMPARISON: 0.01,
} as const;

/**
 * Fuzzy name-matching thresholds (src/lib/match.ts). similarity ∈ [0,1].
 * - SNAP: auto-merge a typed name into an existing canonical one (keeps the dish vocabulary clean).
 * - SUGGEST: close enough to surface a "did you mean …?" without forcing it.
 * - PLACE_DUP: flag a suggested place as a likely duplicate of an existing one for the curator.
 */
export const MATCH = {
  SNAP: 0.88,
  SUGGEST: 0.6,
  PLACE_DUP: 0.8,
} as const;

/**
 * Food types hidden from discovery (home widget, /nyc hub, search, map, random duels) while we build
 * confidence in their ranking. Direct /nyc/<slug> links still resolve — this only removes them from
 * being surfaced. Add or remove slugs here to toggle a category's visibility.
 */
export const HIDDEN_SUBCATEGORIES: ReadonlySet<string> = new Set<string>([
  "dim-sum",
  "chopped-cheese",
  "black-and-white-cookie",
]);

export type ConfidenceTier = "provisional" | "rising" | "established";

/** Keyless OSM raster style for local dev. Production: set NEXT_PUBLIC_MAP_STYLE to a PMTiles/MapTiler URL. */
export const DEFAULT_MAP_STYLE_KEYLESS = "__keyless_osm_raster__";

export const NYC = {
  slug: "nyc",
  name: "New York City",
  center: { lat: 40.7281, lng: -73.9942 },
  // Five-borough bbox (matches the Overture ingestion query in docs/data-sourcing-research.md).
  bbox: { west: -74.26, south: 40.49, east: -73.7, north: 40.92 },
} as const;
