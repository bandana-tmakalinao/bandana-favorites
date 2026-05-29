import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, levenshtein, similarity, resolveDishName } from "./match";

test("normalizeName strips accents, punctuation, case, and collapses whitespace", () => {
  assert.equal(normalizeName("  Crème   Brûlée! "), "creme brulee");
  assert.equal(normalizeName("Mac & Cheese"), "mac and cheese");
  assert.equal(normalizeName("Joe’s Pizza"), "joes pizza");
  assert.equal(normalizeName("BLACK-AND-WHITE Cookie"), "black and white cookie");
});

test("levenshtein basic distances", () => {
  assert.equal(levenshtein("kitten", "kitten"), 0);
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal(levenshtein("", "abc"), 3);
});

test("similarity matches the distinctive part once the category word is stripped", () => {
  // "tonkotsu" ⊂ "tonkotsu ramen" → strong once "ramen" is a stop word.
  assert.ok(similarity("Tonkotsu", "Tonkotsu Ramen", ["ramen"]) >= 0.88);
  // typo in the distinctive part is still close.
  assert.ok(similarity("Tonkatsu Ramen", "Tonkotsu Ramen", ["ramen"]) >= 0.8);
});

test("similarity does NOT match two different dishes that only share the category word", () => {
  // Shoyu vs Tonkotsu share only "ramen" — stripping it must drop the score well below SUGGEST.
  assert.ok(similarity("Shoyu Ramen", "Tonkotsu Ramen", ["ramen"]) < 0.6);
  assert.ok(similarity("Margherita Pie", "Pepperoni Pie", ["pizza"]) < 0.6);
});

test("resolveDishName snaps a near-duplicate to the existing canonical name", () => {
  const existing = ["Tonkotsu Ramen", "Spicy Miso Ramen", "Shoyu Ramen"];
  const r = resolveDishName("tonkotsu", existing, "Ramen");
  assert.equal(r.decision, "snap");
  assert.equal(r.name, "Tonkotsu Ramen"); // stored value is the canonical spelling
});

test("resolveDishName treats a genuinely new dish as new", () => {
  const existing = ["Tonkotsu Ramen", "Shoyu Ramen"];
  const r = resolveDishName("Tsukemen", existing, "Ramen");
  assert.equal(r.decision, "new");
  assert.equal(r.name, "Tsukemen");
  assert.equal(r.suggestion, null);
});

test("resolveDishName suggests (but does not force) a close-but-not-identical name", () => {
  const existing = ["Margherita Pie"];
  const r = resolveDishName("Margarita", existing, "Pizza");
  assert.equal(r.decision, "suggest");
  assert.equal(r.suggestion, "Margherita Pie");
  assert.equal(r.name, "Margarita"); // keeps the user's input; UI offers the suggestion
});

test("resolveDishName on empty existing list is always new", () => {
  const r = resolveDishName("Pastrami on Rye", [], "Pastrami");
  assert.equal(r.decision, "new");
});
