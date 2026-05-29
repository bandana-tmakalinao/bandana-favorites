# Bandana Favorites

Crowd-ranked **best-of-NYC by food type**. You browse a _food_ — "best ramen in NYC" — and get an
absolute, community-built ranked list of ramens, where the **food is the title** and the **place is the
subtitle**. Ranking comes from trust-weighted **head-to-head comparisons** (Bradley-Terry/Elo) wrapped
in **Bayesian shrinkage** toward the category average, not mass voting.

> **New here? Read [`docs/OVERVIEW.md`](docs/OVERVIEW.md)** — the full walkthrough of what this is, why
> it's built this way, how the ranking + dedupe work, the data story, and where it stands.
> Full design rationale and the build plan also live in `~/.claude/plans/i-want-to-build-ancient-hamming.md`.

## Run it (zero setup)

```bash
npm install
npm run seed     # writes the placeholder NYC dataset to .data/store.json
npm run dev      # http://localhost:3000
```

With **no environment variables set**, the app runs entirely locally:

| Concern   | Local-dev default                          | Production path (env-gated)              |
| --------- | ------------------------------------------ | ---------------------------------------- |
| Data      | In-memory store + `.data/store.json`       | Postgres + PostGIS via Drizzle (`DATABASE_URL`) |
| Map       | Keyless OSM raster style                   | Protomaps PMTiles on R2 / MapTiler (`NEXT_PUBLIC_MAP_STYLE`) |
| Photos    | Local disk (`public/uploads`)              | Cloudflare R2 presigned PUT (`R2_*`)     |
| Auth      | Lightweight signed cookie ("pick a name")  | Auth.js + OAuth + phone OTP              |

Set the corresponding env vars (see `.env.example`) to flip any layer to its production adapter — no
code changes required.

## Architecture

- **`src/lib/ranking.ts`** — the one place the ranking math lives (Bradley-Terry MLE + shrinkage + the
  Elo nudge). Pure functions, unit-tested (`npm test`).
- **`src/lib/config.ts`** — the single tuning config (shrinkage `m`, `w_thumb`, eligibility gates, …).
- **`src/db/repo.ts`** — a `Repository` interface. `memory.ts` is the default; `pg.ts` (Drizzle) is used
  when `DATABASE_URL` is set.
- **`src/db/schema.ts`** — the production Postgres/PostGIS schema (Drizzle).
- **`src/seed/placeholder.ts`** — synthetic NYC taxonomy + places + contenders so every screen has
  content out of the box.

## Status

Built scaffold-first (the loop works on placeholder data); trust/anti-Sybil hardening, real data
ingestion, and the photo-verification gate are later phases. See `DECISIONS.md` for the autonomous
build log and open questions.
