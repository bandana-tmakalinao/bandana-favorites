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
import { generateSeed } from "@/seed/placeholder";
import { MemoryRepository } from "./memory";
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
  existingContenderId: string | null; // a live contender for (this place × subcategory), if any
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
  /** keepId = "king of the hill": keep that contender on one side and rotate in a fresh challenger. */
  getDuelPair(subSlug?: string, keepId?: string): DuelPair | null;
  recordDuel(userId: string, winnerId: string, loserId: string): { ok: boolean; error?: string };
  recordVote(userId: string, contenderId: string, rating: number): { ok: boolean; error?: string };
  addPhoto(userId: string, contenderId: string, url: string): Photo | null;
  vouchPhoto(userId: string, photoId: string): { ok: boolean };
  getOrCreateUser(name: string): User;
  getUser(id: string): User | null;
  stats(): { contenders: number; comparisons: number; votes: number; subcategories: number };

  // --- add-a-place flow ---
  /** Autocomplete real NYC places (corpus + existing) for adding under a food type. */
  searchPlaces(query: string, subSlug: string, limit?: number): PlaceHit[];
  /** Add (or find) the contender for a real place × food type; returns its id to go rate/duel. */
  addContenderAtPlace(
    userId: string,
    placeId: string,
    subSlug: string,
  ): { ok: boolean; contenderId?: string; error?: string };
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
}

// The store DATA + corpus are cached on globalThis (survive Next.js dev HMR reloads); the repository
// wrapper is rebuilt each call so code edits to MemoryRepository hot-reload cleanly.
const g = globalThis as unknown as { __bfStore?: StoreData; __bfCorpus?: CorpusPlace[] };

export function getRepo(): Repository {
  if (process.env.DATABASE_URL) {
    // The Drizzle schema (src/db/schema.ts) is ready; the Postgres repository is wired once a
    // database is provisioned (see DECISIONS.md). Until then, unset DATABASE_URL for local dev.
    throw new Error(
      "PgRepository not yet wired — unset DATABASE_URL to use the local in-memory store. See DECISIONS.md.",
    );
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
