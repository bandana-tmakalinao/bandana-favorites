/**
 * Production Postgres + PostGIS schema (Drizzle). The local-dev default uses the in-memory repo;
 * this is the schema that activates when DATABASE_URL is set. Generate migrations with
 * `npm run db:generate` (the first migration must also `CREATE EXTENSION postgis` — see DECISIONS.md).
 *
 * Place modeling follows docs/data-sourcing-research.md: a canonical `places` table (sourced from
 * NYC OpenData DOHMH) with a SEPARATE Overture enrichment side-table, so no source's licensing
 * obligations contaminate the canonical row. Google is referenced by place_id only (never cached).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** PostGIS geography(Point,4326). Stored/read as EWKT; queried with ST_DWithin / ST_Contains. */
const geographyPoint = customType<{ data: { lat: number; lng: number }; driverData: string }>({
  dataType() {
    return "geography(Point,4326)";
  },
  toDriver(v) {
    return `SRID=4326;POINT(${v.lng} ${v.lat})`;
  },
});

export const categoryKind = pgEnum("category_kind", ["cuisine", "format", "dessert", "drink"]);
export const contenderStatus = pgEnum("contender_status", ["provisional", "active", "hidden"]);
export const comparisonSource = pgEnum("comparison_source", ["duel", "up", "down"]);
export const photoStatus = pgEnum("photo_status", ["pending", "verified", "rejected"]);
export const placeStatus = pgEnum("place_status", ["active", "closed", "duplicate"]);

export const regions = pgTable("regions", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("city"),
  centerLat: doublePrecision("center_lat").notNull(),
  centerLng: doublePrecision("center_lng").notNull(),
  boundary: customType<{ data: unknown; driverData: string }>({ dataType: () => "geography(MultiPolygon,4326)" })(
    "boundary",
  ),
  isLive: boolean("is_live").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: categoryKind("kind").notNull().default("cuisine"),
  emoji: text("emoji").notNull().default(""),
  sort: integer("sort").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const subcategories = pgTable(
  "subcategories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default(""),
    blurb: text("blurb").notNull().default(""),
    status: text("status").notNull().default("active"), // active | proposed | merged | rejected
    mergedInto: uuid("merged_into"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_subcat_category").on(t.categoryId)],
);

export const subcategorySynonyms = pgTable("subcategory_synonyms", {
  id: uuid("id").primaryKey().defaultRandom(),
  subcategoryId: uuid("subcategory_id")
    .notNull()
    .references(() => subcategories.id),
  term: text("term").notNull().unique(),
});

export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  handle: text("handle").unique(),
  name: text("name").notNull(),
  email: text("email").unique(),
  phoneE164Hash: text("phone_e164_hash").unique(), // salted hash only — never plaintext
  phoneVerified: boolean("phone_verified").notNull().default(false),
  trustScore: numeric("trust_score", { precision: 8, scale: 4 }).notNull().default("0.1"),
  trustTier: text("trust_tier").notNull().default("new"),
  ratedCount: integer("rated_count").notNull().default(0),
  isCurator: boolean("is_curator").notNull().default(false),
  status: text("status").notNull().default("active"), // active | shadowbanned | banned
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Append-only reputation ledger — materialized into app_users.trust_score. */
export const trustEvents = pgTable(
  "trust_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id),
    kind: text("kind").notNull(), // vote_cast | photo_uploaded | photo_vouched_in | phone_verified | ...
    weight: numeric("weight", { precision: 8, scale: 4 }).notNull(),
    refTable: text("ref_table"),
    refId: uuid("ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_trust_event_user").on(t.userId, t.createdAt)],
);

/** Canonical place (NYC OpenData DOHMH). Never holds Google-sourced content. */
export const places = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull().default("dohmh"),
    camis: text("camis").unique(),
    name: text("name").notNull(),
    address: text("address"),
    neighborhood: text("neighborhood"),
    borough: text("borough"),
    zip: text("zip"),
    dohmhCuisine: text("dohmh_cuisine"),
    geo: geographyPoint("geo").notNull(),
    regionId: uuid("region_id").references(() => regions.id),
    status: placeStatus("status").notNull().default("active"),
    mergedInto: uuid("merged_into"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_place_region").on(t.regionId)],
);

/** Overture enrichment kept SEPARATE so its licensing obligations don't contaminate canonical places. */
export const placeOvertureEnrich = pgTable("place_overture_enrich", {
  id: uuid("id").primaryKey().defaultRandom(),
  placeId: uuid("place_id")
    .notNull()
    .references(() => places.id),
  overtureId: text("overture_id"),
  taxonomyPrimary: text("taxonomy_primary"),
  taxonomyHierarchy: text("taxonomy_hierarchy"),
  basicCategory: text("basic_category"),
  website: text("website"),
  socials: text("socials"),
  brand: text("brand"),
  confidence: numeric("confidence", { precision: 4, scale: 3 }),
});

/** External provider IDs (e.g. Google place_id — storable; its CONTENT is not). */
export const externalPlaceRefs = pgTable(
  "external_place_refs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id),
    source: text("source").notNull(), // google | overture | manual
    sourcePlaceId: text("source_place_id").notNull(),
    lastRefreshed: timestamp("last_refreshed", { withTimezone: true }),
  },
  (t) => [uniqueIndex("uq_external_ref").on(t.source, t.sourcePlaceId)],
);

/** The ranked unit: (place × subcategory). */
export const contenders = pgTable(
  "contenders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id),
    subcategoryId: uuid("subcategory_id")
      .notNull()
      .references(() => subcategories.id),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    title: text("title").notNull(),
    dishVariantId: uuid("dish_variant_id"), // reserved for future per-named-dish granularity
    seedRank: integer("seed_rank"), // curator-placed launch order (overwritten by votes)
    curatorNotes: text("curator_notes"),
    // materialized ranking state
    theta: doublePrecision("theta").notNull().default(0),
    rd: doublePrecision("rd").notNull().default(350),
    weightedVotes: doublePrecision("weighted_votes").notNull().default(0),
    comparisonCount: integer("comparison_count").notNull().default(0),
    distinctOpponents: integer("distinct_opponents").notNull().default(0),
    score: numeric("score", { precision: 6, scale: 2 }).notNull().default("50"),
    sortKey: doublePrecision("sort_key").notNull().default(0),
    status: contenderStatus("status").notNull().default("provisional"),
    createdBy: uuid("created_by").references(() => appUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_contender_place_sub").on(t.placeId, t.subcategoryId),
    index("idx_contender_ranklist").on(t.regionId, t.subcategoryId, t.sortKey),
  ],
);

export const comparisons = pgTable(
  "comparisons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subcategoryId: uuid("subcategory_id")
      .notNull()
      .references(() => subcategories.id),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id),
    winnerId: uuid("winner_id")
      .notNull()
      .references(() => contenders.id),
    loserId: uuid("loser_id")
      .notNull()
      .references(() => contenders.id),
    source: comparisonSource("source").notNull().default("duel"),
    weight: numeric("weight", { precision: 8, scale: 4 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_comparison_sub").on(t.subcategoryId, t.createdAt)],
);

export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contenderId: uuid("contender_id")
      .notNull()
      .references(() => contenders.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id),
    value: smallint("value").notNull(),
    weight: numeric("weight", { precision: 8, scale: 4 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_vote_user_contender").on(t.contenderId, t.userId)],
);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contenderId: uuid("contender_id")
      .notNull()
      .references(() => contenders.id),
    uploaderId: uuid("uploader_id")
      .notNull()
      .references(() => appUsers.id),
    r2Key: text("r2_key").notNull(),
    contentHash: text("content_hash"),
    exifGeo: geographyPoint("exif_geo"),
    status: photoStatus("status").notNull().default("pending"),
    vouchCount: integer("vouch_count").notNull().default(0),
    placeholder: boolean("placeholder").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_photo_contender").on(t.contenderId, t.status)],
);

export const photoVouches = pgTable(
  "photo_vouches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id),
    value: smallint("value").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_vouch_photo_user").on(t.photoId, t.userId)],
);

export const rankingSnapshots = pgTable(
  "ranking_snapshots",
  {
    regionId: uuid("region_id").notNull(),
    subcategoryId: uuid("subcategory_id").notNull(),
    contenderId: uuid("contender_id").notNull(),
    rank: integer("rank").notNull(),
    score: numeric("score", { precision: 6, scale: 2 }).notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_snapshot_list").on(t.regionId, t.subcategoryId, t.rank)],
);

export const enablePostgis = sql`CREATE EXTENSION IF NOT EXISTS postgis;`;
