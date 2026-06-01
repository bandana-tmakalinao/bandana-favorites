# Menu Ingestion Playbook

How to **fill a category's contenders with each place's real menu items** (e.g. "add all the
pizzas that every pizza place actually serves"). Menu items land **unranked** — they fill out the
browsable pool below the editorial ranking; they don't change the ranked Top. This is distinct from
the **editorial seed** (curated, 2025+ best-of sources, carries a `seedScore`, *is* ranked) which
lives in `src/seed/real-<slug>.data.json`. See [seed top-up](#appendix-editorial-seed-vs-menu-import).

This was first run for **pizza** (2026-05). Re-running for another category = repeat the same four steps.

---

## The pipeline (4 steps)

```
place list (DB)  ─►  source each menu  ─►  clean to category items  ─►  import (unranked)
                     A) Uber Eats API
                     B) restaurant website
```

### Step 1 — Get the place list + IDs

The importer attaches by **exact `placeId`**, so pull them from the live DB (read-only via Render MCP
`query_render_postgres`, or any psql):

```sql
SELECT p.id AS place_id, p.name, p.neighborhood, p.borough, p.lat, p.lng, count(c.id) AS items
FROM places p
JOIN contenders c ON c.place_id = p.id
JOIN subcategories s ON c.subcategory_id = s.id
WHERE s.slug = '<category-slug>' AND c.status <> 'hidden'
GROUP BY p.id ORDER BY p.name;
```

Save to `/tmp/<cat>_places.json` as `[{id,name,borough,lat,lng}, ...]`. Watch for **duplicate places**
(pizza had two "L'Industrie" rows) — pick the canonical seeded one.

### Step 2 — Source each menu

Two sources. Prefer **B (the restaurant's own site)** — it's faster, cleaner, and covers the dine-in /
cash-only institutions that aren't on delivery apps at all. Use **A (Uber Eats)** as a bulk fallback
for places whose own site is awkward (PDF/image menus, heavy JS).

#### A) Uber Eats internal API — `getStoreV1`

Uber Eats exposes a clean JSON menu API. From **any** `ubereats.com` page (same-origin), in the
browser harness:

1. **Set a delivery location** near the place so search surfaces it. The location is a base64 of a
   small JSON in the `pl=` query param — fabricate it (lat/lng is enough; `reference` can be empty):
   ```python
   def mk_pl(addr, lat, lng):
       j=json.dumps({"address":addr,"reference":"","referenceType":"uber_places","latitude":lat,"longitude":lng},separators=(',',':'))
       return base64.b64encode(urllib.parse.quote(j).encode()).decode()
   ```
2. **Search** to find the store URL. Use the FULL param set or results won't render:
   `https://www.ubereats.com/search?pl=<pl>&q=<name>&sc=SEARCH_BAR&searchType=GLOBAL_SEARCH&vertical=ALL`
   Extract `a[href*="/store/"]` → `{href, text}`.
   - **Match on the URL slug, not the link text** — UE glues the name to the cuisine line
     ("MacolettaPizza • American"). The slug (`/store/macoletta/<uuid>` → "macoletta") is clean.
   - **Cuisine gate**: only accept candidates whose text+slug mention pizz/italian/napole/slice — kills
     false hits like "Mama's Too" → "Mama's Empanadas", "Krispy Pizza" → "Krispy Krunchy Chicken".
   - **WAIT for results to render** (the lesson from the first run): poll for `/store/` links for up to
     ~10–12s before deciding "not found". Firing the next search too soon returns an empty page that
     *looks* like rate-limiting but is just an unloaded SPA.
3. **Decode the store UUID** from the slug's last path segment (base64url of 16 bytes):
   ```python
   def decode_uuid(slug):
       b=base64.urlsafe_b64decode(slug+'=='*((4-len(slug)%4)%4)); h=b.hex()
       return f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"
   ```
4. **Fetch the menu** (returns full menu even for closed / out-of-range stores):
   ```js
   await fetch('/api/getStoreV1', {method:'POST',
     headers:{'content-type':'application/json','x-csrf-token':'x'},
     body: JSON.stringify({storeUuid: '<uuid>'})})
   ```
   Walk `data.catalogSectionsMap[*][].payload.standardItemsPayload.catalogItems` → `{title, itemDescription}`,
   pairing each section to its title via `data.sections` / `data.subsectionsMap`. **Only take items inside
   `store-catalog-section-vertical-grid` sections** — the page also renders cross-store "Picked for you"
   carousels you must NOT scrape.

#### B) Restaurant's own website

For each place: Google `"<name> <neighborhood> menu"`, open the official site or its ordering page
(Toast / Square / Slice / Squarespace), and read off the pizzas with descriptions. Text/HTML menus are
easy; for JS-rendered ordering widgets, load the page in the browser harness and read the DOM.

### Step 3 — Clean to category items

Raw menus are noisy. The cleaner (`/tmp/ue_clean.py` for the pizza run) enforces:

- **Scope to category sections** — keep pizza/pie/slice/square/sicilian/specialty sections; drop
  Drinks, Sides, Salads, Pasta, Heros, Calzones, Desserts, Catering.
- **Hard-exclude list overrides everything** — pasta words (gnocchi, rigatoni, linguini…), cocktails
  (martini, mule, spritz, limoncello…), wine/beer, salad, wings, fries, knots, cutlet, "extra side …
  sauce". This is load-bearing: full-service spots (Rocco's, Denino's) mix pizza with pasta + a full bar.
- **Don't trust ambiguous "strong" tokens alone** — "marinara"/"white"/"grandma" appear in non-pizzas
  ("Pasta Marinara", "White Wine", "Grandma's Meatballs"). Section + hard-exclude decide; a lone strong
  token only promotes when the name is otherwise clean.
- **Collapse topping-count permutations** — "… with One/Two/Three Toppings", "(2 toppings)" → the base pie.
- **Dedupe slice-vs-pie of the same flavor** — key strips a trailing pie/pizza/slice ("White" == "White Pie").
- **Descriptions verbatim** — never paraphrase a menu description (content integrity); copy UE/site text.
- Cap ~30 distinct items per place.

### Step 4 — Import (unranked, idempotent)

`POST /api/admin/import-menu` (moderator-gated by `isCurator` or `ADMIN_EMAILS`). Run it as an
**authenticated `fetch()` from a logged-in `faves.bandana.com` tab** (same-origin sends the session
cookie; a cross-origin fetch from `ubereats.com` would not). Body:

```json
{ "placeId": "place_5", "placeName": "Joe's Pizza", "source": "Uber Eats menu (verbatim)",
  "items": [ { "subSlug": "<category-slug>", "dish": "White Pie", "description": "…verbatim…" } ] }
```

- Lands each item **unranked** (`seedScore 0`, `status "provisional"`, `standing "new"`, `score 0`).
- **Idempotent** — re-imports skip `(place × subcategory × dish)` dupes ("already on this place"), and
  also skip anything that canonicalizes to an existing editorial pie. Safe to re-run.
- Max 100 items per call; one place per call. Pass the exact `placeId` to avoid creating a duplicate place.

### Verify

```sql
SELECT count(*) total,
  count(*) FILTER (WHERE seed_score > 0)  AS editorial_ranked,
  count(*) FILTER (WHERE seed_score = 0 OR seed_score IS NULL) AS menu_unranked,
  count(DISTINCT place_id) places
FROM contenders c JOIN subcategories s ON c.subcategory_id=s.id
WHERE s.slug='<category-slug>' AND c.status <> 'hidden';
```

Then load `faves.bandana.com/nyc/<category-slug>` and confirm the ranked Top is unchanged and the new
items appear in the browsable shelf.

---

## Ramen + burger run (2026-06-01)

Re-ran the pipeline for **ramen** and **cheeseburger** (Method A, Uber Eats). The tooling is now
**category-parameterized and versioned in `scripts/menu-ingestion/`**:
- `ue_cat.py` — per-category cleaner configs (`CATS["ramen"]`, `CATS["burger"]`): cuisine-match regex,
  `strong`/`hard_exclude`/`item_sec`/`nonitem_sec`, dedup + variant-collapse. Add a new category by adding
  a `CATS` entry. Has unit tests (`python3 scripts/menu-ingestion/ue_cat.py`).
- `ue_run.py` — the resumable scrape→clean→(optional import) driver. `UE_CAT=ramen|burger UE_N=<n>
  UE_IMPORT=0|1 UE_PACE=<s> browser-harness < ue_run.py`. Reads `/tmp/ue_<cat>_places.json`, writes
  `/tmp/ue_<cat>_results.json`.
- `ue_import_cat.py` — imports already-scraped results, **re-cleaning from saved `raw_rows`** so filter
  tweaks apply retroactively. `UE_CAT=… UE_N=<max>`.

**Results (live on prod):**
- **Ramen: 33 → 156** (33 editorial + **123** menu-unranked). 20 of 33 places via UE (Method A) + 5
  marquee dine-in spots (Tonchin, Gogyo, Okiboru, E.A.K., Momofuku Noodle Bar) via website (Method B).
- **Cheeseburger: 56 → 116** (56 editorial + **60** menu-unranked). 16 of 56 places via UE; the rest are
  dine-in institutions (each with one seeded burger). 4 wrong-store rows hidden via the new hide endpoint.

### Lessons / deltas from this run
- **Wait for the results grid to populate before scraping.** Sampling `a[href*="/store/"]` too early
  catches a transient `/store/apps/…` promo link and returns a false "no_match" (Tabetomo, etc. recovered
  once we waited for ≥3 store links). Fixed in `ue_run.py` (initial 3s + poll-until-≥3).
- **Burger seed skews dine-in.** 40 of 56 burger places (Minetta, Peter Luger, J.G. Melon, Keens, 4
  Charles, Raoul's, L'Artusi, Union Square Cafe…) aren't on UE delivery — but each has **one** iconic
  burger already captured by the editorial seed, so they're low-value to chase. Ramen had 13 dine-in
  misses (Tonchin, Momofuku Noodle Bar, Okiboru, E.A.K., Gogyo, Rockmeisha…) — better Method-B candidates.
- **Ghost-kitchen / name-collision false matches.** Generic burger names cross-matched wrong stores
  (The Golden Swan→"Golden Diner", Cozy Royale→"Cozy Corner", Red Hook Tavern→"Red Hook Lobster Pound";
  "Gogyo"→a sushi virtual brand). The cuisine+0.45-score gate is too loose for short/common names — a
  handful of mislabeled **unranked** rows slipped in (4 burger). Cleaned via the new curator endpoint
  **`POST /api/admin/hide-contender`** (added this run; `{contenderId}` or `{contenderIds:[…]}` → sets
  `status="hidden"`, recomputes). Tighten the matcher (require ≥0.6 unless a distinctive token) next time.
- Not throttled this run (paced ~2.5s; ~97 searches total). Genuine misses returned *full* pages of
  *other* nearby stores, not empty pages — distinguishable from the throttle's app-download-only page.

## Pizza run results (2026-05, baseline reference)

- **Editorial seed**: 83 ranked pies (incl. the +29 signature-pies top-up at the marquee places).
- **Uber Eats menu import**: 26 places → ~337 distinct pizzas (Method A).
- **Website menu import**: Rubirosa, Una Pizza Napoletana, Ops, Scarr's, L'Industrie (Method B).
- **Live total**: **445 pizza contenders across 55 places** (started at 84).

### Lessons from the run
- **Uber Eats throttles a session after ~70 rapid searches.** It silently serves an *empty* search
  results page (only an app-download link), which looks identical to "not on UE". Confirmed it's a block,
  not a slow load: a fresh isolated search still returned empty after a 24s wait. Mitigation next time:
  pace searches (sleep ~2–3s between places), and/or batch with cooldowns. Don't mistake the empty page
  for "not listed".
- **Method B (own website) varies by platform.** Static HTML menus (Rubirosa, Una Pizza) extract cleanly
  with a plain fetch. JS-rendered ones need the browser to render first: Square/Toast/Squarespace order
  widgets (Ops rendered fully in-browser; Scarr's & L'Industrie hide the menu behind a delivery widget /
  are UberEats-only, so signature pies came from the official-site search result). PDF menus (some Square
  sites) need the PDF fetched separately.
- **Genuinely not on any delivery channel** (dine-in / cash-only): Lucali (one build-your-own pie anyway),
  John's of Bleecker, Lee's Tavern — source from their own site or skip.

---

## Appendix: editorial seed vs menu import

| | Editorial seed | Menu import |
|---|---|---|
| Source | 2025+ best-of guides (curated) | the place's actual menu (UE API / its website) |
| File/where | `src/seed/real-<slug>.data.json` | live DB only (via the import API) |
| `seedScore` | >0 (publication-class quality) | 0 |
| Ranked? | yes (top 100 by blended score) | no — browsable shelf until it earns duels |
| Survives a reseed? | yes (regenerated from the file) | no (DB data; re-run this playbook) |
| Deploy path | seed file → boot top-up in `initPgStore` (idempotent) | `POST /api/admin/import-menu` |

**Reusable tooling from the pizza run** (kept under `/tmp/` during the run; promote to `scripts/` if you
want them versioned): `ue_clean.py` (the cleaner), `ue_batch.py` (search → UUID → getStoreV1 → clean,
resumable), `ue_import.py` (idempotent importer).
