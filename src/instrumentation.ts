/**
 * Next.js startup hook — runs once when the Node server boots, before any request is served.
 * When DATABASE_URL is set, this loads (or seeds) the Postgres-backed store into memory so the
 * synchronous repository is ready. No-op in the in-memory dev default.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DATABASE_URL) {
    const { initPgStore } = await import("@/db/pg");
    await initPgStore();
  }
}
