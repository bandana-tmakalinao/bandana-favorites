# Build log & decisions — Bandana Favorites

Autonomous overnight build (started 2026-05-29). This file logs the decisions I made without you and
the questions for you to answer in the morning. Nothing here is irreversible.

## Update — profile #1 Picks + auth guardrails (2026-05-30)

**Profile "#1 Picks" (gold showcase).** The profile now headlines with a gold row of your declared #1
per showcased category — gold-ringed emoji circles ("#1 RAMEN" etc.), each linking to the dish.
Wiring: `ProfileView.topPicks` (new) resolves, per category in `User.showcase`, the `categoryFavorites`
pick (declared in onboarding) → falling back to the personal #1 from ratings. So the onboarding
"favorite" I built earlier now has a home on the profile. Editor copy updated to explain it. Files:
`repo.ts` (ProfileView), `memory.ts` (getProfile), `app/u/[handle]/page.tsx`, `ProfileEditor.tsx`.

**Auth guardrails (foundation — exploratory, no creds/HTTPS yet).** Built the structure so OAuth/2FA
slot in later without rework; everything env-gated so **dev behavior is unchanged**:
- **Session hardening** (`lib/auth.ts`): cookie token is now `uid.issuedAt.sig` — a leaked cookie now
  *expires* (was valid forever). Legacy `uid.sig` tokens still accepted once (existing sessions survive,
  re-issued hardened on next sign-in). Loud boot warning if `SESSION_SECRET` is unset in production.
- **Rate limiting** (`lib/rate-limit.ts`): in-memory fixed-window limiter on the name sign-in (15 / 10min
  / IP) and OAuth start. ⚠️ single-instance only — swap the Map for Redis/KV on a multi-instance deploy.
- **Google OAuth seam** (`lib/oauth.ts` + `/api/auth/google` + `/callback`): standard auth-code flow with
  a CSRF `state` cookie. **Inert without `GOOGLE_CLIENT_ID`/`SECRET`** (button hidden, routes redirect to
  `/me?auth=google_unconfigured`). `repo.findOrCreateOAuthUser` links a Google identity (provider+sub) to
  one account; `User.oauth`/`User.email` added. Verified: configured initiate → correct
  accounts.google.com redirect + state cookie; CSRF guard rejects forged state. Token exchange is the
  only untested bit (needs real creds).
- **To activate Google** (see `.env.example`): create a Web OAuth client, set redirect URI
  `https://<domain>/api/auth/google/callback`, set `GOOGLE_CLIENT_ID`/`SECRET` + `NEXT_PUBLIC_SITE_URL`.
- **Deferred:** phone OTP / TOTP 2FA (the `User` shape can carry it), account linking UI, and the real
  trust/anti-Sybil ledger — next layer once a provider's chosen.

## Update — visual overhaul + dish-seed expansion (2026-05-30, autonomous)

**Visual / "feel" overhaul** (you flagged the map + category browsing as not beautiful):
- **Maps** (`MapView.tsx`, `CityMap.tsx`, new `src/lib/mapStyle.ts`): replaced the busy keyless OSM
  raster with **CARTO Positron** — a clean, muted basemap (the look The Infatuation / Eater maps use),
  keyless + free with attribution. Pins are now **teardrop markers with a gold/silver/bronze podium**
  for the top 3, coral for the rest; rounded-2xl containers + soft shadow. Production still overrides
  via `NEXT_PUBLIC_MAP_STYLE`. ⚠️ Gotcha fixed: a `glyphs: undefined` field silently failed MapLibre
  style validation → blank basemap. Don't reintroduce it.
- **Category hub** (`/nyc`): empty bordered boxes → **emoji-hero cards on warm per-cuisine gradients**
  with a "N ranked" pill and a **#1-pick preview** ("#1 Burrata Slice · L'Industrie"). Enriched
  `listCategories` with `topTitle`/`topPlaceName` to power it.
- **Ranked lists** (`BrowseView.tsx`): **gold/silver/bronze medallion rank badges** for the podium;
  rounded-2xl rows with hover-lift.

**Dish-seed expansion** (your call: scale the curated seed with signature dishes, not full-menu scrapes):
- Decided AGAINST mass menu-scraping — it fights the project's "place×dish = user-generated only"
  design + legal posture, and floods the board with zero-vote, mostly-uncategorizable noise. Instead:
  **place-first, signature dish only, from 2025+ editorial best-of lists, our own consensus order.**
- **`scripts/seed_merge.py`** — reusable: dedupes by name, geocodes by NYC neighborhood centroid
  (approximate, `geocoded:false`; real coords refine via the Census pass), appends to `real-<slug>.data.json`.
  Ranking comes from `seedQuality` (seed duels), not file order, so appending is safe.
- **Phase 1 (committed):** hand-ran the method on 2 samples → tacos 22→28, KFC 5→6. Verified the
  merge → `npm run seed` → store pipeline end-to-end (368 contenders).
- **Phase 2 (workflow `wudkbkqar`, COMPLETE):** all 21 categories, each through a research pass + a
  **skeptical verify pass** (`scripts/seed-expansion.workflow.js`). 42 agents, ~11 min. Hard rules per
  agent: **2025+ editorial sources only** (Infatuation, Eater NY, Time Out, NYT, MICHELIN, Resy, Grub
  Street, LO Times, Portnoy's One Bite, Sietsema), **Yelp/TripAdvisor/Reddit/SEO blogs forbidden**.
  Date-gating proved itself: Time Out's taco list (Aug 2024) was correctly excluded.
  - **Result: 368 → 577 contenders (+209 net).** Rich categories ballooned (ice-cream +35, cheeseburger
    +34, pizza +24, bagels/steak/bacon-egg-cheese +18); thin ones barely moved (chopped-cheese +0,
    lobster-roll +0, b&w cookie +1, KFC +2) — the honest map of where **user-generated growth** must
    carry the category post-launch, not a bug.
  - **Defense-in-depth caught 2 leaks** the verify pass missed: a post-merge `appearsOn` audit flagged
    `8it.world` (aggregator) and `r/FoodNYC crowd consensus` (Reddit). Scrubbed everywhere: 13 entries
    kept (had other valid sources), 5 pastrami-only-on-8it dropped (Junior's, Mendy's, etc.). Final
    data: **0 forbidden sources, 0 pre-2025 cites**, all entries titled + geocoded.
  - **Reusable scripts:** `scripts/seed_merge.py` (dedupe + neighborhood geocode), `apply_expansion.py`
    (merge-all + report). Coords are neighborhood-approximate (`geocoded:false`) pending a Census pass.

## Update — category onboarding, adaptive ranking & category-scoped trust (2026-05-30)

**Category onboarding (`CategoryOnboarding.tsx`).** On a food-type page, a signed-in user without a
declared favorite gets a hero CTA → a 2-step sheet: (1) pick your #1 from the community top-20 (or
search/add any NYC restaurant), (2) check which other top picks you've actually tried. Completing it
saves `categoryFavorites[sub]` and launches an adaptive duel session seeded with those tried dishes.

**Adaptive binary-search ranking (`DuelBoard.tsx`).** Instead of comparing every tried dish against
every other, the board inserts each one into the user's growing personal order via binary search —
first comparison is always against their declared favorite, each answer halves the remaining range.
~`log2(n)` comparisons per item instead of `n`. The session still POSTs every comparison to
`/api/duel` (so the global model sees them); it just *chooses* the next pair locally for efficiency.
Ends on a "Your {food} ranking" recap + big "Add more dishes from {place}" / "see the full ranking" CTAs.

**Big add-dish CTAs.** `AddPlace`, the onboarding trigger, and the post-session prompts are all now
full-width hero cards (emoji + bold headline + filled button), not small dashed links. Adding dishes
is the core contribution loop, so it reads as the primary action everywhere.

### How personal rankings feed the global ranking (the math)

There is **no separate "personal ranking" object that gets merged in.** Every comparison a user makes —
adaptive onboarding, free duels, thumb votes — is one append-only `Comparison` row
`(winnerId, loserId, userId, weight, subcategory)`. The global **weighted Bradley-Terry** solver
(`recomputeSubcategory`) fits a latent strength θ per contender over the *entire* comparison graph for
that food type. Transitivity is recovered automatically: lots of A>B and B>C implies A>C even if few
people compared A and C directly — that's the whole point of BT vs. star averages. Each comparison's
pull on the fit is its `weight` (below). So the global order *is* the trust-weighted aggregate of
everyone's real pairwise judgments, and the adaptive session is valuable precisely because it produces
**high-signal** comparisons (dishes the person actually ate, spaced to be maximally informative).

### Category-scoped trust (replaces global-only trust weighting)

- **Per-category trust** (`User.categoryTrust[sub]`), starting from the global `trustScore` (0.1 for new
  users) and growing **linearly +0.01 per comparison in that category**, until a cap.
- **Caps:** normal users cap at **0.7** (`TRUST.NORMAL_CAP`); curator-designated **community members**
  ("category experts", `User.categoryRoles[sub] = "member"`) cap at **1.0** (`TRUST.EXPERT_CAP`).
  The cap is enforced at read time, so revoking a role instantly lowers influence but preserves the
  earned value for re-promotion.
- **Weight mapping** (`trustToWeight`, unchanged): `0.2 + 2.8·trust^1.5`. So a maxed normal user ≈ **1.84**,
  a category expert ≈ **3.0** (the full `W_MAX`), a brand-new user ≈ **0.29**. Expertise is *bounded and
  local*: a ramen expert's ramen vote is worth ~10× a newcomer's and ~1.6× a maxed casual — but their
  pizza vote is capped at 0.7 like everyone else's unless they're also a pizza member.
- **Assignment:** curator-only via `POST /api/category/role` `{ targetUserId, sub, role }` →
  `repo.setCategoryRole` (enforces `isCurator`). No self-promotion.

**Open question for you:** is the expert-vs-maxed-casual gap (3.0 vs 1.84, ~1.6×) strong enough, or do
you want experts to dominate harder (e.g. raise `W_MAX`, or lower `NORMAL_CAP` to ~0.5)? Easy to retune
in `config.ts`.

## Update — morning session (2026-05-29)

- **Home rotating Top-10 widget** added (right of the hero): auto-cycles all 22 food types, each
  showing its top 10. (`src/components/RotatingTopList.tsx`, `repo.getHomeShowcase`.)
- **Real NYC ramen seed ingested.** A 6-source research pass (Infatuation, Eater, MICHELIN, NYT, Time
  Out, crowd) → a 22-shop consensus ranked by how many lists feature each (Ivan Ramen 5×, Okiboru /
  Tonchin 4×, …). `/nyc/ramen` now shows real shops with real addresses; each carries a "Seed informed
  by: …" credit. Order is our own consensus synthesis (NOT a copy of any list) and is overwritten by
  user duels. Coords are neighborhood-approximate pending Overture reconciliation.
  Files: `src/seed/real-ramen.ts` + `real-ramen.data.json`; ramen branch in `src/seed/placeholder.ts`.
- **Same pattern repeats per food type** when you want it (pizza, tacos, soup dumplings…): research →
  consensus seed → swap in.

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
