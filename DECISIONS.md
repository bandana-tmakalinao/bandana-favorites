# Build log & decisions — Bandana Favorites

Autonomous overnight build (started 2026-05-29). This file logs the decisions I made without you and
the questions for you to answer in the morning. Nothing here is irreversible.

## Decisions made autonomously (with rationale)

1. **Local-first scaffold, production adapters env-gated.** The app boots and the full loop runs with
   **no external services or keys**: in-memory + `.data/store.json` data, keyless OSM raster map,
   local-disk photo uploads, lightweight cookie auth. Each swaps to its production adapter (Postgres,
   R2, Auth.js, PMTiles) purely by setting env vars. _Why:_ lets me build and verify a working loop
   overnight without provisioning billable infra or needing your secrets.

2. **Did NOT provision Render Postgres / R2 / any cloud resource, and did NOT push git.** These are
   billable / outward-facing and were left for your sign-off. The Drizzle schema, migrations config,
   and Postgres repository are written and ready — provisioning is a morning step.

3. **Folder location:** `~/Library/Mobile Documents/com~apple~CloudDocs/Bandana Favorites` (per the
   approved plan; matches your other Bandana projects). ⚠️ See open question #1 about iCloud +
   `node_modules`.

4. **Stack:** Next.js 15 (App Router) + TypeScript + Tailwind v4 + Drizzle, per plan. Used the system
   font stack instead of `next/font` to avoid a network fetch during the offline build.

5. **Ranking knob `m = 40`** (category-prior shrinkage), exposed in `src/lib/config.ts`. "Sensible
   default, tune later," as agreed.

## Open questions for the morning

1. **iCloud + `node_modules`.** The repo lives in iCloud Drive, which will try to sync `node_modules`
   (tens of thousands of files) — can cause slow/flaky builds. Options: (a) leave it (your SendBandana
   repo already lives in iCloud); (b) move the repo to `~/Developer/`; (c) keep source in iCloud but
   relocate `node_modules` out of sync. I left it in place. **Want me to move it?**

2. **Render provisioning.** Ready to provision managed Postgres (+PostGIS), a web service, a cron, and
   KV via the Render MCP when you approve. Which Render workspace/account should it go in, and is the
   free Postgres tier fine to start?

3. **Real data ingestion.** A background research pass is determining the cleanest legal sources
   (Overture Maps / NYC OpenData for places; a legal basis for seed _order_; image sourcing). I'll
   summarize its findings; building the real ingestion pipeline awaits your go-ahead on cost/scope.

4. **OAuth + phone (anti-Sybil).** Light cookie auth is in for now. When you want the real anti-Sybil
   floor, I need a decision on the OTP provider (Twilio/Telnyx recommended over SendBandana for the
   security path) and Google/Apple OAuth credentials.

## Phase status (overnight build complete through MVP scaffold)

- [x] Phase 0 — Next.js 15 + Tailwind v4 + Drizzle scaffold, app shell (boots, `next build` clean)
- [x] Phase 0b — Drizzle schema (15 tables, PostGIS) + migration generated (`drizzle/0000_*.sql`).
      Repository seam (`Repository` interface; in-memory impl live, Postgres impl gated on provisioning).
- [x] Phase 1 — placeholder NYC seed + taxonomy (13 categories, 22 subcategories, 263 contenders,
      1,841 comparisons, 785 votes, deterministic via `npm run seed`)
- [x] Phase 2 — browse: category hub `/nyc`, ranked list `/nyc/[sub]` with list/map toggle (MapLibre),
      contender detail `/c/[id]`
- [x] Phase 3 — duels (`/duel`) + ranking engine (Bradley-Terry + shrinkage), 6/6 unit tests green
- [x] Phase 4–6 — photo upload (local-disk dev path), light cookie auth, batch recompute
      (`npm run recompute`). Photo *verification gate* + real anti-Sybil deferred to v1 (per plan).

## How to run (verified working)

```bash
npm install
npm run seed       # → .data/store.json  (auto-seeds on first dev boot too)
npm run dev        # http://localhost:3000   (a dev server is already running)
npm test           # ranking engine unit tests
npm run build      # full type-check + production build (passes)
```

Verified end-to-end via curl: sign-in → record duel → next pair served → up-vote moved a score
(50.0 → 51.4, correctly small for a new low-trust user) → ranks reorder; unauthenticated writes 401.

## Morning to-dos (need you / a decision)

1. **Look at it** — `http://localhost:3000` (or `npm run dev`). Browse `/nyc`, open a list, hit "Rank
   these" to duel, sign in on `/me`.
2. **iCloud + node_modules** (open question #1) — decide whether to relocate the repo out of iCloud.
3. **Provision Render** (open question #2) — say go + which workspace, and I'll create Postgres+PostGIS,
   wire the `PgRepository`, run `drizzle/0000_*.sql`, and deploy. (Not done overnight — billable/outward.)
4. **Real data** — approve building the Overture + NYC OpenData ingestion (`docs/data-sourcing-research.md`)
   to replace the placeholder seed.
5. **Anti-Sybil** (open question #4) — when ready, decide OTP provider + OAuth creds for the real floor.

## Known limitations of the scaffold (by design, for the morning)

- Data is fictional placeholder; photos are generic stock keyed by food type (clearly labeled).
- Trust is a stub (everyone starts 0.1, curators preset higher); no phone/OAuth, no manipulation
  detection, no photo-verification gate yet — all v1 per the plan.
- In-memory store persists to `.data/store.json`; resets if that file is deleted. Postgres is the
  production path (schema ready).
- Map uses keyless OSM raster tiles (fine for dev; PMTiles/MapTiler is the production path).
