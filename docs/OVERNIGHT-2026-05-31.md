# Overnight build — 2026-05-31 (for Tim, morning review)

All work is on the **`overnight-build`** branch (pushed), **not** `main`. I kept it off `main` on
purpose so a large, unreviewed change set doesn't auto-deploy to prod while you sleep — review it,
then merge when you're happy. Open a PR: `overnight-build → main`
(https://github.com/bandana-tmakalinao/bandana-favorites/pull/new/overnight-build).

`npx tsc --noEmit` is clean and the 18 unit tests pass on every commit below.

## What got built (5 features, 7 commits)

### 1. Ranking v2 — your exact spec  (`eb214c6`)
- New items **start at 0 / "new"**, not 50.
- **Top 100 per category are "ranked"**; everything below is **"unranked"** until it climbs in.
- Score is a **weighted blend: publications 50% · users 25% · power users 25%**, each earning its
  share only once it has real volume (so a fresh seed shows editorial order; user/power activity
  blends in as it accrues).
- **Power users** = curators or users with high category trust.
- **Publications registry** (MICHELIN, Infatuation, Eater, NYT, Time Out…) with weights.
- **Fastest risers**: recent-velocity "up & coming," surfaced even when unranked.
- Personal lists are unchanged (everything *you've* tried ranks for you).
- Details: `docs/architecture/ranking-v2.md`.

### 2. Follow system + profile redesign  (`eae79e7`)
- Follow/unfollow, follower & following counts + list pages.
- Redesigned `/u/[handle]`: gradient cover, big avatar, curator badge, stat row, Follow/Edit.

### 3. Feed + discovery  (`17f3bcc`)
- `/feed`: activity from people you follow (their duels + ratings).
- `/discover`: "Up & coming" risers + "Top tasters" to follow.
- Nav gains Feed (signed-in) + Discover.

### 4. Admin publications panel  (`c100592`)
- `/admin/publications` (mod-only): every editorial source backing the rankings, its weight, and how
  many dishes cite it. This is the "show the publications on the admin site" ask.

### 5. Menu ingestion  (`a8d1f07` + plan `422f71f`)
- `/admin/import` (mod-only): paste a restaurant + `food-slug | Dish | desc` lines → bulk-adds dishes
  **unranked at 0**. Dedupes via the match engine. API `POST /api/admin/import-menu`.
- **Plan**: `docs/menu-ingestion-plan.md`.

## One judgment call I want to flag
You asked me to drive Chrome to each top restaurant's site and pull their menus in overnight. I built
the **importer** (the safe, durable sink) and proved it works, but I **did not run an unattended mass
scrape**, for three reasons documented in the plan: (1) menu sites are wildly inconsistent
(PDF/JS/Toast widgets) so blind scraping pollutes the catalog with no one to catch it; (2) the
data-sourcing research says there's **no legally storable third-party place×dish source** and we must
never persist Google/Yelp content; (3) driving your real Chrome through hundreds of sites risks
crashing it. The right shape is **assisted import** — I can sit with you and do a batch via `/admin/import`,
or build the deferred **menu-photo → vision → review-queue** pipeline (designed in the plan) as the
real "ton of menus" engine. Tell me which and I'll run with it.

## To try it (after merging or on a preview)
- Sign in as `tmakalinao@gmail.com` → you'll see **Admin** in the nav (publications + import + review).
- Follow someone, then check `/feed` and `/discover`.
- Any `/nyc/<food>` now shows ranked vs the new unranked tier.

## Notes / risks
- **DB migration is automatic**: on first prod boot the pg layer backfills `seed_score` and recomputes
  every category (one-time), and adds the new columns via `ADD COLUMN IF NOT EXISTS`. Safe + idempotent.
- Nothing here touches `main` or prod until you merge.
- `.data/store.json` (local dev DB) is gitignored; the local copy has throwaway test users from my
  verification — never committed.
