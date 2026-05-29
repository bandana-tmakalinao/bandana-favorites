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

  /** Evidence weight of an up/down thumb vs an explicit head-to-head duel (a thumb is weaker). */
  THUMB_WEIGHT: 0.4,

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

export const TRUST = {
  /** Vote weight = W_MIN + (W_MAX − W_MIN)·trust^GAMMA. New users start near W_MIN. */
  W_MIN: 0.2,
  W_MAX: 3,
  GAMMA: 1.5,
  /** New-account starting trust (near-zero influence; earned upward). */
  NEW_USER_TRUST: 0.1,
} as const;

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
