# Rankings showcase UI + design system

*How ranked dishes are presented across the home, explore, and category-hub pages — the photo-less, cream/coral visual language built on RankingCard. Last updated 2026-05-31.*

## Status

Built. The three showcase surfaces (`/`, `/explore`, `/nyc`) render server-side from the repo's
showcase APIs and work on the local seed today. All three are `export const dynamic = "force-dynamic"`.
The visual language is deliberately photo-less — warm gradient header bands + emoji + the 0–100
`ScoreBadge` carry the weight. Real photos only appear where a user has uploaded one (`topPhotoUrl` on
`/nyc` tiles; `PhotoThumb` renders nothing when there's no URL).

## Where it lives

| File | Role |
| --- | --- |
| `src/app/page.tsx` | Home/hero. Hero copy + `SearchBar variant="hero"` + the `RotatingCover` marquee of `RankingCard variant="cover"`. |
| `src/app/explore/page.tsx` | "NYC Food Power Rankings": featured pizza+burger covers, kind-bucketed grids, scoring legend, explore-more CTA. |
| `src/app/nyc/page.tsx` | Category hub — categories grouped, each subcategory a tile (emoji hero + "#1 …" subtitle + "{N} ranked"). |
| `src/components/RankingCard.tsx` | The ranked-list card. `variant: "feed" \| "cover"`. Props: `entry`, `tint`, `rows`, `variant`, `hook`, `kicker`. |
| `src/components/RotatingCover.tsx` | Client rotator wrapping pre-rendered cover cards: progress bar + arrows + dots, self-rescheduling timeout. |
| `src/components/bits.tsx` | Shared atoms: `RankBadge`, `ScoreBadge`, `ConfidenceDot`, `tierLabel`, `Avatar`, `PhotoThumb`, `btn`. |
| `src/app/globals.css` | `@theme` design tokens (cream/coral CSS vars) + `bf-fade` / `bf-progress` keyframes + `bf-range` slider. |
| `src/db/repo.ts` | Source of `getHomeShowcase(n)`, `listCategories()`, and the `ShowcaseEntry` type. |

## How it works

### Data contract
- **`ShowcaseEntry`** (from `@/db/repo`) drives `RankingCard`. Fields used: `slug`, `name`, `emoji`,
  `items` (a `ContenderView[]`). `getHomeShowcase(n)` returns entries **already sorted by ranked
  volume** (liveliest first); pages preserve that order and never re-sort by volume.
- Each row is a **`ContenderView`** (`@/lib/types`): `id`, `rank`, `title` (dish), `placeName`,
  `neighborhood`/`borough`, `score`, `tier`, `comparisonCount`. `placeLine(v)` builds the subtitle as
  `` `${placeName} · ${neighborhood||borough}` `` (place name alone if no location).
- The `/nyc` hub uses **`listCategories()`** → `{ category, subcategories }[]`. Each `category` has
  `id`, `name`, `emoji`, `kind`; each subcategory has `slug`, `name`, `emoji`, `contenderCount`,
  `topTitle`, `topPlaceName`, `topPhotoUrl`.

### `RankingCard` — the unit of the showcase
One self-contained Top-N ranking. `cover = variant === "cover"`; `shown = entry.items.slice(0, rows)`.

- **Header band** (`bg-gradient-to-br ${tint}`, links to `/nyc/${slug}`): emoji + an eyebrow `label` +
  the food-type `name` (`truncate`). `label = kicker ?? \`Top ${Math.min(10, total)} in NYC\`` — the
  label reflects the *list's* headline size (capped at 10), **not** how many rows the card previews, so
  a 5-row home preview of a 10-deep list still reads "Top 10 in NYC". Callers override via `kicker`.
  Cover only: a `hook` paragraph under the band.
- **Ranked rows** (`<ol>`, each links to `/c/${v.id}`): `RankBadge` · text stack (`title` then
  `placeLine`) · `ScoreBadge` on the right rail. On cover variant the **`i === 0` row is the "champ"**:
  `surface-2` background, bigger bold title, `md` score badge, and an extra line with
  `<ConfidenceDot tier withLabel />` + `· {comparisonCount} duels`.
- **Footer**: `See all ${total} →` when truncated, else `See full ranking →`. `mt-auto` pins it to the
  bottom so feed cards in a grid line up (`sm:items-start` on the grid keeps cards top-aligned).
- **Shape difference**: cover = `rounded-3xl` + ring + big shadow, larger emoji/title, more padding;
  feed = `rounded-2xl`, hover lift (`-translate-y-0.5` + deeper shadow), compact.

### `RotatingCover` — the home marquee (client)
`"use client"`. Wraps server-rendered cover cards passed as `children` (no data/markup duplicated on the
client; it only owns *which index is visible*). `ROTATE_MS = 6000`.
- State: `i` (index) + `paused` ref (true while hovered). `active = Math.min(i, Math.max(0, n-1))` —
  an **index clamp** guarding against the children array shrinking on re-render.
- **Self-rescheduling timeout keyed on `[active, n]`**: each advance (auto *or* manual via arrows/dots)
  re-arms a fresh `setTimeout`, so a manual tap always gets a full `ROTATE_MS` and the progress bar
  stays phase-aligned. No shared `setInterval`. Disabled when `n <= 1`.
- **Progress bar**: a div with `key={active}` (keyed remount restarts it) animated by the
  `bf-progress` keyframe over `ROTATE_MS`. The active card has `className="bf-fade" key={active}` for
  the fade-in. Steer row = `‹` button + dots (active dot widens to `w-5` brand) + `›`. `go(d)` wraps
  modulo `n`.

### Explore (`explore/page.tsx`) — the main showcase
1. **Fetch + dedupe.** `getHomeShowcase(ALL_RANKED)`, `ALL_RANKED = 500` (big enough to return every
   ranked dish in any food type, so "See all {N}" is the true total, not a truncated slice). Slugs can
   repeat across categories (bagel under Cuisines *and* Iconic NYC), so it dedupes by slug:
   `[...new Map(rawShowcase.map((e) => [e.slug, e])).values()]`.
2. **Kind lookup.** `kindByCategory = new Map(groups.map((g) => [g.category.name, g.category.kind]))`,
   joined via `e.categoryName`. `tintFor(e) = KIND_TINT[kind] ?? KIND_TINT.cuisine`.
3. **Featured covers.** `FEATURED_SLUGS = ["pizza", "cheeseburger"]` (the burger food type's slug is
   `cheeseburger`); falls back to the two biggest lists if absent. Two `RankingCard variant="cover"
   rows={10}` with `kicker="Featured · Top 10 in NYC"`, per-slug `HOOKS`, and **two distinct**
   `FEATURED_TINTS` so the same-kind heroes don't read as a repeat.
4. **Bucket by KIND, not category.** Most NYC categories hold a single food type, so per-category
   grouping would scatter the page into ~11 single-card sections. Instead `rest` (showcase minus
   featured, still volume-sorted) is split by `isSweet` (`SWEET_KINDS = {dessert, drink}`) into
   **"Most Popular"** (savory) + **"Sweet & Sips"**; empty buckets filtered out. Each renders
   `RankingCard variant="feed" rows={6}` in a `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` grid.
5. **Stats + legend.** Masthead: `totalTypes = showcase.length`, `totalRanked = Σ e.items.length`. A
   static "How a ranking earns its order" panel teaches the harsh 0–100 score once, with a legend:
   `--color-good` 75–100 elite, `--color-gold` 60–74 very good, `--color-border` below 60 the pack.
6. **Explore-more CTA.** Closing rounded panel → `/nyc` ("Browse all rankings") + `/duel`.

### Home (`page.tsx`)
`getHomeShowcase(10)`. `FEATURED = ["pizza", "cheeseburger"]` pulled to the front, then the rest,
`slice(0, 8)` → `marquee`, rendered in `<RotatingCover>` as `RankingCard variant="cover" rows={5}` with
tints cycled from a local `TINTS` array (`i % TINTS.length`) and a fixed
`hook="Ranked by head-to-head duels, not star averages."`. CTAs to `/explore` (filled) and `/nyc`
(outline); below, a 3-step "how it works" explainer (`sm:grid-cols-3`).

### Category hub (`nyc/page.tsx`)
`listCategories()`; `totalSubs = Σ subcategories.length`. Each category is a `<section>` (emoji +
name); subcategories render in `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`. Each tile (`Link` to
`/nyc/${slug}`) has a gradient emoji hero (`h-28`, `bg-gradient-to-br ${tint}`): `topPhotoUrl` as a
cover `<img>` if present, else the big emoji (`group-hover:scale-110`); a `{contenderCount} ranked`
pill top-right; body = bold truncated name + `#1 {topTitle} · {topPlaceName}` or "Be the first to rank
it". Hover: `-translate-y-0.5`, brand border, deeper shadow.

### `bits.tsx` — the shared atoms
- **`ScoreBadge`** — rounded square, `tabular-nums`, `Math.round(score)`. `scoreColor()`: `≥75` green
  text + green border, `≥60` ink text + gold border, else dim text + plain border. Sizes `sm`/`md`/`lg`;
  `shrink-0` (overflow defense). Title tooltip: "Trust-weighted, shrinkage-adjusted score (0–100)".
- **`RankBadge`** — gold/silver/bronze gradient **medallions** for ranks 1–3 (`MEDAL` map), plain
  `tabular-nums` numeral otherwise, `–` when `rank == null`. `shrink-0`.
- **`ConfidenceDot`** — colored dot (+ optional label) per `ConfidenceTier` (`@/lib/config`):
  established → `--color-good`, rising → `--color-gold`, provisional → `--color-ink-dim`. `tierLabel()`
  exposes the text.
- **`Avatar`** (photo or coral monogram), **`PhotoThumb`** (renders **nothing** when `url` is null — no
  empty placeholder blocks), **`btn(variant)`** (shared `primary`/`secondary`/`ghost` classes).

### Design tokens — `globals.css`
Tailwind v4, `@import "tailwindcss"` + an `@theme` block. Cream/coral palette as CSS vars:
`--color-bg #f7f5ef`, `--color-surface #ffffff`, `--color-surface-2 #f0ede4`, `--color-border #e6e1d6`,
`--color-ink #231c16`, `--color-ink-dim #7a7264`, `--color-brand #ed7f54` (coral), `--color-brand-soft
#e0683c`, `--color-gold #efb745`, `--color-good #009275` (bandana green), `--color-banner #fce776`.
Keyframes `bf-fade` (card fade-in) and `bf-progress` (the rotator bar); `.bf-range` styles the rating
slider. On-brand keyboard `:focus-visible` outline on every link/button.

### `KIND_TINT` — the one warm-menu palette
The same kind→gradient map is defined in **both** `explore/page.tsx` and `nyc/page.tsx` (and the home
`TINTS` array is the same four colors in order):
```
cuisine → coral cream (#fde7dc→#fbd9c6)   format → gold cream (#fdf0cf→#f8e3a6)
dessert → rose (#fce4ec→#f7cdd9)          drink  → sage (#e3f0ea→#c9e4d8)
```
These hex pairs are hardcoded Tailwind `from-[…] to-[…]` arbitrary values, **not** CSS vars. They are
what make a photo-less page read as "a vibrant menu": each category kind gets a consistent warm
gradient on cover/feed header bands (explore) and emoji-hero tiles (`/nyc`).

## Key decisions & why
- **Food is the headline, place is the subtitle.** Every row leads with `title` (dish) and demotes the
  restaurant to a `·`-joined `placeLine` subtitle — the product's core identity (OVERVIEW §1).
- **Photo-less by design** (OVERVIEW §10: "no placeholder images"). Warm gradients + emoji + score
  badges carry the visual weight; `PhotoThumb` returns null rather than an empty block; real photos
  only appear once uploaded (`topPhotoUrl`).
- **Bucket explore by KIND, not category** — explicit comment: per-category grouping scatters the page
  into ~11 single-card sections, so it collapses to a dense volume-sorted wall + a sweet shelf.
- **Pizza + burger are always heroes** ("the two great debates") with two *distinct* tints so the two
  `format`-kind cards don't look duplicated; graceful fallback to the two biggest lists.
- **`ALL_RANKED = 500`** (not a small page size) so "See all {N}" shows the real total.
- **Server-render the cover cards, client-rotate only.** `RotatingCover` deliberately takes
  pre-rendered children so no data/markup is duplicated client-side; the polished cover look is reused
  verbatim, just cycled.
- **Self-rescheduling timeout, not `setInterval`** — keeps a manual tap's dwell at a full `ROTATE_MS`
  and keeps the progress bar phase-aligned with the actual advance.
- **Score legend taught once** on `/explore`, not re-explained per card.

## Gotchas
- **Dedupe-by-slug is required on `/explore`.** Slugs repeat across categories (bagel under Cuisines
  *and* Iconic NYC); without the `new Map(...).values()` dedupe a ranking renders twice and React keys
  collide. The home page guards differently — it `filter`s out `FEATURED` slugs before concatenating.
- **`KIND_TINT` is duplicated** across `explore/page.tsx` and `nyc/page.tsx` (and mirrored by the home
  `TINTS`). Changing the palette means editing all three; they are intentionally kept in sync.
- **Kind join is by `category.name`**, not id (`kindByCategory` keyed on `g.category.name`, looked up
  via `e.categoryName`). A rename that desyncs those strings silently falls back to the `?? "cuisine"`
  tint and mis-buckets sweets as savory.
- **`label` ≠ row count.** The header says `Top ${Math.min(10, total)}` based on the *list's* total,
  while `rows` controls how many rows are drawn — by design (home shows 5 rows but says "Top 10"). Don't
  "fix" this to match `rows`.
- **Mobile no-horizontal-overflow contract.** Belt: `globals.css` sets `html, body { overflow-x: clip }`
  (`clip`, not `hidden`, so `position: sticky` header keeps working); `/explore`'s root also carries
  `[overflow-x:clip]`. Suspenders: the truncation contract inside `RankingCard` — `min-w-0` + `truncate`
  on the text stack, `shrink-0` on `RankBadge`/`ScoreBadge` — so long dish names can never push the
  layout sideways. Preserve all three when editing cards.
- **All three pages are `force-dynamic`** — re-query the repo per request, always reflecting the latest
  duels/scores (no ISR/caching). Fine at seed scale.
- **Empty states are real.** `/nyc` tiles fall back to "Be the first to rank it" when `topTitle` is
  absent; `/explore` filters empty buckets; the champ duel line only shows when `comparisonCount > 0`.

## Related
- Canonical [OVERVIEW](../OVERVIEW.md) — §1 (food-not-place), §8 (stack/tokens), §10 (no placeholders).
- [data-layer](./data-layer.md) — `getRepo`, `getHomeShowcase`, `listCategories`, `ShowcaseEntry`.
- [ranking-engine](./ranking-engine.md) — the harsh 0–100 score, `ConfidenceTier`, and the color thresholds the badges
  display.
