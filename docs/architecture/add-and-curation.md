# Adding data & curation

*How users add a (place × food type) contender — restaurant-first or category-first — with structural dedupe and a curator review queue for off-corpus places. Last updated 2026-05-31.*

## Status

Built and working on the local seed. Three add entry points (`/add`, `/p/[placeId]`, category-first `AddPlace`) all funnel into `POST /api/contenders/add`; corpus places materialize on first add with name/proximity twin-dedupe; off-corpus suggestions go to a working review queue at `/review`. Curator gating is *intentionally* open to any signed-in user in the scaffold (production gates on a curator role — see Gotchas).

## Where it lives

| File | Role |
| --- | --- |
| `src/app/add/page.tsx` | `/add` — RSC page; restaurant-first global search shell, optional `?sub=` carries a food type |
| `src/components/PlaceFinder.tsx` | Client search box on `/add`; hits `GET /api/places/all`, routes to `/p/[placeId]` |
| `src/app/p/[placeId]/page.tsx` | Restaurant page (RSC); lists all dishes logged there, renders `AddDishHere` |
| `src/components/AddDishHere.tsx` | "Add a dish you had here" — pick food type → typed dish (live dedupe) → note |
| `src/components/AddPlace.tsx` | Category-first adder embedded on `/nyc/[sub]`; place search **or** suggest-new |
| `src/app/review/page.tsx` | `/review` curator page (RSC); renders `ReviewQueue` for signed-in users |
| `src/components/ReviewQueue.tsx` | Client: lists proposed items, approve/reject buttons |
| `src/app/api/contenders/add/route.ts` | `POST` — the single add endpoint → `repo.addContenderAtPlace` |
| `src/app/api/places/all/route.ts` | `GET ?q=` — category-agnostic place search → `searchAllPlaces` |
| `src/app/api/places/search/route.ts` | `GET ?q=&sub=` — category-scoped search → `searchPlaces` (with `existingDishes`) |
| `src/app/api/places/suggest/route.ts` | `POST` — submit off-corpus place → `suggestPlace` |
| `src/app/api/dishes/list/route.ts` | `GET ?sub=` — existing dish titles for autocomplete → `listDishNames` |
| `src/app/api/dishes/match/route.ts` | `GET ?sub=&q=` — live fuzzy resolution → `matchDish` |
| `src/app/api/review/route.ts` | `GET` proposed / `POST` approve|reject → `listProposed` / `reviewProposed` |
| `src/db/memory.ts` | All repo logic (search, materialize, suggest, review) — lines ~575–837 |

## How it works

**The atomic add unit is a contender = (place × food type).** Every flow ends at `POST /api/contenders/add` with `{ placeId, sub, title, description }`, which calls `repo.addContenderAtPlace(userId, placeId, subSlug, title?, description?)`. Returns `{ ok, contenderId, placeId }`; clients then `router.push("/c/" + contenderId)`.

### Restaurant-first (primary)
1. `/add` renders `PlaceFinder`. Typing (160ms debounce) hits `GET /api/places/all?q=` → `searchAllPlaces(q, 10)`, a **category-agnostic, fuzzy** search (`similarity()` base score + substring/startsWith/address boosts) over both materialized places (`source:"place"`, bar `s ≥ 0.5`) and the corpus (`source:"corpus"`, higher bar `s ≥ 0.62` so fuzzy noise doesn't flood). Each hit carries `dishCount`.
2. Click a hit → `router.push("/p/<encoded id>")` (optional `?sub=` preserved).
3. `/p/[placeId]` (`getPlaceDetail`) shows every non-hidden/non-proposed dish logged at that place across all food types (sorted by score), then `AddDishHere`: pick food type (grouped `<select>`) → type a dish → optional note. `?sub=` pre-opens the form on that food type (`initialSub`).

### Category-first (legacy, still live)
`AddPlace` is embedded on `/nyc/[sub]` ranked lists. Search mode hits `GET /api/places/search?q=&sub=` → `searchPlaces(q, sub, 8)`, **substring** name match scoped to one food type. It returns `existingDishes` (already-logged dishes of that sub at each place, shown as "rate →" chips) and sorts category-matching corpus hits (`cp.cats.includes(subSlug)`) first. Picking a hit always opens the dish form — a place can hold several dishes of one type. "Can't find it?" switches to suggest-new mode.

### Live dish dedupe (both flows)
As you type a dish (≥2 chars, ~200ms debounce), `GET /api/dishes/match?sub=&q=` → `matchDish` → `resolveDishName(query, dishTitlesIn(subId), sub.name)`. A non-identical `suggestion` renders a tappable hint: `"We already list this as …"` (decision `snap`) or `"Did you mean …?"` (decision `suggest`). `GET /api/dishes/list?sub=` → `listDishNames` feeds a `<datalist>` autocomplete. See [match-and-dedupe](./match-and-dedupe.md).

### Structural dedupe & materialization (`addContenderAtPlace`)
- A place is **always picked from the canonical corpus** or an existing materialized record — so two people logging "Joe's" land on the same place. Corpus hits carry `id = "corpus_<camis>"`.
- A `corpus_…` id resolves through `storePlaceForCorpus(cp)`, which **reuses an existing stored place** (including seeded real-data twins) rather than fragmenting; only if none exists is a fresh `Place` (`crypto.randomUUID()`, `corpusId: cp.id`, `status:"active"`) pushed. So a corpus restaurant materializes into a real record **lazily, on first add**.
- **Twin dedupe in search:** `searchAllPlaces`/`searchPlaces` use `corpusTwinChecker()` to skip corpus rows already represented by a stored place (by normalized name + proximity), so a restaurant never appears twice. The proximity/twin logic lives in `memory.ts` helpers — see source.
- **Title resolution is defensive on the server:** `resolveDishName(title, …).name` runs again at insert even if the client ignored the hint, so a `snap` collapses to the canonical name.
- **Idempotent insert:** if a non-hidden contender already exists with the same `placeId` + `subcategoryId` + `normalizeName(resolvedTitle)`, it returns that one (no duplicate). Otherwise a new `Contender` is created `status:"provisional"`, `score:50`, `theta:0`, `rd:350`, then `recomputeSubcategory(...)` runs. (A place holds many dishes of one type — only re-adding the *same* dish dedupes.)

### Off-corpus suggestion → review queue
- `POST /api/places/suggest` → `suggestPlace`. Creates a `Place` with `status:"proposed"` (lat/lng = `region.center` — **not geocoded**) plus a `proposed` contender whose title defaults to `sub.name`. Does not rank.
- `/review` → `ReviewQueue` → `GET /api/review` → `listProposed()`: every `proposed` contender, each annotated with `possibleDuplicate` if its place name's `similarity()` to any non-proposed place ≥ `MATCH.PLACE_DUP` (0.8) — a curator dedupe aid.
- Approve/Reject → `POST /api/review` → `reviewProposed(contenderId, approve)`:
  - **Approve** → contender `status:"provisional"`, its place flipped `proposed → active`, `recomputeSubcategory(...)`.
  - **Reject** → the contender is **deleted** from the store; the place is also deleted if it has no other contenders.

## Key decisions & why

- **One write path (`addContenderAtPlace`).** All three UIs hit the same endpoint, so materialization, twin-dedupe, title-snap and idempotency live in exactly one method (`src/db/memory.ts`).
- **Restaurant-first is primary** because people think "I had an amazing X at Joe's," not category-first (OVERVIEW §6). Category-first was kept, not removed.
- **Lazy materialization.** The 13.6k corpus is never bulk-copied; a place becomes a real record only when someone logs a dish there — keeps the store small and dedupe-clean.
- **Two-layer dish dedupe** — live hint *and* defensive server snap — so the vocabulary stays clean even if the client hint is ignored or raced.
- **Twin reuse over forking** (`storePlaceForCorpus`) so seed + corpus + suggestions for the same restaurant don't split. The high-severity bug the adversarial review caught (OVERVIEW §10) was in this dedupe path.
- **Deliberately NOT done:** suggested places are not geocoded (default to region center); no rate limiting on search endpoints (only matters once deployed); no real curator-role gate yet.

## Gotchas

- **Curator review is wide open in the scaffold.** `requireReviewer()` in `api/review/route.ts` only checks sign-in; the comment and `/review` page copy ("Preview: open to any signed-in user … production gates on a curator role") flag the production gate as TODO.
- **All add/suggest/review writes require auth** — endpoints 401 without `getCurrentUser()`. Search and `dishes/*` endpoints are public.
- **Mixed search strategies.** `searchAllPlaces` (`/add`) is fuzzy via `similarity()`; `searchPlaces` (category-first) is plain `.includes()` substring. Don't assume both are typo-tolerant.
- **Corpus IDs are synthetic** (`corpus_<camis>`) — `PlaceFinder` URL-encodes them; `getPlaceDetail`/`addContenderAtPlace` branch on the `corpus_` prefix and resolve via `storePlaceForCorpus`.
- **Reject is destructive.** `reviewProposed(_, false)` *deletes* the contender (and an orphaned place) — there is no `rejected` status retained for proposed items; it's a hard remove.
- **`/p/[placeId]` can render an un-persisted corpus place.** If a corpus restaurant has no stored twin and no dishes, `getPlaceDetail` returns a synthetic place view (`inCorpus:true`) so you can still open it and add the first dish.
- **Proposed places leak into the detail page only.** `/p/[placeId]` shows an "awaiting curator review" banner via `place.isProposed`, but proposed places/contenders are filtered out of every search and ranked list.
- **Suggested place lat/lng are fake** (`region.center`) until a curator/geocoder fixes them — they'd render at the city centroid on the map.

## Related

- [match-and-dedupe](./match-and-dedupe.md) — `resolveDishName`, `similarity`/`normalizeName`, the `MATCH` thresholds (`SNAP` 0.88, `SUGGEST` 0.6, `PLACE_DUP` 0.8).
- [data-layer](./data-layer.md) — `Repository` interface, `memory.ts`, the corpus, `Place`/`Contender` types and the `status` lifecycle (`provisional`/`active`/`hidden`/`proposed`).
- [OVERVIEW](../OVERVIEW.md) — §5 (clean names) and §6 (adding data) for product context.
