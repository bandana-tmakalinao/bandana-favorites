/**
 * The ranking engine — the ONE place the math lives.
 *
 * Model: a trust-weighted Bradley-Terry latent-strength score inferred from head-to-head
 * comparisons, solved with the standard MM (minorize-maximize) iteration against a FIXED
 * baseline anchor (which pins the scale and, via a tiny regularizing tie, keeps the solver from
 * diverging on all-win / all-loss items). Up/down votes are folded into the SAME model as
 * low-weight comparisons against that baseline — there is never a separate vote tally.
 *
 * The displayed 0–100 score then applies Bayesian shrinkage toward the category midpoint, so a
 * contender's score only becomes "worth a lot more" once it has accumulated real volume.
 *
 * Pure functions, no I/O — unit-tested in ranking.test.ts.
 */
import { RANKING, TRUST } from "./config";
import type { ID } from "./types";

const BASELINE: ID = "__baseline__";
const GAMMA_MIN = 1e-3;
const GAMMA_MAX = 1e3;

export interface RankInputDuel {
  winnerId: ID;
  loserId: ID;
  weight: number;
}
export interface RankInputVote {
  contenderId: ID;
  value: 1 | -1;
  weight: number;
}
export interface RankResult {
  theta: number;
  rd: number;
  weightedVotes: number;
  comparisonCount: number;
  distinctOpponents: number;
  score: number;
  sortKey: number;
  status: "provisional" | "active" | "hidden";
  rank: number | null;
}

/** Earned-trust → vote weight. New users sit near W_MIN; influence is convex in trust. */
export function trustToWeight(trustScore: number): number {
  const t = Math.max(0, Math.min(1, trustScore));
  return TRUST.W_MIN + (TRUST.W_MAX - TRUST.W_MIN) * Math.pow(t, TRUST.GAMMA);
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/**
 * Rank every contender in a single (subcategory × region) pool.
 * @param contenderIds all contenders in the pool
 * @param duels head-to-head comparisons among them (weight = rater trust at cast)
 * @param votes standing up/down votes (folded in as baseline-anchored comparisons)
 */
export function rankSubcategory(
  contenderIds: ID[],
  duels: RankInputDuel[],
  votes: RankInputVote[],
): Map<ID, RankResult> {
  const ids = new Set(contenderIds);
  const wins = new Map<ID, number>(); // W_i (weighted)
  const pair = new Map<ID, Map<ID, number>>(); // i → (j → weighted comparison count)
  const realEvidence = new Map<ID, number>(); // v_i: weight of real signals (excl. prior tie)
  const rawDuels = new Map<ID, number>(); // raw duel count
  const opponents = new Map<ID, Set<ID>>(); // distinct real contender opponents

  const gamma = new Map<ID, number>();
  for (const id of contenderIds) {
    wins.set(id, 0);
    pair.set(id, new Map());
    realEvidence.set(id, 0);
    rawDuels.set(id, 0);
    opponents.set(id, new Set());
    gamma.set(id, 1);
  }

  const bump = (m: Map<ID, number>, k: ID, d: number) => m.set(k, (m.get(k) ?? 0) + d);
  const bumpPair = (i: ID, j: ID, w: number) => {
    const pi = pair.get(i);
    if (pi) pi.set(j, (pi.get(j) ?? 0) + w);
  };
  /** Record winner-beats-loser with weight w into the aggregates used by the MM solver. */
  const addComparison = (winner: ID, loser: ID, w: number) => {
    if (winner !== BASELINE) bump(wins, winner, w);
    if (winner !== BASELINE) bumpPair(winner, loser, w);
    if (loser !== BASELINE) bumpPair(loser, winner, w);
  };

  // Real duels
  for (const d of duels) {
    if (!ids.has(d.winnerId) || !ids.has(d.loserId) || d.winnerId === d.loserId) continue;
    addComparison(d.winnerId, d.loserId, d.weight);
    bump(realEvidence, d.winnerId, d.weight);
    bump(realEvidence, d.loserId, d.weight);
    bump(rawDuels, d.winnerId, 1);
    bump(rawDuels, d.loserId, 1);
    opponents.get(d.winnerId)!.add(d.loserId);
    opponents.get(d.loserId)!.add(d.winnerId);
  }

  // Up/down votes → comparisons vs the baseline anchor, at reduced weight
  for (const v of votes) {
    if (!ids.has(v.contenderId)) continue;
    const w = v.weight * RANKING.THUMB_WEIGHT;
    if (v.value === 1) addComparison(v.contenderId, BASELINE, w);
    else addComparison(BASELINE, v.contenderId, w);
    bump(realEvidence, v.contenderId, w);
  }

  // Regularizing prior: a tiny tie vs the baseline for every contender (keeps θ finite + pulls
  // unsupported items toward the prior). Not counted as real evidence.
  const reg = RANKING.PRIOR_TIE_WEIGHT;
  for (const id of contenderIds) {
    addComparison(id, BASELINE, 0.5 * reg);
    addComparison(BASELINE, id, 0.5 * reg);
  }

  // MM iteration (Hunter 2004) with the baseline fixed at gamma=1 (no normalization needed).
  for (let it = 0; it < RANKING.BT_ITERATIONS; it++) {
    const next = new Map<ID, number>();
    for (const id of contenderIds) {
      let denom = 0;
      const gi = gamma.get(id)!;
      for (const [j, nij] of pair.get(id)!) {
        const gj = j === BASELINE ? 1 : (gamma.get(j) ?? 1);
        denom += nij / (gi + gj);
      }
      const w = wins.get(id)!;
      next.set(id, denom > 0 ? clamp(w / denom, GAMMA_MIN, GAMMA_MAX) : gi);
    }
    for (const [id, g] of next) gamma.set(id, g);
  }

  // θ per contender, centered on the category mean so an average item maps to ~50.
  const thetas = new Map<ID, number>();
  for (const id of contenderIds) thetas.set(id, Math.log(gamma.get(id)!));
  const meanTheta = contenderIds.length
    ? [...thetas.values()].reduce((a, b) => a + b, 0) / contenderIds.length
    : 0;
  const varTheta = contenderIds.length
    ? [...thetas.values()].reduce((s, t) => s + (t - meanTheta) ** 2, 0) / contenderIds.length
    : 0;
  const stdTheta = Math.sqrt(varTheta) || 1;

  // Derive display fields
  const results = new Map<ID, RankResult>();
  for (const id of contenderIds) {
    const theta = thetas.get(id)!;
    const v = realEvidence.get(id)!;
    const rd = RANKING.RD_BASE / Math.sqrt(1 + v / RANKING.RD_Q);
    // Harsh 0–100 curve, normalized by the category's spread: average ≈ 50, elite → ~100, weak → low.
    const z = (theta - meanTheta) / stdTheta;
    const scoreRaw = 100 / (1 + Math.exp(-RANKING.HARSHNESS * z));
    const m = RANKING.SHRINKAGE_M;
    const score = (v / (v + m)) * scoreRaw + (m / (v + m)) * RANKING.CATEGORY_PRIOR_C;
    const sortKey = score - RANKING.LCB_LAMBDA * (rd / RANKING.RD_BASE) * 100;
    const distinct = opponents.get(id)!.size;
    const eligible = v >= RANKING.MIN_WEIGHTED_VOTES && distinct >= RANKING.MIN_DISTINCT_OPPONENTS;
    results.set(id, {
      theta,
      rd,
      weightedVotes: v,
      comparisonCount: rawDuels.get(id)!,
      distinctOpponents: distinct,
      score: Math.round(score * 10) / 10,
      sortKey,
      status: eligible ? "active" : "provisional",
      rank: null,
    });
  }

  // Assign ranks among eligible contenders by descending lower-confidence-bound sort key.
  const active = [...results.entries()]
    .filter(([, r]) => r.status === "active")
    .sort((a, b) => b[1].sortKey - a[1].sortKey);
  active.forEach(([, r], i) => {
    r.rank = i + 1;
  });

  return results;
}
