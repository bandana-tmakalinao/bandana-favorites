import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rankSubcategory, trustToWeight, type RankInputDuel } from "./ranking";
import { RANKING, SOURCE, TRUST } from "./config";

const W = trustToWeight(0.8);
const con = (id: string, extra: { seedScore?: number; pubVolume?: number } = {}) => ({ id, ...extra });
// Comparison-only: the sole evidence is a head-to-head duel. `by` = the user who cast it (drives the
// distinct-voter confidence + the ranked-board gate).
const duel = (
  winnerId: string,
  loserId: string,
  by: string = "u1",
  cls: "user" | "power" = "user",
): RankInputDuel => ({ winnerId, loserId, weight: W, cls, by });

describe("trustToWeight", () => {
  it("maps trust 0→W_MIN and 1→W_MAX, monotonically", () => {
    assert.equal(trustToWeight(0), TRUST.W_MIN);
    assert.equal(trustToWeight(1), TRUST.W_MAX);
    assert.ok(trustToWeight(0.5) > trustToWeight(0.2));
  });
});

describe("rankSubcategory (v2 source-weighted blend, comparison-only)", () => {
  it("orders a clear winner above a clear loser", () => {
    // Two distinct voters so the items clear the board gate.
    const res = rankSubcategory(
      [con("a"), con("b"), con("c")],
      [duel("a", "b", "u1"), duel("a", "c", "u2"), duel("b", "c", "u1"), duel("b", "c", "u2")],
    );
    assert.ok(res.get("a")!.score > res.get("b")!.score, "a outranks b");
    assert.ok(res.get("b")!.score > res.get("c")!.score, "b outranks c");
  });

  it("an item with NO evidence is 'new' at score 0 (not 50)", () => {
    const res = rankSubcategory([con("lonely")], []);
    const r = res.get("lonely")!;
    assert.equal(r.standing, "new");
    assert.equal(r.score, 0);
    assert.equal(r.rank, null);
  });

  it("a publication-backed item is eligible & scored from its seed even with no duels", () => {
    const res = rankSubcategory([con("seeded", { seedScore: 88, pubVolume: 1.9 }), con("bare")], []);
    const seeded = res.get("seeded")!;
    assert.notEqual(seeded.standing, "new");
    assert.ok(seeded.score > 70, "editorial item keeps full-confidence score from its seed");
    assert.equal(res.get("bare")!.standing, "new");
  });

  // --- the fig-pizza fix: the corroboration gate (publication, ≥5 users, or ≥2 power users) -------

  it("a single voter CANNOT rank a user-created dish (shows as Unranked)", () => {
    // 'fig' has no publication backing; one curator/power voter duels it above two editorial pies.
    const res = rankSubcategory(
      [
        con("fig"),
        con("ed1", { seedScore: 90, pubVolume: 1.9 }),
        con("ed2", { seedScore: 85, pubVolume: 1.9 }),
      ],
      [duel("fig", "ed1", "u1", "power"), duel("fig", "ed2", "u1", "power")],
    );
    const fig = res.get("fig")!;
    assert.equal(fig.standing, "new", "one voter is not a ranking ⇒ rendered Unranked");
    assert.equal(fig.rank, null, "fig is not on the board");
    assert.ok(res.get("ed1")!.rank != null, "editorial items stay ranked");
  });

  it("TWO distinct power users clear the gate; one does not", () => {
    const figWith = (voters: string[]) =>
      rankSubcategory(
        [con("fig"), con("rival", { seedScore: 50, pubVolume: 1.9 })],
        voters.map((u) => duel("fig", "rival", u, "power")),
      ).get("fig")!;
    assert.equal(figWith(["u1"]).standing, "new", "1 power user ⇒ Unranked");
    const two = figWith(["u1", "u2"]);
    assert.notEqual(two.standing, "new", "2 power users clear MIN_VOTERS.power");
    assert.ok(two.rank != null && two.score > 0, "now ranked with a real score");
  });

  it("normal users need MIN_VOTERS.user distinct people to rank a dish", () => {
    const figWith = (n: number) =>
      rankSubcategory(
        [con("fig"), con("rival", { seedScore: 50, pubVolume: 1.9 })],
        Array.from({ length: n }, (_, i) => duel("fig", "rival", `u${i}`, "user")),
      ).get("fig")!;
    assert.equal(figWith(SOURCE.MIN_VOTERS.user - 1).standing, "new", "below the bar ⇒ Unranked");
    assert.notEqual(figWith(SOURCE.MIN_VOTERS.user).standing, "new", "at the bar ⇒ ranked");
  });

  it("publications anchor the blend; duels move it but don't swing it wildly", () => {
    const base = { seedScore: 80, pubVolume: 1.5 };
    const res = rankSubcategory(
      [con("praised", base), con("panned", base), con("foil")],
      [
        duel("praised", "foil", "u1"),
        duel("praised", "foil", "u2"),
        duel("foil", "panned", "u1"),
        duel("foil", "panned", "u2"),
      ],
    );
    assert.ok(res.get("praised")!.score > res.get("panned")!.score, "duel sentiment moves the blend");
  });

  it("more evidence ⇒ lower rating deviation", () => {
    const duels = Array.from({ length: 20 }, (_, i) => duel("p", "q", `u${i % 4}`));
    const res = rankSubcategory([con("p"), con("q")], duels);
    assert.ok(res.get("p")!.rd < RANKING.RD_BASE, "p accumulated evidence");
  });

  it("caps the ranked set at RANKED_CAP; the rest are unranked", () => {
    const n = SOURCE.RANKED_CAP + 5;
    const contenders = Array.from({ length: n }, (_, i) => con(`c${i}`, { seedScore: 100 - i, pubVolume: 1.5 }));
    const res = rankSubcategory(contenders, []);
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
    const res = rankSubcategory(
      [con("fresh"), con("stale"), con("other")],
      [
        { winnerId: "fresh", loserId: "other", weight: W, cls: "user", by: "u1", at: now },
        { winnerId: "stale", loserId: "other", weight: W, cls: "user", by: "u1", at: old },
      ],
      now,
    );
    assert.ok(res.get("fresh")!.riserScore > 0, "recent evidence registers");
    assert.equal(res.get("stale")!.riserScore, 0, "old evidence does not count as a riser");
    assert.ok(res.get("fresh")!.riserScore > res.get("stale")!.riserScore, "fresh out-rises stale");
  });

  it("does not crash on an empty pool", () => {
    assert.equal(rankSubcategory([], []).size, 0);
  });
});
