# Domain model & view models

*Canonical "what are the types" reference — the persisted entities, the view models the UI consumes, and why the atomic unit is the contender = (place × food type). Last updated 2026-05-31.*

## Status

Built. The persisted entities (`src/lib/types.ts`) and the read-side view models / `Repository` interface (`src/db/repo.ts`) are stable and used end-to-end by both the memory and Postgres repos. A few fields are reserved/scaffold-only: `Contender.dishVariantId` (per-named-dish granularity, unused), `User.emailVerified` (email-confirmation flow not built), `Photo.placeholder` (no placeholder images are shipped). Everything else is live.

## Where it lives

| File | Role |
|------|------|
| `src/lib/types.ts` | Persisted domain entities (`Region` … `Photo`), `StoreData` (the whole store), and the three view models that ship with the types (`ContenderView`, `RankedList`, `CategoryWithSubs`). |
| `src/db/repo.ts` | The rest of the view models (`ShowcaseEntry`, `ContenderDetail`, `ProfileView`, …), `CategoryStanding`, and the `Repository` interface that returns them all. |
| `src/lib/config.ts` | `CategoryKind`-adjacent enums: `ConfidenceTier` (used by `ContenderView.tier`) plus the `RANKING`/`TRUST` constants that produce the materialized fields. |
| `src/lib/ranking.ts` | Writes the materialized ranking state on `Contender` (`theta`, `rd`, `score`, `sortKey`, …). NB: there is no `scoring.ts` — the math is here. |

Domain types are the source of truth and persist to `.data/store.json`; view models are derived, denormalized read shapes built per UI surface (they flatten FKs so React never joins).

## How it works

### Core entities (`src/lib/types.ts`)

`ID` and `ISODate` are both `string` aliases. Geo is stored as plain `lat`/`lng` numbers (no PostGIS — see [data-layer](./data-layer.md)).

- **`Region`** — `{ id, slug, name, center: {lat,lng} }`. Geographic scope. Currently one region (NYC); `regionId` is stamped on every `Contender`/`Comparison` for future multi-city.
- **`Category`** — `{ id, slug, name, kind, emoji, sort }`. The top-level food grouping. `kind: CategoryKind = "cuisine" | "format" | "dessert" | "drink"` is the discriminator that lets all food types share one taxonomy.
- **`Subcategory`** — `{ id, categoryId, slug, name, emoji, blurb }`. **The actual "food type" you rank** (Ramen, Pizza, …). `slug` is **globally unique** and routes as `/nyc/<slug>`. This — not `Category` — is what a ranked list is keyed on.
- **`Place`** — `{ id, name, neighborhood, borough, address, lat, lng, corpusId?, status? }`. A physical restaurant. `corpusId` links back to the 13.6k NYC corpus entry for re-add dedupe; `status: "active" | "proposed"` ("proposed" = user-suggested, awaiting curator approval).
- **`Contender`** — **the atomic unit** = a place's offering within one subcategory ("Ichiran's ramen"). Identity: `placeId` × `subcategoryId` (+ `regionId`). Display: `title` (the FOOD — clean dish name, the headline), `description` (verbose specifics, the subtitle). Provenance: `seedSources[]`, `createdBy`, `createdAt`. Plus **materialized ranking state** (below).
- **`User`** — `{ id, handle, name, trustScore (0–1), ratedCount, isCurator, createdAt }` + profile fields (`bio`, `avatarUrl`, `showcase[]`, `pinnacle: ID[]`, `categoryFavorites: subSlug→contenderId`) + **per-category trust** (`categoryTrust: subSlug→0–1`, `categoryRoles: subSlug→"member"`) + auth (`email`, `passwordHash` scrypt `s1$…`, `emailVerified`, `oauth: {provider,sub}`). Per-category trust caps at `TRUST.NORMAL_CAP` (0.7), or `EXPERT_CAP` (1.0) with a curator-granted `"member"` role.
- **`Comparison`** — append-only settled duel: `{ id, subcategoryId, regionId, userId, winnerId, loserId, source, weight, createdAt }`. `source: ComparisonSource = "duel" | "up" | "down"` — up/down votes are **also** materialized here as baseline-anchored comparisons at recompute. `weight` is the trust-weight snapshot at cast time.
- **`Vote`** — a user's 0–100 "how good is it" rating on one contender (one per user per contender): `{ id, contenderId, userId, rating, weight, createdAt }`. `rating` 50 = neutral; folded into the model as a weighted baseline comparison (not a separate tally).
- **`Photo`** — `{ id, contenderId, uploaderId, url, status, vouchCount, placeholder, createdAt }`. `status: "pending" | "verified" | "rejected"`; `vouchCount` drives peer verification.

### Materialized ranking state on `Contender`

These fields are **denormalized onto the row** by `src/lib/ranking.ts` so a ranked list is one `ORDER BY sortKey` — no join-time recompute. Recomputed per food type right after each duel/vote:

- `theta` — Bradley-Terry latent strength.
- `rd` — rating deviation (Glicko-style confidence; shrinks with evidence).
- `weightedVotes` — `v`, trust-weighted evidence volume; gates eligibility (`RANKING.MIN_WEIGHTED_VOTES = 3`).
- `comparisonCount` / `distinctOpponents` — raw duel count and distinct opponents (`MIN_DISTINCT_OPPONENTS = 2` gate).
- `score` — the displayed **0–100**, NOT raw `theta`: z-normalize θ in-category → logistic with `HARSHNESS = 2.2` → Bayesian shrinkage toward the category mean (`SHRINKAGE_M = 6`).
- `sortKey` — `score` minus an LCB penalty (`score − LCB_LAMBDA·rd`); **what lists actually sort by**, so a proven dish outranks an uncertain maybe-great one.
- `status: "provisional" | "active" | "hidden" | "proposed"` — eligibility/visibility state (distinct from the displayed `tier`).

See [ranking-engine](./ranking-engine.md) for the full math.

### `StoreData` — the whole store

```ts
interface StoreData {
  version; generatedAt;
  regions; categories; subcategories; places;
  users; contenders; comparisons; votes; photos;
}
```

One array per entity plus a `version`/`generatedAt` header. This is exactly the JSON the memory repo serializes to `.data/store.json`, and the shape `PgRepository` loads into memory at boot.

### View models & which getter returns each

`ContenderView` is the load-bearing UI shape — it flattens place + category onto a contender and adds a computed `rank` and the display `tier: ConfidenceTier` ("provisional" | "rising" | "established", from `config.ts`). Note `ContenderView` carries `score`/`weightedVotes`/`comparisonCount` but **not** `theta`/`rd`/`sortKey` — those stay server-side. Most other view models embed or extend it.

| View model | File | Returned by | Shape / purpose |
|------------|------|-------------|-----------------|
| `ContenderView` | types.ts | (embedded everywhere) | Flattened contender: `id, placeId, rank, title, description, placeName, neighborhood, borough, lat, lng, score, tier, weightedVotes, comparisonCount, photoUrl, seedSources`. |
| `RankedList` | types.ts | `getRankedList(subSlug)` | A "best X in NYC" list: `region, category, subcategory, ranked[]` (eligible/ordered) + `contenders[]` (the provisional shelf). |
| `CategoryWithSubs` | types.ts | `listCategories()` | `{ category, subcategories: (Subcategory & {contenderCount, topPhotoUrl, topTitle, topPlaceName})[] }` — the taxonomy tree + hub-card previews. |
| `ContenderDetail` | repo.ts | `getContenderDetail(id)` | One dish page: `contender, category, subcategory, place, photos[], neighbors[]`. |
| `DuelPair` | repo.ts | `getDuelPair(subSlug?, keepId?, prefer?)` | `{ category, subcategory, a, b }` — the two `ContenderView`s to duel. |
| `ShowcaseEntry` | repo.ts | `getHomeShowcase(perCategory?)` | Home grid per food type: `slug, name, emoji, categoryName, items[]` (top N). |
| `SearchResults` | repo.ts | `search(q, limit?)` | `{ query, subcategories[], contenders: SearchHitContender[] }` (`SearchHitContender` = `ContenderView` + `subSlug`/`subName`). |
| `PlaceHit` | repo.ts | `searchPlaces(q, subSlug)` | Add-under-a-food-type autocomplete: `id, name, address, borough, source: "corpus"\|"place", existingDishes[]`. |
| `PlaceSearchHit` | repo.ts | `searchAllPlaces(q)` | Category-agnostic restaurant-first autocomplete: adds `neighborhood`, `dishCount`. |
| `PlaceDetail` | repo.ts | `getPlaceDetail(placeId)` | Restaurant page: a flat `place` (+ `isProposed`, `inCorpus`), `dishes: PlaceDishView[]` (every dish across food types), `categories` (the add picker). |
| `ProposedItem` | repo.ts | `listProposed()` | Curator review row: `contenderId, title, placeName, address, borough, subSlug, subName, proposedBy, possibleDuplicate?`. |
| `PinnacleItem` | repo.ts | (in `ProfileView`) | `ContenderView` + `subSlug`/`subName`/`emoji` — an all-time-favorite entry. |
| `ProfileView` | repo.ts | `getProfile(handle)` | Public profile: `handle, name, bio, avatarUrl, trustScore, ratedCount, pinnacle[], topPicks[]` (gold #1 per showcased food type), `showcase[]`. |
| `CategoryStanding` | repo.ts | `getCategoryStanding(userId, subSlug)` | Live trust meter: `{ trust, cap, role, weight }` — effective per-category trust, its cap, role, and resulting BT vote weight. |

A user's personal ranking comes back as a bare `ContenderView[]` from `getPersonalRankedList(userId, subSlug)`.

## Key decisions & why

- **Atomic unit = contender = (place × food type), not the place.** A restaurant appears once per dish it's known for; "best ramen" ranks ramen-contenders, never restaurants. The product's whole thesis (food is the headline, place is the subtitle). See [OVERVIEW](../OVERVIEW.md) §2.
- **Ranking keyed on `Subcategory`, not `Category`.** The route is `/nyc/<subcategory.slug>`. `Category.kind` exists only to group the taxonomy uniformly across cuisine/format/dessert/drink — it is not a ranking axis.
- **Ranking state materialized on the row.** `theta/rd/weightedVotes/.../score/sortKey` are denormalized so lists are a single `ORDER BY sortKey` and recomputed only on a settled duel/vote.
- **`score` is deliberately harsh and ≠ `theta`.** Logistic with `HARSHNESS = 2.2` + Bayesian shrinkage (`SHRINKAGE_M = 6`) so small-sample hype can't top a list; lists sort by `sortKey` (LCB), not raw score.
- **Votes are comparisons, not a tally.** A 0–100 `Vote` is folded in as a weighted baseline-anchored `Comparison` at recompute (`source: "up"/"down"`), keeping everything in one Bradley-Terry model — order-independent and hard to game.
- **View models flatten FKs.** Repo returns display-ready shapes (`placeName`, `categoryName`, `tier`) so the same contract holds across the memory and Postgres repos and React never joins.
- **Deliberately NOT done:** `dishVariantId` (per-named-dish split), `emailVerified` flow, and placeholder photos are reserved fields only. No PostGIS geo type (plain lat/lng).

## Gotchas

- **`Contender` (persisted) ≠ `ContenderView` (UI).** `Contender` has `theta/rd/sortKey` but no `placeName/rank/tier`; `ContenderView` is the inverse. Don't pass one where the other is expected.
- **Two "status" enums and two "tier"-ish concepts.** `Contender.status` ("provisional|active|hidden|proposed") is eligibility/visibility; `ContenderView.tier` (`ConfidenceTier`: "provisional|rising|established") is the displayed confidence badge. Also `Place.status` is "active|proposed". They're independent.
- **Lists sort by `sortKey`, not `score`.** Sorting a `ContenderView[]` by `score` will not match the canonical order (which subtracts the LCB penalty). `rank` is computed at query time and is `null` outside an ordered list.
- **`score` is derived; never write it directly.** It (and `sortKey`) must come from a `ranking.ts` recompute after the comparison/vote — setting it without updating `theta/rd` desyncs the row.
- **`weight` is snapshotted.** `Comparison.weight`/`Vote.weight` capture the caster's trust weight *at cast time*; later trust changes don't retro-edit them.
- **`StoreData` is the literal on-disk format.** Adding/renaming an entity array changes `.data/store.json` (and the PG load path) — bump `version` and coordinate with both repos.
- **`PlaceDetail.place` is a flattened inline shape**, not the `Place` entity (it adds `isProposed`/`inCorpus`, drops `corpusId`/`status`).

## Related

- [data-layer](./data-layer.md) — the `Repository` seam, `getRepo()` factory, memory vs. Postgres implementations of these getters.
- [ranking-engine](./ranking-engine.md) — the Bradley-Terry + trust-weight + shrinkage math behind the materialized fields.
- [match-and-dedupe](./match-and-dedupe.md) — `DishResolution`, the dish-name vocabulary, and place dedupe feeding `corpusId`.
- [OVERVIEW](../OVERVIEW.md) — system-wide context and the two product bets.
