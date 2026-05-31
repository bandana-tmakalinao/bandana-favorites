# Deployment, config & ops

*How Bandana Faves is configured, scripted, and shipped — local-first by default, env-gated for production. Last updated 2026-05-31.*

## Status
- **Built:** local-first boot (zero env vars), npm script surface, in-memory rate limiter, Drizzle schema + drizzle-kit config, README / `.env.example` docs. Tuning constants centralized in `src/lib/config.ts` (exists; reads optional `RANKING_SHRINKAGE_M`).
- **Partial:** prod adapters are defined as a contract in `.env.example` and the schema; per-adapter wiring exists in varying degrees (Postgres repo `pg.ts`, R2 uploads, OAuth routes). Treat the matrix below as the intended switch behavior; verify the specific adapter file before relying on it.
- **Deferred / not provisioned:** No Render service, managed Postgres, R2 bucket, OAuth app, or map-tile key is provisioned. Deploy target is decided (Render) but nothing billable has been created — hard rule (see Gotchas).

## Where it lives
| File | Role |
|------|------|
| `.env.example` | Canonical env list; **everything is optional/commented out**. Copy to `.env.local`. |
| `next.config.mjs` | `reactStrictMode`, `outputFileTracingRoot` pinned to project (stray parent lockfile confuses Next), `images.remotePatterns` allowlist (placeholder hosts + `**.r2.dev`). |
| `drizzle.config.ts` | drizzle-kit: `dialect: "postgresql"`, schema `./src/db/schema.ts`, **out `./drizzle`**, URL from `process.env.DATABASE_URL` (placeholder fallback so `db:generate` works without a live DB). |
| `package.json` | Scripts + `engines.node >=20`. |
| `README.md` | Quick start, local-vs-prod table, env pointer. |
| `src/lib/rate-limit.ts` | Process-local fixed-window limiter + `clientIp()`. |
| `src/lib/config.ts` | All ranking/trust/match tuning constants in one place. |
| `src/db/schema.ts` | Drizzle Postgres + PostGIS schema (the prod-only tables). |

## How it works

### Local-first boot (the default)
With **no `.env` at all**, the app runs: in-memory store + JSON snapshot at `.data/store.json`, keyless map raster (CARTO Positron / OSM, see `src/lib/mapStyle.ts`), **local-disk photo uploads** (`public/uploads`), and a lightweight signed-cookie session ("pick a name"). `npm install && npm run seed && npm run dev` is the whole setup — no DB, no cloud, no secrets. Same code path; prod adapters flip on only when their env vars appear.

### Env-gated production adapters
Each adapter is independent and degrades gracefully when absent:

| Env var(s) | Enables | Absent ⇒ fallback |
|-----------|---------|-------------------|
| `DATABASE_URL` | Postgres + PostGIS via Drizzle (`postgres` driver) — requires PostGIS extension | in-memory store + `.data/store.json` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | Cloudflare R2 photo uploads via presigned PUT (S3-compatible) | local-disk uploads in `public/uploads`. All-or-nothing. |
| `NEXT_PUBLIC_MAP_STYLE` | MapLibre style URL (Protomaps PMTiles on R2, or MapTiler style+key) | keyless CARTO Positron raster basemap |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | "Continue with Google" on `/me` + `/api/auth/google[/callback]` routes | name-only cookie sign-in (anonymous voting). **Both required.** |
| `NEXT_PUBLIC_SITE_URL` | Absolute https origin: builds OAuth redirect URI + share-image URLs | falls back to request origin / relative URLs |
| `SESSION_SECRET` | Signs the session cookie | dev default used; app **warns loudly in production** (sessions forgeable). Gen: `openssl rand -base64 32`. |
| `RANKING_SHRINKAGE_M` | Override Bayesian shrinkage `m` (defaults in `config.ts`) | hardcoded default |

Env semantics:
- `NEXT_PUBLIC_*` (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_MAP_STYLE`) are inlined at **build time** by Next — they must be present at `npm run build`, not just `start`. The rest (`DATABASE_URL`, `R2_*`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`) are read at runtime, server-side only.
- `NEXT_PUBLIC_SITE_URL` is the public **https origin**. Assignment target is `https://faves.bandana.com` (the `.env.example` value `https://bandanafavorites.com` is an illustrative placeholder). It double-duties as the base for generated share images and the OAuth redirect URI, so it must match the registered Google redirect exactly.
- `images.remotePatterns` is an explicit allowlist: `loremflickr.com`, `picsum.photos`, `images.pexels.com`, `**.r2.dev`. Unsplash is **deliberately not** allowlisted (its API license carries a non-compete clause — see `docs/data-sourcing-research.md`).

### npm scripts
| Script | Command | Use |
|--------|---------|-----|
| `dev` | `next dev` | Dev server, zero env vars. |
| `build` | `next build` | Production build. `NEXT_PUBLIC_*` baked in here. |
| `start` | `next start` | Serve the build. |
| `seed` | `tsx scripts/seed.ts` | Write the NYC seed into the active store. |
| `recompute` | `tsx scripts/recompute.ts` | Recompute all Bradley-Terry scores. |
| `corpus` | `python3 scripts/ingest_corpus.py` | Ingest the DOHMH place corpus → `.data/nyc-corpus.json`. (Python, not tsx.) |
| `test` | `node --import tsx --test src/lib/*.test.ts` | Node built-in test runner over `src/lib/*.test.ts` (ranking + match). No vitest. |
| `db:generate` | `drizzle-kit generate` | Generate migration SQL from `schema.ts`. **Works without a live DB.** |
| `db:migrate` | `drizzle-kit migrate` | Apply migrations — **needs `DATABASE_URL`**. |
| `db:push` | `drizzle-kit push` | Push schema straight to DB (dev). |
| `db:studio` | `drizzle-kit studio` | Drizzle Studio GUI. |

`tsx`-run scripts (`seed`/`recompute`) hit whichever store the env selects — in-memory locally, Postgres when `DATABASE_URL` is set.

### Rate limiting
`src/lib/rate-limit.ts` — a guardrail for auth endpoints (sign-in, OAuth start), not yet on public search.
```ts
rateLimit(key, max, windowMs): { ok: boolean; retryAfter: number }   // fixed window
clientIp(req): string   // x-forwarded-for[0] → x-real-ip → "unknown"
```
State lives in a process-local `Map<string, Bucket>` (`{ count, resetAt }`). **Single-instance only** — the header comment says swap the Map for Redis/KV/Postgres behind the same signature for a multi-instance deploy. `retryAfter` is seconds until the window resets.

### Deploy flow (Render)
Target is **Render**: one web service + one managed Postgres. Sequence: set `DATABASE_URL` (+ optional adapter vars), enable the **PostGIS extension** (the first migration must `CREATE EXTENSION postgis` — `schema.ts` exports `enablePostgis = sql\`CREATE EXTENSION IF NOT EXISTS postgis;\``), run `npm run db:migrate`, then `npm run build && npm run start`.

### Git / remote
GitHub remote `bandana-tmakalinao/bandana-favorites`, default branch `origin/main` (added 2026-05-30). Local-only workflow; not auto-pushed.

## Key decisions & why
- **Zero-config boot is a hard requirement.** Every prod dependency (DB, object storage, OAuth, tiles, photos) is optional and gated so a fresh clone runs instantly. Keeps onboarding and tests/CI hermetic.
- **One code path, two backends.** A fixed `Repository` interface (`src/db/repo.ts`); env vars choose the adapter at runtime rather than via build flags or separate entrypoints — local and prod exercise the same logic (see [data-layer](./data-layer.md)).
- **drizzle-kit kept usable offline.** `db:generate` runs against a placeholder URL with no live DB; only `db:migrate`/`db:push`/`db:studio` need a real `DATABASE_URL`.
- **Single-instance assumption.** The rate limiter is deliberately in-memory (no Redis dependency) to match a single Render web service — a conscious "not done" until horizontal scaling.
- **PostGIS isolation of licensed data.** Schema keeps canonical `places` (DOHMH) separate from `place_overture_enrich` so no source's licensing obligations contaminate the canonical row; Google is referenced by `place_id` only, never cached.
- **Render over Vercel/AWS** for bundled managed Postgres + simple web-service model; nothing billable provisioned yet.

## Gotchas
- **Operating constraints (hard rules):** no `git push`/send without explicit approval ("git approved"); **no billable cloud** (Render service, Postgres, R2, OAuth quota, map tiles) without a go-ahead; any seed/research **sources must be 2025+**. Nothing in the prod matrix is provisioned today.
- **`NEXT_PUBLIC_*` are build-time.** Changing `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_MAP_STYLE` requires a **rebuild**, not just a restart. A stale `localhost`/placeholder `NEXT_PUBLIC_SITE_URL` silently breaks share images and OAuth redirects in prod.
- **R2 and OAuth are all-or-nothing.** Partial `R2_*` falls back to local-disk uploads with no error; one missing Google var falls back to name-only sign-in.
- **`SESSION_SECRET` only warns, never throws.** A prod deploy missing it runs with a dev default → forgeable sessions. Verify it's set.
- **`db:migrate` needs `DATABASE_URL`.** Without it drizzle-kit gets the localhost placeholder and won't reach the real DB. Migrations land in `./drizzle` (not `src/db/migrations`).
- **PostGIS must be enabled first.** `places.geo` / `photos.exif_geo` are `geography(Point,4326)` custom types (stored as EWKT); regions carry a `MultiPolygon` boundary. Distance/containment queries (`ST_DWithin`, `ST_Contains`) break without the extension.
- **Rate limiter resets on deploy/restart** (in-memory) and is not shared across instances; only guards auth routes today.
- **iCloud-spaced repo path** (`.../Bandana Favorites`) trips some shell quoting — prefer fully-quoted absolute paths over `cd`.

## Related
- [OVERVIEW](../OVERVIEW.md) — §8 stack/config, §10 status (built vs deferred), §12 operating constraints.
- [data-layer](./data-layer.md) — the `Repository` interface and the in-memory vs Postgres adapters `DATABASE_URL` switches between.
- [share-images](./share-images.md) — consumer of `NEXT_PUBLIC_SITE_URL` for absolute OG image URLs.
- [ranking-engine](./ranking-engine.md) — what `recompute`/`seed` operate on; `RANKING_SHRINKAGE_M` tuning.
