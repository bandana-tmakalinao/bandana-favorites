/**
 * Regenerates the placeholder NYC dataset and writes it to .data/store.json.
 *   npm run seed
 *
 * Idempotent and deterministic — re-running produces the same seed. The real-data ingestion
 * (Overture + NYC OpenData) will replace this entry point per docs/data-sourcing-research.md.
 */
import { generateSeed } from "../src/seed/placeholder";
import { saveStore, STORE_PATH } from "../src/db/store";

const store = generateSeed();
saveStore(store);

const bySub = new Map<string, number>();
for (const c of store.contenders) bySub.set(c.subcategoryId, (bySub.get(c.subcategoryId) ?? 0) + 1);
const active = store.contenders.filter((c) => c.status === "active").length;

console.log("✓ Seeded Bandana Favorites placeholder dataset");
console.log(`  → ${STORE_PATH}`);
console.log(
  `  categories=${store.categories.length} subcategories=${store.subcategories.length} ` +
    `places=${store.places.length} contenders=${store.contenders.length} (${active} ranked, ${store.contenders.length - active} provisional)`,
);
console.log(
  `  comparisons=${store.comparisons.length} votes=${store.votes.length} ` +
    `photos=${store.photos.length} users=${store.users.length}`,
);
