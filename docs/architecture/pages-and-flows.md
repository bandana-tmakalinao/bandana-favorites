# Pages, routes & user flows (the app map)

*The route inventory for Bandana Faves — every page, the core browse→duel→rate→add loop, the personal layer, and the API surface. Last updated 2026-05-31.*

## Status
Built. All routes below render against the local seed; the full primary loop (browse → ranked list/map → duel → rate → add) works end-to-end signed-in. Auth pages render even when OAuth is unconfigured (Google buttons gated by `isGoogleEnabled()`). `/review` is intentionally open to any signed-in user in the scaffold (curator-gated in prod). Photos/avatars store to local disk by default.

## Where it lives
All routes are App Router RSC pages under `src/app/` (each sets `export const dynamic = "force-dynamic"`). The core interactive loop lives in two client components.

| Path | Role |
| --- | --- |
| `src/app/layout.tsx` | Root shell: sticky header (logo, `SearchBar`, Explore/Map/Review/Sign-in nav, "Rank Food" CTA), yellow seed-disclaimer banner, footer. |
| `src/app/page.tsx` | Home `/` — hero + `RotatingCover` of `RankingCard`s; `getHomeShowcase(10)`, leads with `FEATURED = ["pizza","cheeseburger"]`. |
| `src/app/explore/page.tsx` | `/explore` — the full "NYC Food Power Rankings" wall; featured covers + cards bucketed by kind (Most Popular / Sweet & Sips). |
| `src/app/nyc/page.tsx` | `/nyc` — category hub grid; `listCategories()`, one tinted card per food type → `/nyc/[sub]`. |
| `src/app/nyc/[sub]/page.tsx` | `/nyc/[sub]` — the ranked list for one food type; renders `BrowseView` + favorite/onboarding banners + `AddPlace`. The product's center of gravity. |
| `src/app/c/[id]/page.tsx` | `/c/[id]` — contender (dish×place) detail: `ScoreBadge`, tier, seed credit, `RatingControl`, duel link, `PinButton`, `PhotoUpload`, neighbors. |
| `src/app/duel/page.tsx` | `/duel` — head-to-head; resolves searchparams into `DuelBoard` (random, king-of-hill, or adaptive). |
| `src/app/add/page.tsx` | `/add` — restaurant-first add; renders `PlaceFinder` over the 13.6k corpus. |
| `src/app/p/[placeId]/page.tsx` | `/p/[placeId]` — restaurant page; all dishes logged there + `AddDishHere`. |
| `src/app/search/page.tsx` | `/search?q=` — server-rendered results: food types + dishes/places via `repo.search(q, 40)`. |
| `src/app/map/page.tsx` | `/map` — citywide `CityMap`; top-6 per food type as colored toggleable layers (`LAYERS`). |
| `src/app/me/page.tsx` | `/me` — your profile editor, Pinnacle manager, trust readout, sign-in form. |
| `src/app/u/[handle]/page.tsx` | `/u/[handle]` — public profile: #1 Picks, Pinnacle, showcased categories. |
| `src/app/review/page.tsx` | `/review` — curator queue (`ReviewQueue`) for user-suggested places. |
| `src/components/BrowseView.tsx` | Client: Overall/Mine toggle + List/Map toggle for `/nyc/[sub]`; rows link to `/c/[id]`; provisional "Contenders" shelf. |
| `src/components/DuelBoard.tsx` | Client: the duel engine — king-of-the-hill + adaptive binary-search personal ranking + `TrustMeter`. |

## How it works

### The primary loop
**Browse → ranked list+map → duel → rate → add.** Entry points (`/`, `/explore`, `/nyc`, header search) all funnel to **`/nyc/[sub]`**, the absolute ranked list for one food type.

- **`/nyc/[sub]`** calls `getRepo().getRankedList(sub)` → `{ subcategory, category, region, ranked, contenders }`. `notFound()` if the slug is unknown. It passes `ranked` + `contenders` (provisional shelf) into **`BrowseView`**, plus `personal = getPersonalRankedList(user.id, sub)` when signed in.
- **`BrowseView`** has two toggles: `source` (Overall | Mine, only when `signedIn`) and `view` (List | Map, only in Overall). Map view lazy-loads `MapView` (`ssr:false`). Each `Row` is a `<Link href={"/c/"+v.id}>` with `RankBadge`, `ScoreBadge`, `ConfidenceDot`.
- **`/c/[id]`** (`getContenderDetail(id)`) is the dish page: score, tier banner ("Provisional — not enough trusted votes…"), `seedSources` credit, then the action row — **`RatingControl`** (the 0–100 rate, gated behind an "I've tried this" tap), a **Duel this** link → `/duel?sub=…&keep=<id>`, `PinButton`, `PhotoUpload`, and "Nearby in the ranking" neighbors.
- **`/duel`** is the comparison surface. `DuelPage` reads searchparams `{ sub, keep, tried, placeId, place }`, calls `getRepo().getDuelPair(sub, keep, prefer)`, and hands `DuelBoard` an initial pair + standing. See [duel & duel-board](#) detail below.
- **Add** is restaurant-first (see [Adding flows](#adding-flows)).

### DuelBoard — three modes
`DuelBoard` (client) drives the loop after the first server-rendered pair:
- **Random / king-of-the-hill** (default, from `/nyc/[sub]` "Rank these"): pick a winner → `POST /api/duel` records it → `data.next` rotates a fresh challenger in while the winner *stays* (`👑 N in a row` once `streak >= 1`). `swapChallenger()` and `newMatchup()` re-`GET /api/duel`.
- **Adaptive personal ranking** (when `keep` + `tried` IDs + `sub` resolve, i.e. from category onboarding): `initAdaptive(king, tried)` runs a **binary-search insert** of each tried dish into your personal order (`advanceAdaptive`/`placeTarget`, "Too close to call" = `resolveTie`). Header reads "Is it better than your #N?". On `done` it shows your ranking vs. crowd with a contrarian-ness summary (`avgDelta`).
- **`TrustMeter`** shows per-category standing (`getCategoryStanding`), animating up after each duel (`justGrew`), scaled against `TRUST.EXPERT_CAP` with a normal-user cap marker.

Each accepted duel still calls `POST /api/duel` regardless of mode (the binary-search is a client UX layer over real recorded comparisons).

### Adding flows
Two paths, restaurant-first is primary (see [OVERVIEW §6](../OVERVIEW.md)):
- **`/add` → `/p/[placeId]`**: `PlaceFinder` searches the corpus (`/api/places/search` + `/api/places/all`); picking a place opens its page. `AddDishHere` picks a food type, types the dish (live dedupe via `/api/dishes/match`), and `POST /api/contenders/add`.
- **Category-first**: `AddPlace` on `/nyc/[sub]` adds a place under that one food type; brand-new places go through `POST /api/places/suggest` → curator queue.

### Personal layer
- **Mine vs Overall** — the `BrowseView` `source` toggle renders `getPersonalRankedList` output.
- **`/me`** — `SignInForm`, `ProfileEditor` (name/bio/avatar/`showcase` categories), `PinnacleManager`, and a trust card (`user.trustScore`, `ratedCount`).
- **`/u/[handle]`** — public read via `getProfile(handle)`: gold **#1 Picks** (declared favorite per showcased category), **The Pinnacle** (ordered all-time NYC favorites, shareable), and showcased category rankings.
- **The Pinnacle** — cross-category favorites; pin from `/c/[id]` (`PinButton`), reorder on `/me` via `POST /api/pinnacle` (`add`/`remove`/`up`/`down`).

### API surface
All handlers under `src/app/api/*` are `runtime = "nodejs"`, `dynamic = "force-dynamic"`, and call `getRepo()`. Mutations require `getCurrentUser()` (401 otherwise).

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/auth` | GET, POST, DELETE | Current user / set name (cookie sign-in) / sign-out. |
| `/api/auth/login`, `/api/auth/register` | POST | Credential login / account creation. |
| `/api/auth/google`, `/api/auth/google/callback` | GET | OAuth start + callback (gated by `isGoogleEnabled()`). |
| `/api/duel` | GET, POST | GET next pair (`getDuelPair`); POST records a duel (`recordDuel`) → returns `next` (king-of-hill) + `standing`. |
| `/api/vote` | POST | Record a 0–100 rating (`recordVote`); returns updated `score`/`rank`. |
| `/api/contenders/add` | POST | Materialize a dish at a place under a food type (`addContenderAtPlace`). |
| `/api/places/search`, `/api/places/all` | GET | Fuzzy corpus search / full place list (powers `PlaceFinder`). |
| `/api/places/suggest` | POST | Propose a non-corpus place (`suggestPlace`) → review queue. |
| `/api/dishes/match` | GET | Live dish-name dedupe (`matchDish` → snap/suggest/new). |
| `/api/dishes/list` | GET | Dish vocabulary for a category. |
| `/api/search` | GET | Global search (food types + dishes/places). |
| `/api/photos`, `/api/profile/avatar` | POST | Upload a dish photo / avatar (local disk or R2). |
| `/api/vouch` | POST | "That's real" vouch on a photo (`vouchPhoto`; verification gate is a later phase). |
| `/api/review` | GET, POST | Curator queue list (`listProposed`) / approve-reject (`reviewProposed`). |
| `/api/pinnacle` | POST | add / remove / up / down a Pinnacle pin. |
| `/api/profile` | POST | Update name/bio/showcase. |
| `/api/category/favorite` | GET, POST | Get/set your declared #1 in a food type. |
| `/api/category/role` | POST | Curator-only: grant/revoke per-category "member" (lifts trust cap to `EXPERT_CAP`). |

## Key decisions & why
- **Pages are RSC + `force-dynamic`; interactivity is islands.** Every route reads `getRepo()` server-side at request time (no caching) and pushes only the live bits (`BrowseView`, `DuelBoard`, `RatingControl`) to the client. Keeps the seed-driven data fresh per request without a revalidation layer.
- **Food type is the URL.** `/nyc/[sub]` (not `/restaurants/[id]`) encodes the core bet — the dish is the headline. Restaurant pages exist (`/p/[placeId]`) but as an *add* surface, not the browse primary.
- **Duel is a server fact; adaptive ranking is a client convenience.** The binary-search insert in `DuelBoard` is pure UX to build *your* list fast — every comparison still hits `POST /api/duel` and moves the community model. The two modes share one endpoint.
- **`/explore` buckets by kind, not category.** Most NYC categories hold a single food type, so grouping by category would scatter into ~11 one-card sections; it buckets into Most Popular + Sweet & Sips instead (see comment in `explore/page.tsx`).
- **Review is deliberately ungated in the scaffold.** `requireReviewer()` returns any signed-in user; the prod curator role is wired but not enforced (noted inline + on the page).
- **Auth degrades gracefully.** Google buttons only show when `isGoogleEnabled()`; the cookie "pick a name" path always works (local-first).

## Gotchas
- **`searchParams`/`params` are Promises** (Next 15) — every page `await`s them. Forgetting breaks the build.
- **`getRankedList`/`getContenderDetail`/`getPlaceDetail` returning falsy → `notFound()`.** Unknown slugs/ids 404, they don't render empty.
- **Adaptive duel only triggers when `keep` AND `tried` AND `sub` all resolve to real `ContenderView`s** (`duel/page.tsx`). Missing any → falls back to king-of-the-hill; `prefer` seeds the first challenger instead.
- **`/duel` POST is 401 without a user** — `DuelBoard.choose()` sets an inline "Sign in to settle duels" error rather than navigating away.
- **`/map` filters against `HIDDEN_SUBCATEGORIES`** and skips any food type with zero ranked items, so the `LAYERS` list can drift ahead of seeded data without erroring.
- **Mine/Map toggles are conditional** — `source` toggle only when `signedIn`; `view` (List/Map) only in Overall mode. Personal map view does not exist.
- **`force-dynamic` everywhere** means no static caching; fine at seed scale, revisit before scale-out.

## Related
- Canonical [OVERVIEW](../OVERVIEW.md) — the full product walkthrough.
- [data-layer](./data-layer.md) — `getRepo()`, `getRankedList`, `getContenderDetail`, the repository interface every page calls.
- [ranking-engine](./ranking-engine.md) — what `recordDuel`/`recordVote` feed (Bradley-Terry + harsh score).
- [match-and-dedupe](./match-and-dedupe.md) — the engine behind `/api/dishes/match` and `/api/places/suggest`.
- [auth-and-trust](./auth-and-trust.md) — `getCurrentUser`, `getCategoryStanding`, the `TrustMeter`, category roles.
- [share-images](./share-images.md) — the `ShareButton` / `/share` cards used on `/nyc/[sub]` and `/u/[handle]`.
