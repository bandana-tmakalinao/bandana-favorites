# Menu ingestion — how we add a ton of restaurants + menus

*Plan + the infrastructure that's already built. Last updated 2026-05-31.*

## The goal
Get *many* more restaurants and their dishes into Bandana Faves, in the right food categories, so
every category has real depth. New dishes are **unranked** (score 0) until they earn their way into
the **top 100** through duels/ratings — exactly the model the founder asked for, and exactly what
ranking v2 now does.

## What's built (this branch)
- **`importMenu()`** (repo) — bulk-adds `place × food-type × dish` rows. Resolves/creates the place
  once, dedupes each dish through the fuzzy match engine, and lands every dish **unranked** (`score
  0`, `standing "new"`). Recomputes the touched categories.
- **`POST /api/admin/import-menu`** — moderator-gated, ≤100 items/call.
- **`/admin/import`** — paste a `food-slug | Dish | optional description` block, preview the valid
  count, import. Per-item added/skipped report.

This is the durable, safe spine: a human-in-the-loop importer. Everything below is how we *feed* it.

## Why not auto-scrape thousands of menu sites unattended
Three hard reasons (the founder asked me to grab menus from each top restaurant's site via Chrome):
1. **Reliability.** Restaurant menus are PDFs, JS-rendered Toast/Square/BentoBox widgets, images, or
   third-party (Yelp/Google) embeds. A blind scrape yields garbage as often as data; it needs
   eyes-on per site. Doing thousands unattended while no one can catch errors would pollute the
   public catalog.
2. **Legal.** `docs/data-sourcing-research.md` is explicit: there is **no legally storable
   third-party place×dish source**. Menus must be entered as our own/user-generated data, and we
   must **never** persist Google/Yelp content. A bulk scraper that hoovers menu text from aggregators
   crosses that line.
3. **Local Chrome stability.** Driving the founder's actual Chrome through hundreds of sites risks
   crashing it (a known constraint). Not something to run unattended overnight.

So the right shape is: **assisted import**, not autonomous scrape. The importer is the safe sink; we
fill it deliberately.

## The ramp (recommended order)
1. **Top-list restaurants first (highest value).** For each restaurant already in a Top-10, add the
   2–5 *other* signature dishes it's known for (a Katz's that's #1 in pastrami also has a great
   hot dog, matzo ball soup…). Source: the restaurant's own site, read with eyes-on. This deepens
   the catalog with high-confidence places we already trust. ~50 restaurants × ~3 dishes ≈ 150 new
   unranked contenders — a strong, safe first wave through `/admin/import`.
2. **DOHMH corpus is already loaded** (`.data/nyc-corpus.json`, ~13.6k NYC places). These are
   *places* with no dishes yet. The importer can attach dishes to any of them by `corpus_*` id, so
   "find any NYC restaurant → add its dishes" already works in the add flow and the importer.
3. **Overture enrichment** (specced in data-sourcing-research §3) gives finer cuisine taxonomy +
   websites for those corpus places — the input that lets us *target* which places to import menus
   for, by category.
4. **Menu-photo pipeline (deferred, designed).** The scalable version: a restaurant or user snaps a
   menu photo → vision model extracts dish names → fuzzy-match into the category vocabulary → stage
   in a review queue → moderator approves into `importMenu`. Source is user/restaurant-submitted
   photos, never scraped Google content. This is the eventual "ton of menus" engine; the importer
   API it would call already exists.

## Operating rules
- Imported dishes are **unranked at 0** and must earn rank — no imported ratings, ever.
- Dedupe is structural: a place is reused by name+proximity; a dish dedupes via the match engine, so
  re-imports are idempotent-ish (same dish → skipped).
- Moderators only (`/admin/import`), because it writes the public catalog.
- Keep `seedSources` empty for menu imports — those are *menu presence*, not editorial endorsements.
  Editorial weight stays with the curated 2025+ best-of seed (the publication 50% share).

## Related
- [ranking-v2](./architecture/ranking-v2.md) — why new items start at 0 and how they climb.
- [data-sourcing-research](./data-sourcing-research.md) — the legal verdicts this plan honors.
- [add-and-curation](./architecture/add-and-curation.md) — the user-facing add flows + review queue.
