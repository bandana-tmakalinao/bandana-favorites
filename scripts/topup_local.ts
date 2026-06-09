/**
 * Local-store equivalent of the pg adapter's boot-time topUpSeed (src/db/pg.ts): merge any curated
 * seed contenders missing from .data/store.json — matched by (place name × subcategory × dish title)
 * so it never duplicates or deletes anything, and PRESERVES users/votes/comparisons (unlike
 * `npm run seed`, which regenerates the whole store and wipes real local accounts).
 *
 *   npx tsx scripts/topup_local.ts
 */
import { generateSeed, computeAllRankings } from "../src/seed/placeholder";
import { loadStore, saveStore, STORE_PATH } from "../src/db/store";
import { normalizeName } from "../src/lib/match";
import type { Place } from "../src/lib/types";

const store = loadStore();
if (!store) {
  console.error("No local store at", STORE_PATH, "— run `npm run seed` instead.");
  process.exit(1);
}

const seed = generateSeed();
const region = store.regions[0];

const subSlugById = new Map(store.subcategories.map((s) => [s.id, s.slug]));
const liveSubBySlug = new Map(store.subcategories.map((s) => [s.slug, s]));
const placeById = new Map(store.places.map((p) => [p.id, p]));
const livePlaceByName = new Map<string, Place>();
for (const p of store.places) {
  if (p.status !== "proposed") livePlaceByName.set(normalizeName(p.name), p);
}
const existingKey = new Set<string>();
for (const c of store.contenders) {
  const place = placeById.get(c.placeId);
  const slug = subSlugById.get(c.subcategoryId);
  if (!place || !slug) continue;
  existingKey.add(`${normalizeName(place.name)}|${slug}|${normalizeName(c.title)}`);
}

const seedSubSlugById = new Map(seed.subcategories.map((s) => [s.id, s.slug]));
const seedPlaceById = new Map(seed.places.map((p) => [p.id, p]));

let added = 0;
const bySub = new Map<string, number>();
for (const sc of seed.contenders) {
  const slug = seedSubSlugById.get(sc.subcategoryId);
  const seedPlace = seedPlaceById.get(sc.placeId);
  const liveSub = slug ? liveSubBySlug.get(slug) : undefined;
  if (!slug || !seedPlace || !liveSub) continue;
  const key = `${normalizeName(seedPlace.name)}|${slug}|${normalizeName(sc.title)}`;
  if (existingKey.has(key)) continue;

  let place = livePlaceByName.get(normalizeName(seedPlace.name));
  if (!place) {
    place = { ...seedPlace, id: crypto.randomUUID(), status: "active" };
    store.places.push(place);
    livePlaceByName.set(normalizeName(place.name), place);
  }

  store.contenders.push({
    ...sc,
    id: crypto.randomUUID(),
    placeId: place.id,
    subcategoryId: liveSub.id,
    regionId: region.id,
  });
  existingKey.add(key);
  added++;
  bySub.set(slug, (bySub.get(slug) ?? 0) + 1);
}

if (added > 0) computeAllRankings(store);
saveStore(store);

console.log(`✓ Topped up local store: +${added} contenders (users/votes untouched)`);
for (const [slug, n] of [...bySub.entries()].sort((a, b) => b[1] - a[1])) console.log(`   +${n}  ${slug}`);
