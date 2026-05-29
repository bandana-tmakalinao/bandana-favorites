# Bandana Favorites — Project Overview

*A walkthrough of what this is, why it's built the way it is, and where it stands. Last updated 2026-05-29.*

---

## 1. The one-sentence pitch

**Bandana Favorites ranks food, not restaurants.** You don't browse "restaurants near me" — you browse a
*dish*: "best ramen in NYC" returns an absolute, community-built ranked list of ramens, where the **food
is the headline and the place is the subtitle**. The order is earned through trust-weighted head-to-head
comparisons, not star averages or mass voting.

## 2. Why it's different (the two bets)

Every other food app ranks **places** by **averaging stars**. We made two deliberate, opposite bets:

1. **The ranked unit is the food, not the place.** A restaurant isn't "good" or "bad" — its *pastrami* is
   transcendent and its *coffee* is forgettable. So the atomic thing we rank is a **contender = (place ×
   food type)**: "Katz's pastrami on rye," not "Katz's." One restaurant can appear in many lists, once per
   dish it's known for. (Minetta Tavern shows up under burgers, steak, *and* lobster roll.)

2. **Ranking comes from comparisons, not votes.** "Rate this 4 stars" is noisy and inflationary —
   everything drifts to 4.3. Instead the primary signal is a **duel**: *"Which is better, this ramen or
   that one?"* Pairwise preferences are far more reliable than absolute scores, and they feed a real
   ranking model (Bradley-Terry) instead of an average. A 0–100 rating still exists, but it's folded into
   the *same* model as a weak comparison against the category baseline — never a separate tally.

The product's identity is the **honesty of the resulting order**: a harsh, confidence-aware ranking where
only genuinely great dishes break into the 80s, and a thin-but-promising contender is openly marked
"provisional" until the crowd has actually weighed in.

## 3. How the ranking works

All ranking math lives in exactly one place: **`src/lib/ranking.ts`**, tuned by **`src/lib/config.ts`**.

**Every signal becomes a weighted pairwise outcome.**
- A **duel** (A beats B) is a comparison with weight `w_u` (the rater's trust weight).
- A **0–100 rating** is folded in as a synthetic comparison against a virtual *category baseline*, with
  weight `|rating−50|/50 · w_u · THUMB_WEIGHT` (`THUMB_WEIGHT = 0.4` — a rating is weaker evidence than an
  explicit head-to-head). This keeps it order-independent and impossible to game as a raw count.

**Source of truth — weighted Bradley-Terry.** Each contender has a latent strength θ. We solve for θ
across all comparisons in a food type via MM (minorize-maximize) iterations, with a small regularizing
tie to a fixed baseline anchor so sparse contenders don't diverge. Recomputed per food type right after a
duel (cheap at this scale).

**The displayed 0–100 score is deliberately harsh.** We z-normalize each contender's θ within its category
(so the shape is consistent regardless of how compressed the strengths are), then push it through a
logistic: `score = 100 / (1 + e^(−HARSHNESS·z))`, with `HARSHNESS = 2.2`. Result: the *average* spot lands
near 50, the elite approach ~100, and weak spots sink low. Then **Bayesian shrinkage** (`SHRINKAGE_M = 6`)
pulls thin contenders toward the category mean until they've earned real volume.

**Confidence is shown, not hidden.** Each contender carries a Glicko-style rating deviation (RD) that
shrinks as evidence accumulates. Contenders surface through three honest tiers:
- **Provisional** — below the evidence gate (`MIN_WEIGHTED_VOTES`, `MIN_DISTINCT_OPPONENTS`); shown in a
  "contenders" shelf, not the ranked list.
- **Rising** → **Established** — past the gate, with RD crossing `RD_ESTABLISHED`.

Lists sort by a lower-confidence bound (`score − λ·RD`), so a proven-good dish outranks an uncertain
maybe-great one.

**Trust weighting** maps a user's trust (0–1) to a vote weight between `W_MIN` and `W_MAX` via
`trust^GAMMA`. New accounts start near `W_MIN` — so a fresh sock-puppet carries almost no influence.

> **Important honesty about the trust moat:** trust-weighting is a *steady-state* defense, not a day-1
> one. At launch every real user *also* has ~0 trust, so the math can't tell a real newcomer from a
> sock-puppet. The real day-1 defenses are **curator-seeded order**, **provisional gating** (broad,
> diverse, aged evidence before a rank locks), and **velocity-anomaly freezes** — the trust formula earns
> its keep later. The hooks exist; enforcement is intentionally light in the scaffold.

## 4. The data story (the genuinely hard part)

The central question was *"where do we get this data, legally and storably?"* The full research lives in
`docs/data-sourcing-research.md`; the load-bearing conclusions:

**Places — solved, two free + storable layers:**
- **NYC OpenData DOHMH** (restaurant inspection dataset) is the **canonical place list**: ~13,629 NYC
  establishments deduped by CAMIS, each with name, address, borough, exact lat/lng. Free, public, no use
  restrictions. Ingested by `scripts/ingest_corpus.py` → `.data/nyc-corpus.json`. This is what powers
  "find any NYC restaurant." *Caveat:* it's currently scoped to the ~30 cuisines that map to our food
  types, and its cuisine tags are coarse buckets, not menu data.
- **Overture Maps Places** (CDLA-Permissive / Apache / CC0) is the enrichment path — finer taxonomy,
  website, brand — kept in a separate side-table so its (lighter) obligations never touch canonical data.
  Wired in the research, not yet ingested.

**Hard "no" list (never store / never use to build our dataset):**
- **Google Places** — store *only* the opaque `place_id` for a live map/hours/deep-link veneer; never its
  names, ratings, reviews, or photos.
- **Yelp** — excluded entirely (terms forbid caching + a competing listings DB; their blended ratings are
  exactly what we replace).
- **Menu APIs** (Spoonacular, OpenMenu) — all forbid storing menus. Rejected.

**The structural truth about dishes:** there is **no legally storable source of dish-by-restaurant data
anywhere.** So the dish layer is split: a **generic dish-name vocabulary** can come from Wikidata (CC0) +
Overture subtypes, but the actual **"this place serves this dish" association is user-generated only** —
it accrues from people adding and duelling. This isn't a gap to fix; it's the design.

**The curated seed (what's live today):** a hand-researched, consensus-ranked seed of **361 dishes across
21 food types**, drawn *only from 2025+ best-of lists* (The Infatuation, Time Out, MICHELIN, NYT, Dave
Portnoy's One Bite for pizza; pre-2025 lists like older Eater rankings were explicitly dropped). Each seed
dish carries the lists it appears on as a "Seed informed by…" credit. **The order is our own consensus
synthesis, never a copy of any single list, and is overwritten by user duels.**

Coverage is honest about its skew: Manhattan is ~62% of the seed; thin food types are korean-fried-chicken
(5), black-and-white-cookie (5), chopped-cheese (6). Filling outer boroughs + thin types is a known next
lever.

## 5. Clean dish names + the dedupe engine

Menu-style dish names sprawl ("tonkotsu" vs "Tonkotsu Ramen" vs "pork bowl"). Two mechanisms keep the
vocabulary clean:

- **Clean titles + descriptions.** Every seed dish has a tidy menu-style **title** (Lucali → "Three-Cheese
  Pie," Katz's → "Pastrami on Rye") with the verbose detail moved to a **description** shown beneath it.

- **A fuzzy-match/dedupe engine** (`src/lib/match.ts`, fully unit-tested). The key trick: it **strips the
  category word** ("ramen," "pizza," "pie") before comparing, so the *distinctive* part drives the match.
  It blends distinctive-token overlap (Jaccard + containment) with edit distance over just those tokens.
  `resolveDishName()` then returns one of three decisions against the category's existing names:
  - **snap** (similarity ≥ `MATCH.SNAP` 0.88) → auto-merge to the canonical name ("tonkotsu" → "Tonkotsu
    Ramen").
  - **suggest** (≥ `MATCH.SUGGEST` 0.6) → offer it ("Margarita" → "did you mean *Margherita Pie*?") without
    forcing.
  - **new** → a genuinely distinct dish.

  This runs **live** as you type *and* **defensively on the server** at insert time, so the vocabulary
  stays clean even if the hint is ignored. The same engine flags likely-duplicate place suggestions for
  curators (`MATCH.PLACE_DUP`) and dedupes places at seed time.

## 6. Adding data (two flows, restaurant-first is primary)

Because people think **restaurant-first** ("I had an amazing X at Joe's"), the primary add path matches
that:

- **`/add`** — a global "find any NYC restaurant" search, fuzzy and typo-tolerant (reuses the match
  engine), backed by the 13.6k corpus.
- **`/p/[placeId]`** — a **restaurant page** listing every dish logged there across all food types, with
  **"Add a dish you had here"**: pick the food type → type the dish (with the live dedupe) → optional note.
  This is literally "add a dish to a restaurant."
- The **category-first** path still exists: from any `/nyc/[food]` ranked list you can add a place under
  that one food type.

Dedupe is structural: a place is always picked from the canonical corpus (or curator-approved if brand
new), so two people logging "Joe's" land on the same place. A corpus restaurant materializes into a real
record only on first add; seeded duplicates of the same restaurant are merged by name + ~250m proximity.
New places that aren't in the corpus go through a **curator review queue** (`/review`) before they rank.

## 7. Personal layer — profiles & Pinnacle

- **"Mine" vs "Overall"** — every food type can show the global ranking or *your own* ranking from your
  ratings and duels.
- **Public profiles** (`/u/[handle]`) — photo, bio, and a set of **showcased food types** (your personal
  rankings in those categories).
- **The Pinnacle** — a curated, ordered list of your **all-time favorite dishes**, cross-category (NYC for
  now). Pin a dish from its page; reorder on `/me`.

## 8. Tech stack & running it

Local-first by design — the whole loop runs with **zero environment variables and no cloud services**;
each layer flips to a production adapter purely by setting an env var.

| Concern | Local default | Production (env-gated) |
| --- | --- | --- |
| Data | in-memory + `.data/store.json` | Postgres + PostGIS via Drizzle (`DATABASE_URL`) |
| Map | keyless OSM raster | Protomaps PMTiles on R2 / MapTiler (`NEXT_PUBLIC_MAP_STYLE`) |
| Photos | local disk (`public/uploads`) | Cloudflare R2 presigned PUT (`R2_*`) |
| Auth | signed cookie ("pick a name") | Auth.js + OAuth + phone OTP |

Stack: **Next.js 15 (App Router) + TypeScript + Tailwind v4 + Drizzle**, styled to **bandana.com** (warm
cream, coral primary, yellow banner). Deploy target is **Render** (managed Postgres + PostGIS).

```bash
npm install
npm run seed     # writes the NYC seed to .data/store.json
npm run dev      # http://localhost:3000
npm test         # ranking + match engine unit tests (14)
```

## 9. Project structure (where things live)

```
src/lib/ranking.ts     # the ranking math — Bradley-Terry + shrinkage + harsh score (unit-tested)
src/lib/match.ts       # fuzzy-match/dedupe engine — normalize, similarity, resolveDishName (unit-tested)
src/lib/config.ts      # ALL tuning constants (RANKING, TRUST, MATCH) — one place
src/lib/types.ts       # core domain types (Contender, Place, Vote, User, …)
src/db/repo.ts         # Repository interface + getRepo() factory (caches on globalThis, HMR-safe)
src/db/memory.ts       # in-memory implementation (the local default)
src/db/store.ts        # load/save .data/store.json + the corpus
src/db/schema.ts       # production Postgres/PostGIS schema (Drizzle)
src/seed/              # the curated seed: placeholder.ts + real-*.data.json (21 food types) + real-data.ts
src/app/               # pages: / nyc/[sub] c/[id] duel add p/[placeId] me u/[handle] search map review
src/app/api/           # route handlers: auth duel vote photos search places/* dishes/* contenders/* …
src/components/        # BrowseView, DuelBoard, RatingControl, AddPlace, AddDishHere, PlaceFinder, …
scripts/               # seed.ts, recompute.ts, geocode.py (Census), ingest_corpus.py (DOHMH)
docs/                  # this file, data-sourcing-research.md, nyc-food-category-research-*.md
DECISIONS.md           # autonomous build log + open questions for the founder
```

## 10. Status — built vs. deferred

**Built and working (on the local seed):**
- The full loop: browse a food type → ranked list + map → duel (king-of-the-hill, winner stays) → score
  moves → 0–100 rate (gated by an "I've tried this" tap) → add photos → light sign-in.
- Real 2025+ seed for all 21 food types; rotating Top-10 home widget; instant search.
- Clean dish names + the fuzzy dedupe engine, wired into both add flows.
- Restaurant-first add + restaurant pages, backed by the 13.6k corpus; curator review queue.
- Personal "Mine" rankings, public profiles, the Pinnacle.
- bandana.com styling; no placeholder images (real photos are user-uploaded).
- 14 unit tests; every feature shipped behind an **adversarial multi-agent review** (the restaurant-first
  flow review caught a real high-severity dedupe bug before it shipped).

**Deferred (by decision):**
- **Menu-photo ingestion pipeline** — snap a menu → vision extracts dishes → fuzzy-match into the
  vocabulary. Designed; parked until dish volume justifies it. Source will be user/restaurant-submitted
  photos, never scraped Google content.
- **Hard anti-Sybil** — phone-OTP, full trust ledger, velocity/diversity gating, peer photo-verification.
- **Real-data ingestion at scale** — Overture enrichment, Wikidata dish vocabulary, broadening the corpus
  beyond the ~30 mapped cuisines.
- **Cloud provisioning** — Render Postgres, R2, deploy. Schema + adapters are ready; **not provisioned**
  (billable, awaiting go-ahead).
- **Rate limiting** on public search endpoints — only matters once deployed.

## 11. Roadmap — the next levers

1. **Broaden the directory** — drop the cuisine scoping / add Overture so *any* NYC restaurant is findable.
2. **Wikidata dish vocabulary** — give the matcher a real per-category backbone, not just seeded titles.
3. **Deepen the seed** — outer boroughs + thin food types.
4. **Menu-photo pipeline** — when volume warrants it.
5. **Deploy** — provision Render Postgres + R2, wire the `pg.ts` adapter (founder go-ahead required).

## 12. Operating constraints (how this project is run)

- **Local git only, no remote.** **Never push or send anything without explicit approval.**
- **No billable cloud infra** (Render/R2/etc.) without an explicit go-ahead — local-first is intentional.
- **2025+ sources only** for any seed ranking data; never copy a single publication's order; never seed
  order from Google/Yelp/scraped ratings.
- Substantial features get an **adversarial review pass** before they're considered done.

---

*See also: `README.md` (quick start), `DECISIONS.md` (build log + open questions),
`docs/data-sourcing-research.md` (the legal sourcing analysis), and the original build plan at
`~/.claude/plans/i-want-to-build-ancient-hamming.md`.*
