import type {
  Category,
  CategoryWithSubs,
  ContenderView,
  Photo,
  Place,
  RankedList,
  Region,
  Subcategory,
  User,
} from "@/lib/types";
import { generateSeed } from "@/seed/placeholder";
import { MemoryRepository } from "./memory";
import { loadStore, saveStore } from "./store";

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

/**
 * The data-access seam. `MemoryRepository` (in-memory + .data/store.json) is the local-dev default;
 * a Postgres/Drizzle implementation slots in here when DATABASE_URL is configured.
 */
export interface Repository {
  getRegion(slug: string): Region | null;
  listCategories(): CategoryWithSubs[];
  getRankedList(subSlug: string): RankedList | null;
  getContenderDetail(id: string): ContenderDetail | null;
  getDuelPair(subSlug?: string): DuelPair | null;
  recordDuel(userId: string, winnerId: string, loserId: string): { ok: boolean; error?: string };
  recordVote(userId: string, contenderId: string, value: 1 | -1): { ok: boolean; error?: string };
  addPhoto(userId: string, contenderId: string, url: string): Photo | null;
  vouchPhoto(userId: string, photoId: string): { ok: boolean };
  getOrCreateUser(name: string): User;
  getUser(id: string): User | null;
  stats(): { contenders: number; comparisons: number; votes: number; subcategories: number };
}

// Singleton kept on globalThis so it survives Next.js dev HMR module reloads.
const g = globalThis as unknown as { __bfRepo?: Repository };

export function getRepo(): Repository {
  if (process.env.DATABASE_URL) {
    // The Drizzle schema (src/db/schema.ts) is ready; the Postgres repository is wired once a
    // database is provisioned (see DECISIONS.md). Until then, unset DATABASE_URL for local dev.
    throw new Error(
      "PgRepository not yet wired — unset DATABASE_URL to use the local in-memory store. See DECISIONS.md.",
    );
  }
  if (!g.__bfRepo) {
    let store = loadStore();
    if (!store) {
      store = generateSeed();
      saveStore(store);
    }
    g.__bfRepo = new MemoryRepository(store);
  }
  return g.__bfRepo;
}
