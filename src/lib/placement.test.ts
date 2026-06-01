import test from "node:test";
import assert from "node:assert/strict";
import {
  initPlacement,
  advancePlace,
  removePivot,
  resolveTie,
  pivotIndex,
  type Placeable,
} from "./placement";

type Item = Placeable;
const item = (id: string): Item => ({ id });

/** Run a placement to completion using `strength` as ground truth (higher ranks earlier/better). */
function runPlacement(placed: Item[], toPlace: Item[], strength: Record<string, number>): string[] {
  let s = initPlacement(placed, toPlace);
  let guard = 0;
  while (!s.done && guard++ < 1000) {
    const target = s.toPlace[0];
    const pivot = s.sortedPlaced[pivotIndex(s)];
    s = advancePlace(strength[target.id] > strength[pivot.id], s);
  }
  return s.sortedPlaced.map((x) => x.id);
}

test("binary insert sorts a fresh ladder from scratch", () => {
  const ids = ["A", "B", "C", "D"].map(item);
  const strength = { A: 3, B: 1, C: 4, D: 2 }; // true order: C > A > D > B
  assert.deepEqual(runPlacement([], ids, strength), ["C", "A", "D", "B"]);
});

test("inserts a single target at the correct rank in an existing tried ladder", () => {
  const ladder = ["A", "B", "C"].map(item); // already sorted best-first
  const strength = { A: 3, B: 2, C: 1, X: 2.5 }; // X belongs between A and B
  assert.deepEqual(runPlacement(ladder, [item("X")], strength), ["A", "X", "B", "C"]);
});

test("single item with an empty ladder finishes immediately (nothing to compare)", () => {
  const s = initPlacement([], [item("A")]);
  assert.equal(s.done, true);
  assert.deepEqual(s.sortedPlaced.map((x) => x.id), ["A"]);
  assert.equal(s.totalToPlace, 0);
});

test("'haven't tried this' drops the pivot from the session ladder and keeps going", () => {
  const s0 = initPlacement(["A", "B", "C"].map(item), [item("X")]); // pivot = index 1 = B
  assert.equal(s0.sortedPlaced[pivotIndex(s0)].id, "B");
  const s1 = removePivot(s0);
  assert.deepEqual(s1.sortedPlaced.map((x) => x.id), ["A", "C"]); // B is gone
  assert.equal(s1.done, false);
  assert.equal(s1.toPlace[0].id, "X"); // still placing X
});

test("'too close to call' settles the target just below the pivot", () => {
  const s0 = initPlacement(["A", "B", "C"].map(item), [item("X")]); // pivot index 1 (B)
  const s1 = resolveTie(s0);
  assert.deepEqual(s1.sortedPlaced.map((x) => x.id), ["A", "B", "X", "C"]);
  assert.equal(s1.done, true);
});

test("items already in the ladder are not re-placed (dedupe)", () => {
  const s = initPlacement(["A", "B"].map(item), [item("B"), item("C")]);
  assert.equal(s.totalToPlace, 1); // only C is new
  assert.equal(s.toPlace[0].id, "C");
});

test("removePivot that exhausts the ladder pins the target", () => {
  const s0 = initPlacement([item("A")], [item("X")]); // ladder [A], pivot index 0
  const s1 = removePivot(s0); // drop A → nothing left → X pinned
  assert.equal(s1.done, true);
  assert.deepEqual(s1.sortedPlaced.map((x) => x.id), ["X"]);
});
