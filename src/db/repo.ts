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
}

export interface SearchResults {
  query: string;
  subcategories: Array<{ slug: string; name: string; emoji: string; categoryName: string; contenderCount: number }>;
  contenders: SearchHitContender[];
}

export interface PlaceHit {
  id: string; // corpus id (corpus_*) or an existing place id
  name: string;
  address: string;
  borough: string;
  source: "corpus" | "place";
  /** Dishes already logged for (this place × subcategory) — a place can have several (e.g. two ramens). */
  existingDishes: { id: string; title: string }[];
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

export interface ProfileView {
  handle: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  trustScore: number;
  ratedCount: number;
  pinnacle: PinnacleItem[]; // ordered, all-time favorites (cross-category)
  /** The headline gold "#1 Picks" — one declared (or personal) #1 per showcased category. */
  topPicks: Array<{ subSlug: string; subName: string; emoji: string; contender: ContenderView }>;
  showcase: Array<{ subSlug: string; subName: string; emoji: string; items: ContenderView[] }>;
}

/**
 * The data-access seam. `MemoryRepository` (in-memory + .data/store.json) is the local-dev default;
 * a Postgres/Drizzle implementation slots in here when DATABASE_URL is configured.
 */
export interface Repository {
  getRegion(slug: string): Region | null;
  listCategories(): CategoryWithSubs[];
  getRankedList(subSlug: string): RankedList | null;
  /** A single user's own ranking for a food type, from their ratings + duels (score = their score). */
  getPersonalRankedList(userId: string, subSlug: string): ContenderView[];
  getContenderDetail(id: string): ContenderDetail | null;
  getHomeShowcase(perCategory?: number): ShowcaseEntry[];
  search(query: string, limit?: number): SearchResults;
  /** keepId = "king of the hill": keep that contender on one side and rotate in a fresh challenger.
   *  prefer = ordered list of contender IDs to prioritize as the challenger (drains naturally). */
  getDuelPair(subSlug?: string, keepId?: string, prefer?: string[]): DuelPair | null;
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

  // --- profiles + pinnacle ---
  getProfile(handle: string): ProfileView | null;
  updateProfile(userId: string, patch: { name?: string; bio?: string; showcase?: string[] }): { ok: boolean };
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
  }
  if (!g.__bfCorpus) g.__bfCorpus = loadCorpus();
  return new MemoryRepository(g.__bfStore, g.__bfCorpus);
}
