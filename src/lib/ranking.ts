/**
 * The ranking engine — the ONE place the math lives. (Ranking v2: source-weighted blend.)
 *
 * The public 0–100 score is a weighted blend of THREE source classes — publications (50%), users
 * (25%), and power users (25%) — each of which only exerts its share once it has real volume, and
 * each renormalized over whichever classes are actually present. An item with no evidence scores 0
 * ("new"); a seeded item shows its editorial (publication) order immediately; user + power-user
 * duels/votes blend in their shares as they accrue.
 *
 * Per class, quality is a trust-weighted Bradley-Terry latent strength (MM solver against a FIXED
 * baseline anchor, with up/down ratings folded in as low-weight baseline comparisons), pushed
 * through a harsh category-z logistic. Standing (ranked / unranked / new) and risers are derived on
 * top. See docs/architecture/ranking-v2.md. Pure functions, no I/O — unit-tested in ranking.test.ts.
 */
import { RANKING, SOURCE, TRUST, type Standing } from "./config";
import type { ID } from "./types";

const BASELINE: ID = "__baseline__";
const GAMMA_MIN = 1e-3;
const GAMMA_MAX = 1e3;

export type EvidenceClass = "user" | "power";

export interface RankInputContender {
  id: ID;
  /** Publication-class quality 0–100 (editorial seed consensus); 0/undefined if user-created. */
  seedScore?: number;
  /** Publication-class volume = Σ publication weights backing it (0 if none). */
  pubVolume?: number;
}
export interface RankInputDuel {
  winnerId: ID;
  loserId: ID;
  weight: number;
  cls: EvidenceClass;
  at?: number; // epoch ms — for riser velocity
}
export interface RankInputVote {
  contenderId: ID;
  rating: number; // 0–100 (50 = neutral)
  weight: number;
  cls: EvidenceClass;
  at?: number;
}
export interface RankResult {
  theta: number;
  rd: number;
  weightedVotes: number; // total real (user+power) evidence
  comparisonCount: number;
  distinctOpponents: number;
  score: number; // blended 0–100 (0 when "new")
  sortKey: number;
  status: "provisional" | "active" | "hidden";
  rank: number | null;
  standing: Standing;
  riserScore: number;
}

/** Earned-trust → vote weight. New users sit near W_MIN; influence is convex in trust. */
export function trustToWeight(trustScore: number): number {
  const t = Math.max(0, Math.min(1, trustScore));
  return TRUST.W_MIN + (TRUST.W_MAX - TRUST.W_MIN) * Math.pow(t, TRUST.GAMMA);
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/**
 * One BT quality pass over a single class's evidence. Returns, per contender, a 0–100 quality
 * (harsh category-z logistic, NO shrinkage — the blend's activation + the eligibility gate handle
 * confidence) and the weighted real evidence volume in this class.
 */
function classPass(
  contenderIds: ID[],
  duels: RankInputDuel[],
  votes: RankInputVote[],
): Map<ID, { q: number; vol: number }> {
  const ids = new Set(contenderIds);
  const wins = new Map<ID, number>();
  const pair = new Map<ID, Map<ID, number>>();
  const vol = new Map<ID, number>();
  const gamma = new Map<ID, number>();
  for (const id of contenderIds) {
    wins.set(id, 0);
    pair.set(id, new Map());
    vol.set(id, 0);
    gamma.set(id, 1);
  }
  const bump = (m: Map<ID, number>, k: ID, d: number) => m.set(k, (m.get(k) ?? 0) + d);
  const bumpPair = (i: ID, j: ID, w: number) => {
    const pi = pair.get(i);
    if (pi) pi.set(j, (pi.get(j) ?? 0) + w);
  };
  const addComparison = (winner: ID, loser: ID, w: number) => {
    if (winner !== BASELINE) bump(wins, winner, w);
    if (winner !== BASELINE) bumpPair(winner, loser, w);
    if (loser !== BASELINE) bumpPair(loser, winner, w);
  };

  for (const d of duels) {
    if (!ids.has(d.winnerId) || !ids.has(d.loserId) || d.winnerId === d.loserId) continue;
    addComparison(d.winnerId, d.loserId, d.weight);
    bump(vol, d.winnerId, d.weight);
    bump(vol, d.loserId, d.weight);
  }
  for (const v of votes) {
    if (!ids.has(v.contenderId)) continue;
    const signed = (v.rating - 50) / 50;
    const w = Math.abs(signed) * v.weight * RANKING.THUMB_WEIGHT;
    if (w <= 0) continue;
    if (signed > 0) addComparison(v.contenderId, BASELINE, w);
    else addComparison(BASELINE, v.contenderId, w);
    bump(vol, v.contenderId, w);
  }
  // Regularizing tie vs baseline keeps θ finite.
  const reg = RANKING.PRIOR_TIE_WEIGHT;
  for (const id of contenderIds) {
    addComparison(id, BASELINE, 0.5 * reg);
    addComparison(BASELINE, id, 0.5 * reg);
  }
  // MM iteration with baseline fixed at 1.
  for (let it = 0; it < RANKING.BT_ITERATIONS; it++) {
    const next = new Map<ID, number>();
    for (const id of contenderIds) {
      let denom = 0;
      const gi = gamma.get(id)!;
      for (const [j, nij] of pair.get(id)!) {
        const gj = j === BASELINE ? 1 : gamma.get(j) ?? 1;
        denom += nij / (gi + gj);
      }
      const w = wins.get(id)!;
      next.set(id, denom > 0 ? clamp(w / denom, GAMMA_MIN, GAMMA_MAX) : gi);
    }
    for (const [id, g] of next) gamma.set(id, g);
  }
  const thetas = contenderIds.map((id) => Math.log(gamma.get(id)!));
  const mean = thetas.length ? thetas.reduce((a, b) => a + b, 0) / thetas.length : 0;
  const variance = thetas.length ? thetas.reduce((s, t) => s + (t - mean) ** 2, 0) / thetas.length : 0;
  const std = Math.sqrt(variance) || 1;

  const out = new Map<ID, { q: number; vol: number }>();
  contenderIds.forEach((id, i) => {
    const z = (thetas[i] - mean) / std;
    const q = 100 / (1 + Math.exp(-RANKING.HARSHNESS * z));
    out.set(id, { q, vol: vol.get(id)! });
  });
  return out;
}

/**
 * Rank every contender in a single (subcategory × region) pool with the v2 source-weighted blend.
 */
export function rankSubcategory(
  contenders: RankInputContender[],
  duels: RankInputDuel[],
  votes: RankInputVote[],
  now: number = 0,
): Map<ID, RankResult> {
  const ids = contenders.map((c) => c.id);
  const idSet = new Set(ids);
  const seed = new Map(contenders.map((c) => [c.id, c]));

  const userDuels = duels.filter((d) => d.cls === "user");
  const powerDuels = duels.filter((d) => d.cls === "power");
  const userVotes = votes.filter((v) => v.cls === "user");
  const powerVotes = votes.filter((v) => v.cls === "power");

  const userPass = classPass(ids, userDuels, userVotes);
  const powerPass = classPass(ids, powerDuels, powerVotes);

  // Combined real-evidence stats (RD, distinct opponents, raw duel count, riser velocity).
  const realVol = new Map<ID, number>();
  const distinct = new Map<ID, Set<ID>>();
  const rawDuels = new Map<ID, number>();
  const recent = new Map<ID, number>();
  for (const id of ids) {
    realVol.set(id, 0);
    distinct.set(id, new Set());
    rawDuels.set(id, 0);
    recent.set(id, 0);
  }
  const windowMs = SOURCE.RISER_WINDOW_DAYS * 86400_000;
  const isRecent = (at?: number) => now > 0 && at != null && now - at <= windowMs;
  for (const d of duels) {
    if (!idSet.has(d.winnerId) || !idSet.has(d.loserId) || d.winnerId === d.loserId) continue;
    realVol.set(d.winnerId, realVol.get(d.winnerId)! + d.weight);
    realVol.set(d.loserId, realVol.get(d.loserId)! + d.weight);
    distinct.get(d.winnerId)!.add(d.loserId);
    distinct.get(d.loserId)!.add(d.winnerId);
    rawDuels.set(d.winnerId, rawDuels.get(d.winnerId)! + 1);
    rawDuels.set(d.loserId, rawDuels.get(d.loserId)! + 1);
    if (isRecent(d.at)) {
      recent.set(d.winnerId, recent.get(d.winnerId)! + d.weight);
      recent.set(d.loserId, recent.get(d.loserId)! + d.weight);
    }
  }
  for (const v of votes) {
    if (!idSet.has(v.contenderId)) continue;
    const signed = Math.abs((v.rating - 50) / 50);
    const w = signed * v.weight * RANKING.THUMB_WEIGHT;
    realVol.set(v.contenderId, realVol.get(v.contenderId)! + w);
    if (isRecent(v.at)) recent.set(v.contenderId, recent.get(v.contenderId)! + w);
  }

  const results = new Map<ID, RankResult>();
  for (const id of ids) {
    const s = seed.get(id)!;
    const u = userPass.get(id)!;
    const p = powerPass.get(id)!;
    const pubVol = Math.max(0, s.pubVolume ?? 0);
    const pubScore = clamp(s.seedScore ?? 0, 0, 100);

    // Per-class activation a_c = vol/(vol+M), then effective weight w_c = TARGET_c·a_c.
    const aPub = pubVol / (pubVol + SOURCE.M.publication);
    const aUser = u.vol / (u.vol + SOURCE.M.user);
    const aPower = p.vol / (p.vol + SOURCE.M.power);
    const wPub = pubVol > 0 ? SOURCE.TARGET.publication * aPub : 0;
    const wUser = u.vol > 0 ? SOURCE.TARGET.user * aUser : 0;
    const wPower = p.vol > 0 ? SOURCE.TARGET.power * aPower : 0;
    const wSum = wPub + wUser + wPower;

    const blended = wSum > 0 ? (wPub * pubScore + wUser * u.q + wPower * p.q) / wSum : 0;

    const realEvidence = realVol.get(id)!;
    const rd = RANKING.RD_BASE / Math.sqrt(1 + realEvidence / RANKING.RD_Q);
    const eligible = pubVol > 0 || realEvidence >= SOURCE.MIN_EVIDENCE;
    const score = eligible ? Math.round(blended * 10) / 10 : 0;
    const sortKey = eligible ? score - RANKING.LCB_LAMBDA * (rd / RANKING.RD_BASE) * 100 : -1e9;

    results.set(id, {
      theta: 0,
      rd,
      weightedVotes: realEvidence,
      comparisonCount: rawDuels.get(id)!,
      distinctOpponents: distinct.get(id)!.size,
      score,
      sortKey,
      status: "provisional",
      rank: null,
      standing: eligible ? "unranked" : "new",
      riserScore: recent.get(id)!,
    });
  }

  // Rank eligible contenders by descending sort key; top RANKED_CAP are "ranked" (status active).
  const eligible = [...results.entries()]
    .filter(([, r]) => r.standing !== "new")
    .sort((a, b) => b[1].sortKey - a[1].sortKey);
  eligible.forEach(([, r], i) => {
    if (i < SOURCE.RANKED_CAP) {
      r.rank = i + 1;
      r.standing = "ranked";
      r.status = "active";
    } else {
      r.standing = "unranked";
      r.status = "provisional";
    }
  });

  return results;
}
