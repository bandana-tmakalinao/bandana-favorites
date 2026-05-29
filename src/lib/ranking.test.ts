import { test } from "node:test";
import assert from "node:assert/strict";
import { rankSubcategory, trustToWeight, type RankInputDuel, type RankInputVote } from "./ranking";
import { RANKING, TRUST } from "./config";

const duel = (winnerId: string, loserId: string, weight = 1): RankInputDuel => ({ winnerId, loserId, weight });
const vote = (contenderId: string, value: 1 | -1, weight = 1): RankInputVote => ({ contenderId, value, weight });

test("recovers a consistent total order A > B > C", () => {
  const ids = ["A", "B", "C"];
  const duels = [
    ...Array(3).fill(0).map(() => duel("A", "B")),
    ...Array(3).fill(0).map(() => duel("A", "C")),
    ...Array(3).fill(0).map(() => duel("B", "C")),
  ];
  const r = rankSubcategory(ids, duels, []);
  const A = r.get("A")!, B = r.get("B")!, C = r.get("C")!;
  assert.ok(A.theta > B.theta, "A stronger than B");
  assert.ok(B.theta > C.theta, "B stronger than C");
  assert.equal(A.rank, 1);
  assert.equal(B.rank, 2);
  assert.equal(C.rank, 3);
  assert.equal(A.status, "active");
});

test("Bayesian shrinkage relaxes toward the item's own score as volume grows (the ~200 knee)", () => {
  // Identical win/loss STRUCTURE, just replayed at far higher volume.
  const ids = ["A", "B", "C"];
  const structure = [duel("A", "B"), duel("B", "C"), duel("A", "C")];
  const low = rankSubcategory(ids, structure, []);
  const high = rankSubcategory(ids, structure.flatMap((d) => Array(50).fill(d)), []);
  const lowA = low.get("A")!, highA = high.get("A")!;
  assert.ok(lowA.score > RANKING.CATEGORY_PRIOR_C, "the winner scores above the prior even at low volume");
  assert.ok(
    highA.score > lowA.score + 5,
    `more volume ⇒ score moves further from the prior toward its own merit (${highA.score} vs ${lowA.score})`,
  );
  assert.ok(highA.rd < lowA.rd, "more evidence ⇒ lower rating deviation (more confident)");
});

test("eligibility gate: an unproven item stays provisional with no rank", () => {
  const ids = ["A", "B", "C", "Lonely"];
  // A, B, C form a triangle → each has 2 distinct opponents and enough evidence to be eligible.
  const duels = [duel("A", "B"), duel("B", "C"), duel("C", "A"), duel("A", "B"), duel("B", "C")];
  const votes = [vote("Lonely", 1)]; // one thumb, no duels → 0 opponents
  const r = rankSubcategory(ids, duels, votes);
  assert.equal(r.get("Lonely")!.status, "provisional");
  assert.equal(r.get("Lonely")!.rank, null);
  assert.equal(r.get("A")!.status, "active");
});

test("up/down votes feed the same model in the right direction", () => {
  const ids = ["U", "D"];
  const baseDuels = [duel("U", "D")];
  const before = rankSubcategory(ids, baseDuels, []);
  const after = rankSubcategory(ids, baseDuels, [
    ...Array(10).fill(0).map(() => vote("D", 1)), // many upvotes on D
    ...Array(10).fill(0).map(() => vote("U", -1)), // many downvotes on U
  ]);
  assert.ok(after.get("D")!.score > before.get("D")!.score, "upvotes raise D");
  assert.ok(after.get("U")!.score < before.get("U")!.score, "downvotes lower U");
  assert.ok(after.get("D")!.theta > after.get("D")!.theta - 1); // sanity: finite
});

test("trustToWeight is bounded and monotonic", () => {
  assert.equal(Math.round(trustToWeight(0) * 1000) / 1000, TRUST.W_MIN);
  assert.equal(Math.round(trustToWeight(1) * 1000) / 1000, TRUST.W_MAX);
  assert.ok(trustToWeight(0.3) < trustToWeight(0.6));
  assert.ok(trustToWeight(0.6) < trustToWeight(0.9));
});

test("no NaN/Infinity escapes the solver on degenerate input", () => {
  const r = rankSubcategory(["solo"], [], []); // a single contender, no signal
  const s = r.get("solo")!;
  assert.ok(Number.isFinite(s.theta) && Number.isFinite(s.score) && Number.isFinite(s.rd));
  assert.ok(s.score >= 0 && s.score <= 100);
});
