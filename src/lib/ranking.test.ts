import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rankSubcategory, trustToWeight, type RankInputDuel, type RankInputVote } from "./ranking";
import { RANKING, SOURCE, TRUST } from "./config";

const W = trustToWeight(0.8);
const con = (id: string, extra: { seedScore?: number; pubVolume?: number } = {}) => ({ id, ...extra });
const duel = (winnerId: string, loserId: string, cls: "user" | "power" = "user"): RankInputDuel => ({
  winnerId,
  loserId,
  weight: W,
  cls,
});
const vote = (contenderId: string, rating: number, cls: "user" | "power" = "user"): RankInputVote => ({
  contenderId,
  rating,
  weight: W,
  cls,
});

describe("trustToWeight", () => {
  it("maps trust 0→W_MIN and 1→W_MAX, monotonically", () => {
    assert.equal(trustToWeight(0), TRUST.W_MIN);
    assert.equal(trustToWeight(1), TRUST.W_MAX);
    assert.ok(trustToWeight(0.5) > trustToWeight(0.2));
  });
});

describe("rankSubcategory (v2 source-weighted blend)", () => {
  it("orders a clear winner above a clear loser", () => {
    const res = rankSubcategory(
      [con("a"), con("b"), con("c")],
      [duel("a", "b"), duel("a", "c"), duel("b", "c")],
      [],
    );
    assert.ok(res.get("a")!.score > res.get("b")!.score, "a outranks b");
    assert.ok(res.get("b")!.score > res.get("c")!.score, "b outranks c");
  });

  it("higher rating ⇒ higher score", () => {
    const res = rankSubcategory([con("x"), con("y")], [], [vote("x", 95), vote("y", 20)]);
    assert.ok(res.get("x")!.score > res.get("y")!.score, "x outscores y");
  });

  it("an item with NO evidence is 'new' at score 0 (not 50)", () => {
    const res = rankSubcategory([con("lonely")], [], []);
    const r = res.get("lonely")!;
    assert.equal(r.standing, "new");
    assert.equal(r.score, 0);
    assert.equal(r.rank, null);
  });

  it("a publication-backed item is eligible & scored from its seed even with no user activity", () => {
    const res = rankSubcategory([con("seeded", { seedScore: 88, pubVolume: 1.9 }), con("bare")], [], []);
    const seeded = res.get("seeded")!;
    assert.notEqual(seeded.standing, "new");
    assert.ok(seeded.score > 0, "seeded scores from its publication backing");
    assert.equal(res.get("bare")!.standing, "new");
  });

  it("publications dominate the blend at 50% but users move it", () => {
    // Same strong seed; one gets panned by users, the other praised. The praised one ends higher,
    // but neither swings all the way (publications hold half the weight).
    const base = { seedScore: 80, pubVolume: 1.5 };
    const res = rankSubcategory(
      [con("praised", base), con("panned", base)],
      [],
      [vote("praised", 100), vote("praised", 95), vote("panned", 5), vote("panned", 10)],
    );
    assert.ok(res.get("praised")!.score > res.get("panned")!.score, "user sentiment moves the blend");
  });

  it("more evidence ⇒ lower rating deviation", () => {
    const duels = Array.from({ length: 20 }, () => duel("p", "q"));
    const res = rankSubcategory([con("p"), con("q")], duels, []);
    assert.ok(res.get("p")!.rd < RANKING.RD_BASE, "p accumulated evidence");
  });

  it("caps the ranked set at RANKED_CAP; the rest are unranked", () => {
    const n = SOURCE.RANKED_CAP + 5;
    const contenders = Array.from({ length: n }, (_, i) => con(`c${i}`, { seedScore: 100 - i, pubVolume: 1.5 }));
    const res = rankSubcategory(contenders, [], []);
    const ranked = [...res.values()].filter((r) => r.standing === "ranked");
    const unranked = [...res.values()].filter((r) => r.standing === "unranked");
    assert.equal(ranked.length, SOURCE.RANKED_CAP, "exactly RANKED_CAP are ranked");
    assert.equal(unranked.length, 5, "the overflow is unranked");
    assert.ok(ranked.every((r) => r.rank != null), "ranked items carry a rank");
    assert.ok(unranked.every((r) => r.rank == null), "unranked items have no rank");
  });

  it("riserScore counts only recent evidence within the window", () => {
    const now = 1_000_000_000_000;
    const old = now - (SOURCE.RISER_WINDOW_DAYS + 5) * 86400_000;
    // Separate opponents so the recent activity is asymmetric: fresh duels recently, stale long ago.
    const res = rankSubcategory(
      [con("fresh"), con("stale"), con("other")],
      [
        { winnerId: "fresh", loserId: "other", weight: W, cls: "user", at: now },
        { winnerId: "stale", loserId: "other", weight: W, cls: "user", at: old },
      ],
      [],
      now,
    );
    assert.ok(res.get("fresh")!.riserScore > 0, "recent evidence registers");
    assert.equal(res.get("stale")!.riserScore, 0, "old evidence does not count as a riser");
    assert.ok(res.get("fresh")!.riserScore > res.get("stale")!.riserScore, "fresh out-rises stale");
  });

  it("does not crash on an empty pool", () => {
    assert.equal(rankSubcategory([], [], []).size, 0);
  });
});
