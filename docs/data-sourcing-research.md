# Data-sourcing research — NYC seed (verified 2026-05-29)

Output of a multi-agent research + adversarial licensing-verification pass. **These are
licensing-research verdicts, not legal advice** — confirm Yelp/Google ToS section numbers and
Overture/OSM attribution wording with counsel before launch.

## Headline

Build the NYC place seed from **two free, no-share-alike open sources**: **NYC OpenData DOHMH**
(canonical) + **Overture Maps Places** (taxonomy enrichment + cross-check), joined in Postgres/PostGIS,
classified into food-subcategories, deduped to one row per establishment. Seed the ranking **ORDER**
from a **Bandana curator-placed editorial list** (informed by, never copied from, public best-of lists),
immediately overwritten by first-party Bradley-Terry duel votes. **Never persist Google or Yelp
content**; Google is a live map/hours veneer keyed off a stored `place_id` only.

## Sources (verdicts)

| Need   | Source | Status | Notes |
| ------ | ------ | ------ | ----- |
| Places (canonical) | **NYC OpenData DOHMH** `43nn-pn8j` (Socrata SODA API) | ✅ CONFIRMED public/open, no use restrictions (Local Law 11/2012) | ~296k inspection rows → **~31k establishments**; must dedup on `CAMIS` (~9.5 rows each). Includes non-restaurants/closed — filter active. |
| Places (enrichment) | **Overture Maps Places** (GeoParquet on S3) | ✅ CONFIRMED CDLA-Permissive-2.0 / Apache-2.0 / CC0 — commercial + storage OK, **no app-level share-alike** | NYC ~20–30k (unverified — run COUNT). Gate `confidence >= 0.85`. Classify on `taxonomy.hierarchy/primary` + `basic_category`, **NOT** the deprecated `categories` (removed Sept 2026). |
| Ranking ORDER | **Bandana curator editorial seed** → overwritten by first-party duels | ✅ clean | Informed by, never copied from, best-of lists. **No Google/Yelp ratings or review counts, ever.** |
| Dish taxonomy | **Wikidata** (SPARQL/dumps) | ✅ CONFIRMED CC0, storable | Generic dish concepts ("tonkotsu ramen", "birria taco") merged with Overture restaurant subtypes → the food-subcategory vocabulary. |
| place × dish | **User-generated only** | ✅ on-brand | Users name the dish + pick the place during duels. No storable third-party place×dish source exists. |
| Images (placeholder) | **Pexels API** | ✅ storable, free (200/hr, 20k/mo), requires "Photos provided by Pexels" credit | Pixabay = storable fallback (own-server + cache ≥24h). **SKIP Unsplash** (hotlink-only + **non-compete clause** barring a "similar or competing service"). |
| Images (launch) | **User uploads → R2** under a UGC content license + moderation | ✅ | Never cache/store Google Place Photos. |

## Ingestion plan (idempotent `scripts/seed.ts` steps, for the real-data phase)

0. **Schema:** canonical `places` table (source='dohmh', camis, name, address, borough, zip, lat/lng as
   PostGIS geography, dohmh_cuisine, phone, status) + a **separate** `places_overture_enrich` side-table
   (overture_id, taxonomy_primary, taxonomy_hierarchy, basic_category, website, socials, brand,
   confidence) joined by nullable FK — keep enrichment separable so no source's obligations contaminate
   canonical. Add `food_subcategories` + ranked-unit `place_subcategories` (place_id, subcategory_slug,
   seed_rank, curator_notes).
1. **Pull DOHMH** from `https://data.cityofnewyork.us/resource/43nn-pn8j.json` with a free app token;
   SoQL dedup to latest row per CAMIS, exclude placeholder (`inspection_date='1900-01-01'`) + inactive.
2. **Collapse to one row per CAMIS** in code (belt-and-suspenders) → canonical `places`.
3. **Pull Overture via DuckDB in-place** over S3 (no full download):
   ```sql
   INSTALL httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';
   SELECT id, names.primary, basic_category, taxonomy.primary, taxonomy.hierarchy,
          confidence, addresses[1].freeform, websites, socials, geometry
   FROM read_parquet('s3://overturemaps-us-west-2/release/2026-05-20.0/theme=places/type=place/*',
                     hive_partitioning=1)
   WHERE bbox.xmin BETWEEN -74.26 AND -73.70 AND bbox.ymin BETWEEN 40.49 AND 40.92
     AND taxonomy.hierarchy[1]='food_and_drink' AND confidence >= 0.85;
   ```
4. **Match Overture → DOHMH** on normalized name + PostGIS `ST_DWithin` (~75–100m) → attach enrichment
   via side-table FK. Don't overwrite canonical DOHMH name/address/geo.
5. **Classify into food_subcategories** from Overture `taxonomy.primary` (ramen_restaurant, etc.) +
   DOHMH `cuisine_description` → subcategory slugs. Vocabulary = Overture subtypes ∪ Wikidata dishes.
6. **Seed ORDER:** editor hand-places `seed_rank` per (place × subcategory), informed-not-copied, with
   private `curator_notes`. First-party duels overwrite over time.
7. **Placeholder images:** Pexels query = food name, download one per subcategory to R2, store
   photographer + Pexels link, render "Photos provided by Pexels", mark `placeholder=true`.
8. Wire as ordered idempotent Drizzle writes; re-run refreshes DOHMH + latest Overture release. Add an
   attribution footer (NYC OpenData + Overture + Foursquare Apache-2.0 NOTICE + Pexels).
9. **Pre-launch QA:** sample cross-check vs a second source; confirm no ~10× CAMIS dupes; confirm all
   Overture-enriched rows `confidence>=0.85`; confirm **no Google/Yelp-derived field exists anywhere**.

## Legal guardrails (hardcode these)

- **NEVER persist Google Places content except the opaque `place_id`.** No names/addresses/lat-lng/
  cuisine/ratings/reviews/hours/photos as canonical data. Google = live, query-time map/hours/"open now"/
  deep-link veneer only, keyed off a stored `place_id` matched to our own DOHMH/Overture record. Refresh
  `place_id`s older than 12 months via a free IDs-only Place Details call.
- **NEVER use Google content to build/augment the listing/ranking dataset** (Maps Service Terms bar a
  "business listings database" — our product is the named violation).
- **NEVER integrate Yelp** for ratings or order. Yelp Display Requirements forbid blended multi-source
  ratings (our crowd-rank IS that); API terms forbid >24h caching + listings DBs. No compliant path.
- **NEVER seed order from any scraped/API competitor rating or review count.** Binding constraint is
  CONTRACT (platform ToS), not copyright — "facts aren't copyrightable" (Feist) is **not** a safe harbor
  (Meta v. Bright Data, 2024). Only legal order basis = Bandana curator seed + first-party votes.
- **Overture: pull ONLY the Places theme** (Places + Addresses are the permissive themes).
  Base/Buildings/Transportation/**Divisions are ODbL share-alike** — do not pull them. (Correction to the
  source research, which wrongly called Divisions permissive; Divisions conflates OSM + geoBoundaries.)
- Honor Overture mixed per-record licensing on **redistribution**: reproduce the Foursquare Apache-2.0
  NOTICE + make CDLA-Permissive-2.0 text available; footer "POI data © Overture Maps Foundation" + the
  Foursquare notice. Internal storage of all three sub-licenses is fine.
- If OSM is ever added (**SKIP at launch**): keep it a separable enrichment side-table, never commingled
  into canonical. ODbL share-alike triggers on Public Use of a Derivative Database; our ranking/vote data
  is a "Produced Work" and stays proprietary only if OSM data is kept separable. Show "© OpenStreetMap
  contributors" where shown.
- Add **NYC OpenData attribution** (source + version + modifications) per the DOHMH Technical Standards.
- **Dish layer:** do NOT license a menu API to seed (Spoonacular: no-store + 1h cache cap; OpenMenu:
  caching = permanent ban). Generic dish taxonomy = Wikidata (CC0). place × dish = user-generated only.
- **Images:** Pexels (storable + credit), Pixabay (own-server + ≥24h cache), **AVOID Unsplash**
  (non-compete). Never store Google Place Photos. Launch = user uploads under UGC license + moderation +
  takedown.

## Open risks

- Overture NYC volume unverified (~20–30k) — run the bbox COUNT; ~60% global Google-verify rate → gate
  confidence ≥0.85 + dedup.
- Overture legacy `categories` removed Sept 2026 — classify against `taxonomy.*`/`basic_category`.
- DOHMH includes non-restaurants/closed/mobile vendors; ~1/30 blank cuisine — filter on active/recent.
- DOHMH CAMIS dedup mandatory (296k → ~31k) — failing it seeds ~10× dupes.
- Use a free Socrata app token (the "~1,000 req/hr anonymous" figure is community lore).
- Re-verify Google ToS section numbers live before sign-off; Google per-SKU free tiers are small in 2026
  (10k Essentials / 5k Pro / 1k Enterprise) — cap field masks to Essentials, lean on IDs-only refresh.
- Pexels images are generic (not the actual dish/place) — must visibly transition to user uploads.

> Full raw research (per-source detail + all citations) was produced by workflow `w9pmeln1r`.
