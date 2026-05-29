/**
 * Batch recompute of all rankings (the "cron" job).
 *   npm run recompute
 *
 * In dev the in-memory repo already recomputes a subcategory synchronously on every duel/vote, so
 * this is mainly for re-deriving the whole board after a config change (e.g. tuning RANKING.SHRINKAGE_M)
 * or as the model for the production Render cron. Production will recompute from the immutable
 * comparison/vote rows in Postgres and rewrite ranking_snapshot (see DECISIONS.md / build plan).
 */
import { loadStore, saveStore, STORE_PATH } from "../src/db/store";
import { computeAllRankings } from "../src/seed/placeholder";

const store = loadStore();
if (!store) {
  console.error("No store found. Run `npm run seed` first.");
  process.exit(1);
}

const t0 = Date.now();
computeAllRankings(store);
saveStore(store);

const active = store.contenders.filter((c) => c.status === "active").length;
console.log(`✓ Recomputed ${store.subcategories.length} subcategories in ${Date.now() - t0}ms`);
console.log(`  ${active}/${store.contenders.length} contenders ranked → ${STORE_PATH}`);
