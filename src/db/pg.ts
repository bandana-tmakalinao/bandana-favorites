/**
 * Postgres persistence (production, when DATABASE_URL is set).
 *
 * Architecture — durable working set:
 *   - At boot (instrumentation.ts) the full dataset loads from Postgres into an in-memory StoreData,
 *     or is seeded if the DB is empty. All reads/writes then run against the proven MemoryRepository
 *     logic in memory (so the synchronous Repository interface and every page/route are unchanged).
 *   - After each mutation, PgRepository.persist() schedules a DEBOUNCED delta write-through: only rows
 *     that actually changed since the last flush are upserted (diffed by JSON), changed rows deleted.
 *
 * Why: this gives durability + a real relational schema (typed columns + indexes, inspectable/queryable)
 * while keeping DB connection use tiny (a small pool, no per-request queries) — which is exactly what a
 * managed Postgres connection cap wants, and it serves 100+ concurrent users fine on a single web
 * instance (Node's event loop serializes the synchronous mutations; the flush is async + coalesced).
 *
 * Scale-out path (documented in DECISIONS.md): when horizontal scaling (multiple web instances) is
 * needed, the per-row query repository against this same schema is the upgrade — the tables are ready.
 */
import postgres from "postgres";
import type {
  StoreData,
  Region,
  Category,
  Subcategory,
  Place,
  User,
  Contender,
  Comparison,
  Vote,
  Photo,
} from "@/lib/types";
import { generateSeed, computeAllRankings } from "@/seed/placeholder";
import { MemoryRepository } from "./memory";
import { loadCorpus, type CorpusPlace } from "./store";
import { normalizeName } from "@/lib/match";

type Sql = ReturnType<typeof postgres>;

const g = globalThis as unknown as {
  __bfPgSql?: Sql;
  __bfPgController?: PgController;
  __bfPgCorpus?: CorpusPlace[];
};

export function getSql(): Sql {
  if (!g.__bfPgSql) {
    const url = process.env.DATABASE_URL!;
    const local = url.includes("localhost") || url.includes("127.0.0.1");
    g.__bfPgSql = postgres(url, {
      ssl: local ? false : "require",
      max: Number(process.env.PG_POOL_MAX ?? 5),
      idle_timeout: 30,
      connect_timeout: 15,
      prepare: false, // safe across direct + pooled (pgbouncer) connections
      onnotice: () => {}, // silence "relation already exists, skipping" on every boot
    });
  }
  return g.__bfPgSql;
}

// --- schema (relational tables; JSON-as-text for genuinely nested fields) ---------------------------
const DDL = `
CREATE TABLE IF NOT EXISTS regions (id text PRIMARY KEY, slug text, name text, center_lat double precision, center_lng double precision);
CREATE TABLE IF NOT EXISTS categories (id text PRIMARY KEY, slug text, name text, kind text, emoji text, sort integer);
CREATE TABLE IF NOT EXISTS subcategories (id text PRIMARY KEY, category_id text, slug text, name text, emoji text, blurb text);
CREATE TABLE IF NOT EXISTS places (id text PRIMARY KEY, name text, neighborhood text, borough text, address text, lat double precision, lng double precision, corpus_id text, status text);
CREATE TABLE IF NOT EXISTS app_users (id text PRIMARY KEY, handle text, name text, trust_score double precision, rated_count integer, is_curator boolean, created_at text, bio text, avatar_url text, email text, password_hash text, email_verified boolean, showcase text, pinnacle text, category_favorites text, category_trust text, category_roles text, oauth text);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verified boolean;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS following text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS expert_categories text;
CREATE INDEX IF NOT EXISTS idx_users_email ON app_users (lower(email));
CREATE TABLE IF NOT EXISTS contenders (id text PRIMARY KEY, place_id text, subcategory_id text, region_id text, title text, description text, dish_variant_id text, seed_sources text, created_by text, created_at text, theta double precision, rd double precision, weighted_votes double precision, comparison_count integer, distinct_opponents integer, score double precision, sort_key double precision, status text, seed_score double precision, standing text, riser_score double precision);
ALTER TABLE contenders ADD COLUMN IF NOT EXISTS seed_score double precision;
ALTER TABLE contenders ADD COLUMN IF NOT EXISTS standing text;
ALTER TABLE contenders ADD COLUMN IF NOT EXISTS riser_score double precision;
CREATE TABLE IF NOT EXISTS comparisons (id text PRIMARY KEY, subcategory_id text, region_id text, user_id text, winner_id text, loser_id text, source text, weight double precision, created_at text);
CREATE TABLE IF NOT EXISTS votes (id text PRIMARY KEY, contender_id text, user_id text, rating integer, weight double precision, created_at text);
CREATE TABLE IF NOT EXISTS photos (id text PRIMARY KEY, contender_id text, uploader_id text, url text, status text, vouch_count integer, placeholder boolean, created_at text);
CREATE INDEX IF NOT EXISTS idx_contenders_sub ON contenders (subcategory_id);
CREATE INDEX IF NOT EXISTS idx_contenders_place_sub ON contenders (place_id, subcategory_id);
CREATE INDEX IF NOT EXISTS idx_contenders_region_sub ON contenders (region_id, subcategory_id, sort_key);
CREATE INDEX IF NOT EXISTS idx_comparisons_sub ON comparisons (subcategory_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_user ON comparisons (user_id, subcategory_id);
CREATE INDEX IF NOT EXISTS idx_votes_contender ON votes (contender_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON votes (user_id);
CREATE INDEX IF NOT EXISTS idx_photos_contender ON photos (contender_id);
CREATE INDEX IF NOT EXISTS idx_users_handle ON app_users (handle);
`;

const J = (v: unknown) => JSON.stringify(v ?? null);
const P = <T>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  try {
    const parsed = JSON.parse(v as string);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
};
const u = <T>(v: T | undefined | null): T | null => (v == null ? null : v);

// Each entity table: how to read it from the store, encode a row (object keyed by column), decode a row.
interface Spec<T> {
  name: string;
  cols: string[];
  rows: (s: StoreData) => T[];
  toRow: (e: T) => Record<string, unknown>;
  fromRow: (r: Record<string, unknown>) => T;
  assign: (s: StoreData, items: T[]) => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const TABLES: Spec<any>[] = [
  {
    name: "regions",
    cols: ["id", "slug", "name", "center_lat", "center_lng"],
    rows: (s) => s.regions,
    toRow: (e: Region) => ({ id: e.id, slug: e.slug, name: e.name, center_lat: e.center.lat, center_lng: e.center.lng }),
    fromRow: (r): Region => ({ id: r.id as string, slug: r.slug as string, name: r.name as string, center: { lat: r.center_lat as number, lng: r.center_lng as number } }),
    assign: (s, items) => (s.regions = items),
  },
  {
    name: "categories",
    cols: ["id", "slug", "name", "kind", "emoji", "sort"],
    rows: (s) => s.categories,
    toRow: (e: Category) => ({ id: e.id, slug: e.slug, name: e.name, kind: e.kind, emoji: e.emoji, sort: e.sort }),
    fromRow: (r): Category => ({ id: r.id as string, slug: r.slug as string, name: r.name as string, kind: r.kind as Category["kind"], emoji: r.emoji as string, sort: r.sort as number }),
    assign: (s, items) => (s.categories = items),
  },
  {
    name: "subcategories",
    cols: ["id", "category_id", "slug", "name", "emoji", "blurb"],
    rows: (s) => s.subcategories,
    toRow: (e: Subcategory) => ({ id: e.id, category_id: e.categoryId, slug: e.slug, name: e.name, emoji: e.emoji, blurb: e.blurb }),
    fromRow: (r): Subcategory => ({ id: r.id as string, categoryId: r.category_id as string, slug: r.slug as string, name: r.name as string, emoji: r.emoji as string, blurb: r.blurb as string }),
    assign: (s, items) => (s.subcategories = items),
  },
  {
    name: "places",
    cols: ["id", "name", "neighborhood", "borough", "address", "lat", "lng", "corpus_id", "status"],
    rows: (s) => s.places,
    toRow: (e: Place) => ({ id: e.id, name: e.name, neighborhood: e.neighborhood, borough: e.borough, address: e.address, lat: e.lat, lng: e.lng, corpus_id: u(e.corpusId), status: u(e.status) }),
    fromRow: (r): Place => ({ id: r.id as string, name: r.name as string, neighborhood: r.neighborhood as string, borough: r.borough as string, address: r.address as string, lat: r.lat as number, lng: r.lng as number, corpusId: (r.corpus_id as string) ?? null, status: (r.status as Place["status"]) ?? undefined }),
    assign: (s, items) => (s.places = items),
  },
  {
    name: "app_users",
    cols: ["id", "handle", "name", "trust_score", "rated_count", "is_curator", "created_at", "bio", "avatar_url", "email", "password_hash", "email_verified", "showcase", "pinnacle", "category_favorites", "category_trust", "category_roles", "oauth", "following", "expert_categories"],
    rows: (s) => s.users,
    toRow: (e: User) => ({
      id: e.id, handle: e.handle, name: e.name, trust_score: e.trustScore, rated_count: e.ratedCount,
      is_curator: e.isCurator, created_at: e.createdAt, bio: u(e.bio), avatar_url: u(e.avatarUrl), email: u(e.email),
      password_hash: u(e.passwordHash), email_verified: u(e.emailVerified),
      showcase: J(e.showcase), pinnacle: J(e.pinnacle), category_favorites: J(e.categoryFavorites),
      category_trust: J(e.categoryTrust), category_roles: J(e.categoryRoles), oauth: J(e.oauth), following: J(e.following),
      expert_categories: J(e.expertCategories),
    }),
    fromRow: (r): User => ({
      id: r.id as string, handle: r.handle as string, name: r.name as string, trustScore: r.trust_score as number,
      ratedCount: r.rated_count as number, isCurator: r.is_curator as boolean, createdAt: r.created_at as string,
      bio: (r.bio as string) ?? undefined, avatarUrl: (r.avatar_url as string) ?? null, email: (r.email as string) ?? undefined,
      passwordHash: (r.password_hash as string) ?? undefined, emailVerified: (r.email_verified as boolean) ?? undefined,
      showcase: P(r.showcase, undefined as string[] | undefined), pinnacle: P(r.pinnacle, undefined as string[] | undefined),
      categoryFavorites: P(r.category_favorites, undefined as Record<string, string> | undefined),
      categoryTrust: P(r.category_trust, undefined as Record<string, number> | undefined),
      categoryRoles: P(r.category_roles, undefined as Record<string, "member"> | undefined),
      oauth: P(r.oauth, undefined as User["oauth"]),
      following: P(r.following, undefined as string[] | undefined),
      expertCategories: P(r.expert_categories, undefined as string[] | undefined),
    }),
    assign: (s, items) => (s.users = items),
  },
  {
    name: "contenders",
    cols: ["id", "place_id", "subcategory_id", "region_id", "title", "description", "dish_variant_id", "seed_sources", "created_by", "created_at", "theta", "rd", "weighted_votes", "comparison_count", "distinct_opponents", "score", "sort_key", "status", "seed_score", "standing", "riser_score"],
    rows: (s) => s.contenders,
    toRow: (e: Contender) => ({
      id: e.id, place_id: e.placeId, subcategory_id: e.subcategoryId, region_id: e.regionId, title: e.title,
      description: e.description, dish_variant_id: u(e.dishVariantId), seed_sources: J(e.seedSources), created_by: u(e.createdBy),
      created_at: e.createdAt, theta: e.theta, rd: e.rd, weighted_votes: e.weightedVotes, comparison_count: e.comparisonCount,
      distinct_opponents: e.distinctOpponents, score: e.score, sort_key: e.sortKey, status: e.status,
      seed_score: u(e.seedScore), standing: u(e.standing), riser_score: u(e.riserScore),
    }),
    fromRow: (r): Contender => ({
      id: r.id as string, placeId: r.place_id as string, subcategoryId: r.subcategory_id as string, regionId: r.region_id as string,
      title: r.title as string, description: (r.description as string) ?? "", dishVariantId: (r.dish_variant_id as string) ?? null,
      seedSources: P(r.seed_sources, [] as string[]), createdBy: (r.created_by as string) ?? null, createdAt: r.created_at as string,
      theta: r.theta as number, rd: r.rd as number, weightedVotes: r.weighted_votes as number, comparisonCount: r.comparison_count as number,
      distinctOpponents: r.distinct_opponents as number, score: r.score as number, sortKey: r.sort_key as number, status: r.status as Contender["status"],
      seedScore: (r.seed_score as number) ?? undefined, standing: (r.standing as Contender["standing"]) ?? undefined,
      riserScore: (r.riser_score as number) ?? undefined,
    }),
    assign: (s, items) => (s.contenders = items),
  },
  {
    name: "comparisons",
    cols: ["id", "subcategory_id", "region_id", "user_id", "winner_id", "loser_id", "source", "weight", "created_at"],
    rows: (s) => s.comparisons,
    toRow: (e: Comparison) => ({ id: e.id, subcategory_id: e.subcategoryId, region_id: e.regionId, user_id: e.userId, winner_id: e.winnerId, loser_id: e.loserId, source: e.source, weight: e.weight, created_at: e.createdAt }),
    fromRow: (r): Comparison => ({ id: r.id as string, subcategoryId: r.subcategory_id as string, regionId: r.region_id as string, userId: r.user_id as string, winnerId: r.winner_id as string, loserId: r.loser_id as string, source: r.source as Comparison["source"], weight: r.weight as number, createdAt: r.created_at as string }),
    assign: (s, items) => (s.comparisons = items),
  },
  {
    name: "votes",
    cols: ["id", "contender_id", "user_id", "rating", "weight", "created_at"],
    rows: (s) => s.votes,
    toRow: (e: Vote) => ({ id: e.id, contender_id: e.contenderId, user_id: e.userId, rating: e.rating, weight: e.weight, created_at: e.createdAt }),
    fromRow: (r): Vote => ({ id: r.id as string, contenderId: r.contender_id as string, userId: r.user_id as string, rating: r.rating as number, weight: r.weight as number, createdAt: r.created_at as string }),
    assign: (s, items) => (s.votes = items),
  },
  {
    name: "photos",
    cols: ["id", "contender_id", "uploader_id", "url", "status", "vouch_count", "placeholder", "created_at"],
    rows: (s) => s.photos,
    toRow: (e: Photo) => ({ id: e.id, contender_id: e.contenderId, uploader_id: e.uploaderId, url: e.url, status: e.status, vouch_count: e.vouchCount, placeholder: e.placeholder, created_at: e.createdAt }),
    fromRow: (r): Photo => ({ id: r.id as string, contenderId: r.contender_id as string, uploaderId: r.uploader_id as string, url: r.url as string, status: r.status as Photo["status"], vouchCount: r.vouch_count as number, placeholder: r.placeholder as boolean, createdAt: r.created_at as string }),
    assign: (s, items) => (s.photos = items),
  },
];
/* eslint-enable @typescript-eslint/no-explicit-any */

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Coalesced, delta-only write-through controller (one per process, holds the live store reference). */
class PgController {
  snapshot = new Map<string, Map<string, string>>(); // table -> id -> last-written JSON
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private dirtyAgain = false;

  constructor(
    public sql: Sql,
    public store: StoreData,
  ) {}

  schedule() {
    if (this.timer || this.flushing) {
      if (this.flushing) this.dirtyAgain = true;
      return;
    }
    this.timer = setTimeout(() => void this.flush(), 250);
  }

  async flush() {
    this.timer = null;
    if (this.flushing) {
      this.dirtyAgain = true;
      return;
    }
    this.flushing = true;
    try {
      for (const spec of TABLES) await this.flushTable(spec);
    } catch (e) {
      console.error("[pg] flush error:", e);
    } finally {
      this.flushing = false;
      if (this.dirtyAgain) {
        this.dirtyAgain = false;
        this.schedule();
      }
    }
  }

  private async flushTable(spec: Spec<unknown>) {
    const prev = this.snapshot.get(spec.name) ?? new Map<string, string>();
    const next = new Map<string, string>();
    const changed: Record<string, unknown>[] = [];
    for (const e of spec.rows(this.store)) {
      const row = spec.toRow(e);
      const id = row.id as string;
      const json = JSON.stringify(row);
      next.set(id, json);
      if (prev.get(id) !== json) changed.push(row);
    }
    const deleted = [...prev.keys()].filter((id) => !next.has(id));

    for (const batch of chunk(changed, 800)) {
      const cols = spec.cols;
      const ph = batch
        .map((_, i) => `(${cols.map((_, j) => `$${i * cols.length + j + 1}`).join(",")})`)
        .join(",");
      const params = batch.flatMap((row) => cols.map((c) => row[c])) as (string | number | boolean | null)[];
      const set = cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ");
      await this.sql.unsafe(
        `INSERT INTO ${spec.name} (${cols.join(",")}) VALUES ${ph} ON CONFLICT (id) DO UPDATE SET ${set}`,
        params,
      );
    }
    for (const batch of chunk(deleted, 800)) {
      const ph = batch.map((_, i) => `$${i + 1}`).join(",");
      await this.sql.unsafe(`DELETE FROM ${spec.name} WHERE id IN (${ph})`, batch as string[]);
    }
    this.snapshot.set(spec.name, next);
  }
}

function emptyStore(): StoreData {
  return {
    version: 1,
    generatedAt: "",
    regions: [],
    categories: [],
    subcategories: [],
    places: [],
    users: [],
    contenders: [],
    comparisons: [],
    votes: [],
    photos: [],
  };
}

/** Boot hook (called from instrumentation.register): create schema, load the store, or seed if empty. */
/**
 * Idempotent curated-seed top-up. The DB is only seeded when it's empty, so curated entries added to
 * the seed files AFTER first launch (e.g. more pizzas at the top places) would otherwise never reach a
 * live DB. This merges in any curated seed contender missing from the loaded store — matched by
 * (place name × subcategory × dish title) so it never duplicates an existing or user-added dish, and
 * it never deletes anything. New places are created from the seed fields when the place doesn't exist
 * yet. Returns the number of contenders added; the caller recomputes rankings + flushes when > 0.
 */
function topUpSeed(store: StoreData): number {
  const seed = generateSeed();
  const region = store.regions[0];

  const subSlugById = new Map(store.subcategories.map((s) => [s.id, s.slug]));
  const liveSubBySlug = new Map(store.subcategories.map((s) => [s.slug, s]));
  const placeById = new Map(store.places.map((p) => [p.id, p]));
  const livePlaceByName = new Map<string, Place>();
  for (const p of store.places) {
    if (p.status !== "proposed") livePlaceByName.set(normalizeName(p.name), p);
  }
  const existingKey = new Set<string>();
  for (const c of store.contenders) {
    const place = placeById.get(c.placeId);
    const slug = subSlugById.get(c.subcategoryId);
    if (!place || !slug) continue;
    existingKey.add(`${normalizeName(place.name)}|${slug}|${normalizeName(c.title)}`);
  }

  const seedSubSlugById = new Map(seed.subcategories.map((s) => [s.id, s.slug]));
  const seedPlaceById = new Map(seed.places.map((p) => [p.id, p]));

  let added = 0;
  for (const sc of seed.contenders) {
    const slug = seedSubSlugById.get(sc.subcategoryId);
    const seedPlace = seedPlaceById.get(sc.placeId);
    const liveSub = slug ? liveSubBySlug.get(slug) : undefined;
    if (!slug || !seedPlace || !liveSub) continue;
    const key = `${normalizeName(seedPlace.name)}|${slug}|${normalizeName(sc.title)}`;
    if (existingKey.has(key)) continue;

    let place = livePlaceByName.get(normalizeName(seedPlace.name));
    if (!place) {
      place = { ...seedPlace, id: crypto.randomUUID(), status: "active" };
      store.places.push(place);
      livePlaceByName.set(normalizeName(place.name), place);
    }

    store.contenders.push({
      ...sc,
      id: crypto.randomUUID(),
      placeId: place.id,
      subcategoryId: liveSub.id,
      regionId: region.id,
    });
    existingKey.add(key);
    added++;
  }
  return added;
}

export async function initPgStore(): Promise<void> {
  if (g.__bfPgController) return; // already initialized this process
  const sql = getSql();
  for (const stmt of DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await sql.unsafe(stmt);
  }

  const [{ count }] = (await sql.unsafe(`SELECT count(*)::int AS count FROM regions`)) as unknown as [{ count: number }];
  let store: StoreData;
  let seeded = false;
  let migrated = 0;
  let toppedUp = 0;
  if (count > 0) {
    store = emptyStore();
    for (const spec of TABLES) {
      const rows = (await sql.unsafe(`SELECT * FROM ${spec.name}`)) as unknown as Record<string, unknown>[];
      spec.assign(store, rows.map(spec.fromRow));
    }
    console.log(`[pg] loaded store: ${store.contenders.length} contenders, ${store.users.length} users`);

    // Ranking v2 migration: contenders persisted before v2 have no seedScore/standing/riserScore.
    // Backfill the publication-class quality from the existing consensus score (which WAS the v1
    // seeded order) for publication-backed items, then recompute every category so the blended v2
    // score + standing take effect on this deploy. Idempotent — once columns are set this is a
    // cheap no-op on the backfill and a deterministic recompute.
    for (const c of store.contenders) {
      if (c.seedScore == null) {
        c.seedScore = c.seedSources && c.seedSources.length > 0 ? c.score : 0;
        migrated++;
      }
    }
    // Merge in any curated seed entries added since first launch (idempotent — adds only what's missing).
    toppedUp = topUpSeed(store);
    // Always recompute every category on boot so a deployed RANKING-ALGORITHM change (not just a data
    // migration) takes effect immediately. Deterministic + cheap; the delta-flush below writes only the
    // rows whose score/standing actually changed, so a no-op deploy costs nothing.
    computeAllRankings(store);
    console.log(`[pg] boot recompute (migrated ${migrated}, topped-up ${toppedUp}) — all rankings refreshed`);
  } else {
    store = generateSeed();
    seeded = true;
    console.log(`[pg] empty DB — seeding ${store.contenders.length} contenders`);
  }

  const controller = new PgController(sql, store);
  // Persist first seed, plus any score/standing deltas from the boot recompute (delta-flush no-ops if none).
  if (seeded || count > 0) await controller.flush();
  g.__bfPgController = controller;
  g.__bfPgCorpus = loadCorpus();

  // Persist any pending deltas before the instance is killed (Render sends SIGTERM on deploy/restart).
  const onExit = async () => {
    try {
      await controller.flush();
      await sql.end({ timeout: 5 });
    } catch {
      /* best-effort */
    }
  };
  process.once("SIGTERM", onExit);
  process.once("SIGINT", onExit);
}

/** True once the boot hook has loaded/seeded the store. */
export function pgReady(): boolean {
  return !!g.__bfPgController;
}

/** Force any pending delta write-through to complete now (seed scripts, tests, graceful shutdown). */
export async function flushPg(): Promise<void> {
  await g.__bfPgController?.flush();
}

/** Repository backed by the in-memory working set, persisting mutations through to Postgres. */
export class PgRepository extends MemoryRepository {
  constructor(
    store: StoreData,
    corpus: CorpusPlace[],
    private controller: PgController,
  ) {
    super(store, corpus);
  }

  protected persist() {
    this.controller.schedule();
  }
}

/** Build a PgRepository over the already-initialized global store. */
export function getPgRepository(): PgRepository {
  const c = g.__bfPgController;
  if (!c) {
    throw new Error("Postgres store not initialized — instrumentation.register() must run before getRepo(). See src/db/pg.ts.");
  }
  return new PgRepository(c.store, g.__bfPgCorpus ?? [], c);
}
