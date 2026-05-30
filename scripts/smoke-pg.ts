/**
 * Smoke test for the Postgres persistence layer. Run with DATABASE_URL set:
 *   DATABASE_URL=... npx tsx scripts/smoke-pg.ts
 * Seeds (if empty), exercises the core loop, flushes, then re-reads the DB to confirm durability.
 */
import { initPgStore, flushPg, getSql } from "@/db/pg";
import { getRepo } from "@/db/repo";

async function main() {
  console.log("→ initPgStore (DDL + load-or-seed)…");
  await initPgStore();
  const repo = getRepo();

  const pizza = repo.getRankedList("pizza");
  console.log(`  pizza ranked list: ${pizza?.ranked.length} ranked, ${pizza?.contenders.length} contenders`);
  console.log(`  stats:`, repo.stats());

  console.log("→ exercise writes (user + duel + category favorite)…");
  const user = repo.getOrCreateUser("SmokeTester");
  const pair = repo.getDuelPair("pizza");
  if (pair) {
    const r = repo.recordDuel(user.id, pair.a.id, pair.b.id);
    console.log(`  recordDuel(${pair.a.title} > ${pair.b.title}):`, r);
    repo.setCategoryFavorite(user.id, "pizza", pair.a.id);
    console.log(`  setCategoryFavorite pizza ->`, repo.getCategoryFavorite(user.id, "pizza") === pair.a.id ? "ok" : "FAIL");
  }
  const oauthUser = repo.findOrCreateOAuthUser({ provider: "google", sub: "smoke-123", name: "Google Smoke", email: "smoke@example.com" });
  console.log(`  findOrCreateOAuthUser -> @${oauthUser.handle}`);

  console.log("→ flush delta write-through…");
  await flushPg();

  // Re-read straight from the DB to confirm rows actually landed.
  const sql = getSql();
  const counts: Record<string, number> = {};
  for (const t of ["regions", "categories", "subcategories", "places", "app_users", "contenders", "comparisons", "votes"]) {
    const [{ c }] = (await sql.unsafe(`SELECT count(*)::int AS c FROM ${t}`)) as unknown as [{ c: number }];
    counts[t] = c;
  }
  console.log("  DB row counts:", counts);
  const [{ c: smokeUsers }] = (await sql.unsafe(
    `SELECT count(*)::int AS c FROM app_users WHERE name IN ('SmokeTester','Google Smoke')`,
  )) as unknown as [{ c: number }];
  console.log(`  smoke users persisted: ${smokeUsers}/2 ${smokeUsers === 2 ? "✓" : "✗"}`);

  await sql.end();
  console.log("✓ smoke test complete");
}

main().catch((e) => {
  console.error("✗ smoke failed:", e);
  process.exit(1);
});
