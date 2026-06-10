import test from "node:test";
import assert from "node:assert/strict";
import { slugify, dishSlugBase, mintDishSlug } from "./slug";

test("slugify", async (t) => {
  await t.test("kebab-cases and strips punctuation/accents", () => {
    assert.equal(slugify("Three-Cheese Pie"), "three-cheese-pie");
    assert.equal(slugify("Katz's Pastrami on Rye"), "katzs-pastrami-on-rye");
    assert.equal(slugify("Café Habana — Grilled Corn!"), "cafe-habana-grilled-corn");
    assert.equal(slugify("L'Industrie Pizzeria"), "lindustrie-pizzeria");
  });

  await t.test("ampersand reads as 'and'", () => {
    assert.equal(slugify("Bagel & Lox"), "bagel-and-lox");
  });

  await t.test("caps length at a word boundary", () => {
    const long = slugify("a".repeat(60) + " " + "b".repeat(60));
    assert.ok(long.length <= 80);
    assert.ok(!long.endsWith("-"));
  });

  await t.test("empty/symbol-only input → empty string", () => {
    assert.equal(slugify("!!!"), "");
  });
});

test("dishSlugBase joins title + place", () => {
  assert.equal(dishSlugBase("Three-Cheese Pie", "Lucali"), "three-cheese-pie-lucali");
  assert.equal(dishSlugBase("Tonkotsu Ramen", "Ippudo NY"), "tonkotsu-ramen-ippudo-ny");
});

test("mintDishSlug", async (t) => {
  await t.test("dedupes with -2/-3 suffixes within the taken-set", () => {
    const taken = new Set<string>();
    assert.equal(mintDishSlug(taken, "Cheese Slice", "Joe's Pizza", "id-1"), "cheese-slice-joes-pizza");
    assert.equal(mintDishSlug(taken, "Cheese Slice", "Joe's Pizza", "id-2"), "cheese-slice-joes-pizza-2");
    assert.equal(mintDishSlug(taken, "Cheese Slice", "Joe's Pizza", "id-3"), "cheese-slice-joes-pizza-3");
    assert.equal(taken.size, 3);
  });

  await t.test("empty base falls back to dish-<id8>", () => {
    const taken = new Set<string>();
    assert.equal(mintDishSlug(taken, "!!!", "???", "abcdef1234"), "dish-abcdef12");
  });

  await t.test("fallback also dedupes", () => {
    const taken = new Set<string>(["dish-abcdef12"]);
    assert.equal(mintDishSlug(taken, "!!!", "???", "abcdef1234"), "dish-abcdef12-2");
  });
});
