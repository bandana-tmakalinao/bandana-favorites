import type {
  Category,
  CategoryWithSubs,
  ContenderView,
  Photo,
  Place,
  RankedList,
  Region,
  StoreData,
  Subcategory,
  User,
} from "@/lib/types";
import type { DishResolution } from "@/lib/match";
import { generateSeed } from "@/seed/placeholder";
import { MemoryRepository } from "./memory";
import { getPgRepository } from "./pg";
import { backfillDishSlugs } from "./slugs";
import { type CorpusPlace, loadCorpus, loadStore, saveStore } from "./store";

export type { CategoryWithSubs, RankedList };

export interface ContenderDetail {
  contender: ContenderView;
  category: Category;
  subcategory: Subcategory;
  place: Place;
  photos: Photo[];
  neighbors: ContenderView[];
}

export interface DuelPair {
  category: Category;
  subcategory: Subcategory;
  a: ContenderView;
  b: ContenderView;
}

/** A user's trust standing within one food category — for the live "trust climbing" meter. */
export interface CategoryStanding {
  trust: number; // effective, cap-clamped 0–1
  cap: number; // TRUST.NORMAL_CAP (0.7) or TRUST.EXPERT_CAP (1.0)
  role: "member" | null; // curator-granted category expert
  weight: number; // resulting Bradley-Terry vote weight
}

/**
 * Everything a tried-gated placement run needs (the duel board's "place" mode). You only ever duel
 * dishes you've tried, so a session is: your existing tried ladder (`placed`), the community top picks
 * you haven't tried yet to ask about (`candidates`), and any dishes to place right away (`targets`,
 * e.g. one you just added). See src/lib/placement.ts.
 */
export interface RankSession {
  category: Category;
  subcategory: Subcategory;
  /** Your personal ranked ladder (your prior duels), best-first. Seeded with your declared #1 when empty. */
  placed: ContenderView[];
  /** Community top-N dishes you haven't placed yet — the "have you tried?" grid. */
  candidates: ContenderView[];
  /** Dishes to place immediately, skipping the grid (e.g. a just-added dish). */
  targets: ContenderView[];
  /** Your declared #1 in this category, if any. */
  favoriteId: string | null;
  standing: CategoryStanding | null;
}

export interface ShowcaseEntry {
  slug: string;
  name: string;
  emoji: string;
  categoryName: string;
  items: ContenderView[]; // top N ranked contenders
}

export interface SearchHitContender extends ContenderView {
  subSlug: string;
  subName: string;
  emoji?: string;
}

/** One activity-feed event (derived from comparisons + votes by people you follow). */
export interface FeedItem {
  id: string;
  kind: "duel" | "rating";
  at: string; // ISO timestamp
  actor: { handle: string; name: string; avatarUrl: string | null };
  /** The dish acted on (winner for a duel, rated dish for a rating). */
  contenderId: string;
  /** URL slug of the dish (falls back to the id) — feed rows link via dishPath. */
  dishSlug: string;
  dishTitle: string;
  placeName: string;
  subSlug: string;
  subName: string;
  emoji: string;
  /** For a duel: the dish that lost. */
  loserTitle?: string;
  /** For a rating: the 0–100 score given. */
  rating?: number;
}

export interface SearchResults {
  query: string;
  subcategories: Array<{ slug: string; name: string; emoji: string; categoryName: string; contenderCount: number }>;
  contenders: SearchHitContender[];
}

/** What sitemap.xml needs — excludes hidden categories, hidden/proposed dishes, proposed places. */
export interface SitemapEntries {
  categories: { slug: string; lastModified: string | null }[];
  dishes: { subSlug: string; slug: string }[];
  places: { id: string }[];
}

export interface PlaceHit {
  id: string; // corpus id (corpus_*) or an existing place id
  name: string;
  address: string;
  borough: string;
  source: "corpus" | "place";
  /** Dishes already logged for (this place × subcategory) — a place can have several (e.g. two ramens). */
  existingDishes: { id: string; slug: string; title: string }[];
}

/** Category-agnostic place search hit for the restaurant-first add flow. */
export interface PlaceSearchHit {
  id: string; // place id or corpus_* id
  name: string;
  address: string;
  neighborhood: string;
  borough: string;
  source: "corpus" | "place";
  dishCount: number; // dishes already logged at this place
}

/** A dish logged at a place, tagged with its food type, for the restaurant page. */
export interface PlaceDishView extends ContenderView {
  subSlug: string;
  subName: string;
  emoji: string;
  categoryName: string;
}

export interface PlaceDetail {
  place: {
    id: string;
    name: string;
    address: string;
    neighborhood: string;
    borough: string;
    lat: number;
    lng: number;
    isProposed: boolean; // user-suggested, awaiting curator approval
    inCorpus: boolean; // exists only in the corpus (no dishes logged yet)
  };
  dishes: PlaceDishView[]; // every dish logged here, across food types, best first
  categories: CategoryWithSubs[]; // for the "add a dish here" picker
}

export interface ProposedItem {
  contenderId: string;
  title: string;
  placeName: string;
  address: string;
  borough: string;
  subSlug: string;
  subName: string;
  proposedBy: string | null;
  /** Name of an existing active place this suggestion likely duplicates (curator dedupe aid). */
  possibleDuplicate?: string;
}

export interface PinnacleItem extends ContenderView {
  subSlug: string;
  subName: string;
  emoji: string;
}

/** A moderator menu-import request: a restaurant + its dishes, each tagged with a food type. */
export interface MenuImportInput {
  /** Existing place id, a corpus_* id, or null to create from name+address. */
  placeId?: string | null;
  placeName: string;
  address?: string;
  borough?: string;
  lat?: number;
  lng?: number;
  /** Where the menu came from (admin note, e.g. the restaurant URL). Not shown publicly. */
  source?: string;
  items: { subSlug: string; dish: string; description?: string }[];
}
export interface MenuImportResult {
  ok: boolean;
  error?: string;
  placeId?: string;
  added: { subSlug: string; dish: string; contenderId: string }[];
  skipped: { subSlug: string; dish: string; reason: string }[];
}

/** Aggregated publication backing for the admin panel. */
export interface PublicationStat {
  name: string; // canonical publication name (or the raw source if unrecognized)
  weight: number; // publication-class weight (drives the 50% editorial share)
  dishCount: number; // how many ranked dishes cite it
  recognized: boolean; // true if it matched the PUBLICATIONS registry
  /** A few example dishes it backs (title · place). */
  examples: { title: string; placeName: string; contenderId: string }[];
}

/** A compact user card for follower/following lists + discovery. */
export interface UserCard {
  handle: string;
  name: string;
  avatarUrl: string | null;
  bio: string;
  isCurator: boolean;
  followerCount: number;
  /** Whether the current viewer follows this user (false when signed out). */
  followedByViewer: boolean;
  /** Up to 3 self-declared expertise categories (★ verified = curator-recognized). The follow-card badges. */
  expertIn: { subSlug: string; subName: string; emoji: string; verified: boolean }[];
  /** Up to 2 "go-to" #1 favorites (dish + place) — the boldest calls that sell the follow. */
  goTos: { subSlug: string; emoji: string; title: string; placeName: string }[];
}

export interface ProfileView {
  handle: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  trustScore: number;
  ratedCount: number;
  isCurator: boolean;
  followerCount: number;
  followingCount: number;
  /** Whether the viewer (if any) follows this profile. */
  followedByViewer: boolean;
  /** True when the profile being viewed is the viewer's own. */
  isSelf: boolean;
  pinnacle: PinnacleItem[]; // ordered, all-time favorites (cross-category)
  /** Up to 3 self-declared expertise categories (★ = curator-recognized) — the "Expert in" badge row. */
  expertIn: { subSlug: string; subName: string; emoji: string; verified: boolean }[];
  /** The headline gold "#1 Picks" — one declared (or personal) #1 per showcased category. */
  topPicks: Array<{ subSlug: string; subName: string; emoji: string; contender: ContenderView }>;
  showcase: Array<{ subSlug: string; subName: string; emoji: string; items: ContenderView[] }>;
}

/**
 * The data-access seam. `MemoryRepository` (in-memory + .data/store.json) is the local-dev default;
 * a Postgres/Drizzle implementation slots in here when DATABASE_URL is configured.
 */
/** A "worth a try" suggestion for the feed: a promising dish + why we're surfacing it. */
export interface Recommendation extends ContenderView {
  subSlug: string;
  subName: string;
  emoji: string;
  /** "rising" = gaining duels but not yet ranked; "editor" = a strong editorial pick to try. */
  reason: "rising" | "editor";
}

export interface Repository {
  getRegion(slug: string): Region | null;
  listCategories(): CategoryWithSubs[];
  getRankedList(subSlug: string): RankedList | null;
  /** Up-and-coming: highest recent-velocity contenders in a food type (incl. unranked ones). */
  getRisers(subSlug: string, limit?: number): ContenderView[];
  /** "Worth a try" for the feed: rising-but-unranked dishes + editorial picks the user hasn't tried. */
  getTryThese(userId: string, limit?: number): Recommendation[];
  /** A single user's own ranking for a food type, from their ratings + duels (score = their score). */
  getPersonalRankedList(userId: string, subSlug: string): ContenderView[];
  /** Same, resolved by @handle — for the personal "my top 5" share image. */
  getPersonalRankedListByHandle(handle: string, subSlug: string): ContenderView[];
  getContenderDetail(id: string): ContenderDetail | null;
  /** Slug-first dish resolution for /nyc/[sub]/[dishSlug]; also accepts a raw contender id. */
  getContenderBySlug(subSlug: string, dishSlug: string): ContenderDetail | null;
  /** Every public URL for sitemap.xml: visible categories (w/ last-duel timestamps), live dishes, real places. */
  listSitemapEntries(): SitemapEntries;
  getHomeShowcase(perCategory?: number): ShowcaseEntry[];
  search(query: string, limit?: number): SearchResults;
  /** keepId = "king of the hill": keep that contender on one side and rotate in a fresh challenger.
   *  prefer = ordered list of contender IDs to prioritize as the challenger (drains naturally). */
  getDuelPair(subSlug?: string, keepId?: string, prefer?: string[]): DuelPair | null;
  /** Assemble a tried-gated placement session (duel "place" mode). targetIds = dishes to place now. */
  getRankSession(userId: string, subSlug: string, targetIds?: string[]): RankSession | null;
  recordDuel(userId: string, winnerId: string, loserId: string): { ok: boolean; error?: string };
  recordVote(userId: string, contenderId: string, rating: number): { ok: boolean; error?: string };
  addPhoto(userId: string, contenderId: string, url: string): Photo | null;
  vouchPhoto(userId: string, photoId: string): { ok: boolean };
  getOrCreateUser(name: string): User;
  /** Look up a user by email (lowercased match) — for password login. */
  getUserByEmail(email: string): User | null;
  /** Create an email+password account (route hashes the password first). Fails if the email is taken. */
  createPasswordUser(input: { email: string; name: string; passwordHash: string }): {
    ok: boolean;
    user?: User;
    error?: string;
  };
  /** Find an existing user by linked OAuth identity (provider+sub), or create one. */
  findOrCreateOAuthUser(p: {
    provider: string;
    sub: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  }): User;
  getUser(id: string): User | null;
  stats(): { contenders: number; comparisons: number; votes: number; subcategories: number };
  /** Publications backing the rankings, aggregated for the admin panel (weight + how many dishes cite each). */
  publicationStats(): PublicationStat[];

  // --- add-a-place flow ---
  /** Autocomplete real NYC places (corpus + existing) for adding under a food type. */
  searchPlaces(query: string, subSlug: string, limit?: number): PlaceHit[];
  /** Category-agnostic fuzzy place search (name + address) for the restaurant-first add flow. */
  searchAllPlaces(query: string, limit?: number): PlaceSearchHit[];
  /** A restaurant page: the place + every dish logged there + the category picker for adding more. */
  getPlaceDetail(placeId: string): PlaceDetail | null;
  /** Resolve a typed dish name against the category's vocabulary (snap to canonical / suggest / new). */
  matchDish(subSlug: string, query: string): DishResolution;
  /** The distinct existing dish names in a food type (the controlled vocabulary, for autocomplete). */
  listDishNames(subSlug: string): string[];
  /**
   * Moderator menu import: add many (place × food type × dish) rows at once from a parsed menu.
   * Each item lands UNRANKED (score 0, standing "new") — exactly like a user-added dish — and climbs
   * only as it earns duels/ratings. Dedupes by place+sub+dish (via the match engine). Returns a
   * per-item result so the admin can see what was added vs. skipped.
   */
  importMenu(input: MenuImportInput): MenuImportResult;
  /** Add (or find) the contender for a real place × food type; returns its id to go rate/duel. */
  addContenderAtPlace(
    userId: string,
    placeId: string,
    subSlug: string,
    title?: string,
    description?: string,
  ): { ok: boolean; contenderId?: string; placeId?: string; error?: string };
  /** Suggest a place not in the corpus — created as `proposed`, pending curator approval. */
  suggestPlace(
    userId: string,
    input: { name: string; address: string; borough?: string; subSlug: string },
  ): { ok: boolean; error?: string };
  /** Curator review queue. */
  listProposed(): ProposedItem[];
  reviewProposed(contenderId: string, approve: boolean): { ok: boolean };

  // --- social graph ---
  /** Follow / unfollow by handle. Idempotent; can't follow yourself. */
  setFollow(userId: string, targetHandle: string, follow: boolean): { ok: boolean; error?: string };
  /** Users who follow `handle`. */
  getFollowers(handle: string, viewerId?: string): UserCard[];
  /** Users `handle` follows. */
  getFollowing(handle: string, viewerId?: string): UserCard[];
  /** Suggested people to follow (most-followed / most-active), excluding the viewer + who they follow. */
  suggestedFollows(viewerId: string | undefined, limit?: number): UserCard[];
  /** Activity from the people a user follows (recent duels + ratings), newest first. */
  getFollowingFeed(userId: string, limit?: number): FeedItem[];
  /** Top tasters by follower count (discovery leaderboard). */
  topTasters(viewerId: string | undefined, limit?: number): UserCard[];
  /** Up-and-coming dishes across all categories (highest recent velocity). */
  trendingRisers(limit?: number): SearchHitContender[];

  // --- profiles + pinnacle ---
  getProfile(handle: string, viewerId?: string): ProfileView | null;
  updateProfile(userId: string, patch: { name?: string; bio?: string; showcase?: string[]; expertCategories?: string[] }): { ok: boolean };
  /** Change a user's @username (unique). Validates format + collision; returns the canonical handle. */
  setHandle(userId: string, handle: string): { ok: boolean; error?: string; handle?: string };
  /** Moderator: hide a contender (drops it from every list + search). Recomputes its category. */
  hideContender(contenderId: string): { ok: boolean; error?: string };
  setAvatar(userId: string, url: string): { ok: boolean };
  /** Manage the user's all-time-favorites list (add/remove/reorder). */
  pinnacleAction(
    userId: string,
    contenderId: string,
    action: "add" | "remove" | "up" | "down",
  ): { ok: boolean; error?: string };

  // --- category onboarding ---
  /** Returns the contenderId the user has declared as their #1 for this food type, or null. */
  getCategoryFavorite(userId: string, subSlug: string): string | null;
  /** Persists the user's declared favorite for a food type. */
  setCategoryFavorite(userId: string, subSlug: string, contenderId: string): { ok: boolean; error?: string };
  /** The user's current trust standing in a category (for the live trust meter). Null if signed out. */
  getCategoryStanding(userId: string, subSlug: string): CategoryStanding | null;

  // --- category trust & roles (curator-only write) ---
  /**
   * Grant or revoke a community-member role for a user in a specific food category.
   * Curators only. Granting lifts the per-category trust cap to EXPERT_CAP (1.0).
   */
  setCategoryRole(
    curatorId: string,
    targetUserId: string,
    subSlug: string,
    role: "member" | null,
  ): { ok: boolean; error?: string };
}

// The store DATA + corpus are cached on globalThis (survive Next.js dev HMR reloads); the repository
// wrapper is rebuilt each call so code edits to MemoryRepository hot-reload cleanly.
const g = globalThis as unknown as { __bfStore?: StoreData; __bfCorpus?: CorpusPlace[] };

export function getRepo(): Repository {
  // Guardrail: page/data code must NEVER run during `next build`. The pg store isn't initialized
  // there (instrumentation doesn't run) and the local fallback would silently bake placeholder
  // data into prerendered HTML. ISR routes opt out of build-time prerender via
  // generateStaticParams() → [] — if a route regresses, fail the build loudly instead.
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.BF_BUILDING === "1") {
    throw new Error(
      "getRepo() called during `next build` — this route would prerender with placeholder data. " +
        "Give it `generateStaticParams() => []` (ISR) or keep it dynamic.",
    );
  }
  if (process.env.DATABASE_URL) {
    // Postgres-backed durable working set (loaded/seeded at boot by src/instrumentation.ts → initPgStore).
    return getPgRepository();
  }
  if (!g.__bfStore) {
    g.__bfStore = loadStore() ?? ((): StoreData => {
      const s = generateSeed();
      saveStore(s);
      return s;
    })();
    // SEO slug migration (local twin of the pg boot backfill): mint once, persist, never recompute.
    if (backfillDishSlugs(g.__bfStore) > 0) saveStore(g.__bfStore);
  }
  if (!g.__bfCorpus) g.__bfCorpus = loadCorpus();
  return new MemoryRepository(g.__bfStore, g.__bfCorpus);
}
