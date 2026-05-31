# Data access & persistence

*The synchronous `Repository` seam over a single in-memory `StoreData` working set, with two backings: `.data/store.json` (local default) or Postgres delta write-through (`DATABASE_URL`). Last updated 2026-05-31.*

## Status
Built. Local in-memory + `.data/store.json` path is the default and fully working. The Postgres durable-working-set path (`PgRepository` + debounced delta flush, boot/seed via `instrumentation.ts`) is fully implemented and exercised, but **not provisioned** in any cloud env (billable; awaiting go-ahead — see OVERVIEW §10). The richer Drizzle schema (`schema.ts`) and the per-row scale-out repo are scaffolded, not wired.

## Where it lives
| File | Role |
| --- | --- |
| `src/db/repo.ts` | `Repository` interface (the seam), all DTO types, `getRepo()` factory, `globalThis` store/corpus caching |
| `src/db/memory.ts` | `MemoryRepository` — the entire query/mutation engine, in-memory over `StoreData` |
| `src/db/pg.ts` | `PgRepository extends MemoryRepository`, `PgController` (debounced delta flush), `initPgStore`, `getSql`, raw `DDL` |
| `src/db/store.ts` | `loadStore`/`saveStore` (`.data/store.json`), `loadCorpus` (`.data/nyc-corpus.json`), `CorpusPlace` |
| `src/db/schema.ts` | Production Drizzle Postgres/PostGIS schema (canonical place table + Overture/Google side-tables) — **separate** from the DDL `pg.ts` actually runs |
| `src/instrumentation.ts` | Next.js boot hook → `initPgStore()` when `DATABASE_URL` is set |
| `src/seed/placeholder.ts` | `generateSeed()` (used by both paths) + `recomputeSubcategory()` (ranking recompute) |

## How it works

### The seam: one synchronous interface
Every page/route depends only on `Repository` (`repo.ts`), a fully **synchronous** interface (e.g. `getRankedList(subSlug): RankedList | null`, `recordDuel(...): { ok; error? }`). Because reads/writes are sync, pages never touch a DB driver and never change when the backing flips. `repo.ts` also exports the DTOs the UI consumes — `ContenderView`, `RankedList`, `DuelPair`, `PlaceDetail`, `ProfileView`, `CategoryStanding`, etc. — none of which are raw rows.

### The factory & globalThis caching
`getRepo()` is the only entry point:
- If `process.env.DATABASE_URL` → `getPgRepository()` (requires `initPgStore()` to have run at boot, else throws).
- Else: lazy-load the store into `globalThis.__bfStore` — `loadStore()`, or `generateSeed()` + `saveStore()` on first run — and the corpus into `globalThis.__bfCorpus`, then return `new MemoryRepository(store, corpus)`.

The **data** is cached on `globalThis` (survives Next.js dev HMR reloads), but the `MemoryRepository` **wrapper is rebuilt every call** so code edits to its methods hot-reload cleanly.

### MemoryRepository — the actual engine
All logic lives here, operating on arrays in one `StoreData` (regions, categories, subcategories, places, users, contenders, comparisons, votes, photos). It is the source of truth for both backings. Notable shape:
- Mutations follow a fixed sequence: validate → mutate arrays → `recomputeSubcategory(store, subId)` (re-solves Bradley-Terry for the touched food type) → `this.persist()`.
- `persist()` is `protected` and calls `saveStore(this.store)` wrapped in try/catch (read-only FS just keeps data in memory). **This is the override point for Postgres.**
- Reads filter/sort the in-memory arrays directly (`getRankedList` splits `active` vs `provisional`, `searchAllPlaces` blends stored places + corpus with a fuzzy score + twin-dedupe, etc.).

### PgRepository — durable working set, not per-request queries
`PgRepository extends MemoryRepository` and **inherits every read and every mutation unchanged**. It overrides exactly one method:

```ts
protected persist() { this.controller.schedule(); }  // schedule a debounced delta flush instead of writing store.json
```

So all queries still run against the in-memory `StoreData` (loaded once at boot); Postgres is purely the durability layer behind mutations.

**`PgController`** (one per process, holds the live store ref) does coalesced, delta-only write-through:
- `schedule()` sets a 250ms `setTimeout`; overlapping calls collapse (`flushing`/`dirtyAgain` flags re-schedule after an in-flight flush).
- `flushTable()` diffs each table against `snapshot` (table → id → last-written JSON). Only rows whose JSON changed are upserted (`INSERT … ON CONFLICT (id) DO UPDATE`, batched 800); ids that vanished are `DELETE … WHERE id IN (…)`. Then `snapshot` is replaced with the new set.
- `TABLES: Spec<any>[]` is the encode/decode registry — each entity has `cols`, `toRow`, `fromRow`, `rows`, `assign`. Nested fields (`showcase`, `pinnacle`, `categoryTrust`, `oauth`, `seedSources`) are stored JSON-as-text via `J`/`P` helpers.

### Boot/seed flow
`instrumentation.register()` runs once on Node boot, **before any request**. If `NEXT_RUNTIME === "nodejs"` and `DATABASE_URL` is set → `initPgStore()`:
1. `getSql()` opens the `postgres` pool (`max = PG_POOL_MAX ?? 5`, `prepare:false` for pgbouncer safety, `ssl:"require"` unless localhost).
2. Run `DDL` (idempotent `CREATE TABLE IF NOT EXISTS` + indexes + a couple `ALTER … ADD COLUMN IF NOT EXISTS` migrations).
3. `SELECT count(*) FROM regions`: if >0, load every table into a fresh `emptyStore()` via `fromRow`; if empty, `generateSeed()` and mark `seeded`.
4. Build the `PgController`; if seeded, `await controller.flush()` once (snapshot empty → full insert).
5. Stash controller + corpus on `globalThis`; register `SIGTERM`/`SIGINT` handlers that flush + `sql.end()` (Render sends SIGTERM on deploy/restart).

Helpers: `pgReady()`, `flushPg()` (force a flush — used by seed scripts/tests/shutdown).

### Why this shape (connection-cap friendly)
Managed Postgres caps connections hard. Per-request SQL would blow that under load; here the only DB traffic is one boot load + small coalesced flushes. Node's event loop serializes the synchronous mutations, and the flush is async + debounced, so a single web instance serves 100+ concurrent users on a tiny pool. The cost: it's **single-instance** (the working set lives in one process's memory).

### Scale-out path
When horizontal scaling (multiple web instances) is needed, the upgrade is a **per-row query repository against the same schema** — `schema.ts` (Drizzle + PostGIS, with the canonical/Overture/Google place separation, `trust_events` ledger, `ranking_snapshots`, etc.) is the target. The tables are ready; the per-row repo is not yet written. (DECISIONS.md.)

## Key decisions & why
- **Sync interface over an in-memory working set, not async per-request queries.** Keeps pages driver-free and identical across backings; keeps DB connection use minimal. Deliberate trade: single web instance until the scale-out repo lands.
- **`PgRepository` inherits MemoryRepository wholesale**, overriding only `persist()`. The proven query/ranking logic is written once; Postgres is bolted on as durability, not a rewrite.
- **Delta diff by JSON snapshot**, not change-tracking in the mutation methods. Mutations stay ignorant of persistence; the controller figures out what changed. Simple, and immune to a missed dirty-flag.
- **Two schemas on purpose.** `pg.ts` runs a flat, text-id `DDL` that mirrors `StoreData` 1:1 (so load/flush is mechanical). `schema.ts` is the *aspirational* relational/PostGIS schema for the future per-row repo — it is **not** what `initPgStore` creates today.
- **Zero-config local default.** `getRepo()` with no env seeds + persists to `.data/store.json`, so the whole app runs with no services.
- **Not done deliberately:** no ORM at runtime (raw `sql.unsafe` parameterized strings), no migration runner (idempotent DDL + inline `ALTER IF NOT EXISTS`), no per-request DB queries, no Drizzle wiring, no cloud provisioning.

## Gotchas
- **`getRepo()` with `DATABASE_URL` set but no boot throws.** `getPgRepository()` requires `instrumentation.register()` → `initPgStore()` to have populated `globalThis.__bfPgController`. Scripts/tests using the PG path must run the boot hook first.
- **Single source of truth is RAM.** All reads hit the in-memory store; Postgres is write-behind only. A crash before a flush loses up to ~250ms of mutations (SIGTERM handler covers graceful shutdown, not hard kills).
- **Single-instance only.** Run two web instances against one DB and they have divergent in-memory stores — last flush wins, silent data loss. Don't scale horizontally on this repo.
- **`persist()` is `protected` by design** — that's the seam Pg overrides. Don't make it public/private.
- **Read-only FS swallows local saves.** `MemoryRepository.persist()` catches `saveStore` errors silently; data survives only in memory.
- **`schema.ts` ≠ live DB.** Editing `schema.ts` changes nothing at runtime; the DDL in `pg.ts` is what executes. PostGIS (`enablePostgis`) is only relevant to the future Drizzle path.
- **`prepare: false` is required** for pgbouncer/transaction-pooled connections — don't flip it on.
- **`recomputeSubcategory` runs inside mutations** (sync). It's cheap at seed scale; a much larger corpus would make every duel's recompute the hot path, not the DB.

## Related
- [OVERVIEW](../OVERVIEW.md) — §8 tech stack table (local vs prod), §10 status.
- `DECISIONS.md` (repo root) — durable-working-set rationale + scale-out plan.
- Ranking recompute (`src/lib/ranking.ts`, `recomputeSubcategory`) is invoked from every write here; trust→weight (`trustToWeight`) gates `recordDuel`/`recordVote`.
