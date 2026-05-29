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

## Phase status

- [x] Phase 0 — Next.js scaffold + config + app shell (boots)
- [ ] Phase 0b — Drizzle schema + repository layer
- [ ] Phase 1 — placeholder NYC seed + taxonomy
- [ ] Phase 2 — browse (category list + map + detail)
- [ ] Phase 3 — duels + ranking engine (+ unit tests)
- [ ] Phase 4–6 — photos, light auth, recompute
