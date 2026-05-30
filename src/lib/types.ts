import type { ConfidenceTier } from "./config";

export type ID = string;
export type ISODate = string;

export interface Region {
  id: ID;
  slug: string;
  name: string;
  center: { lat: number; lng: number };
}

export type CategoryKind = "cuisine" | "format" | "dessert" | "drink";

export interface Category {
  id: ID;
  slug: string;
  name: string;
  kind: CategoryKind;
  emoji: string;
  sort: number;
}

export interface Subcategory {
  id: ID;
  categoryId: ID;
  slug: string; // globally unique → routes as /nyc/<slug>
  name: string; // e.g. "Ramen"
  emoji: string;
  blurb: string;
}

export interface Place {
  id: ID;
  name: string;
  neighborhood: string;
  borough: string;
  address: string;
  lat: number;
  lng: number;
  corpusId?: string | null; // links to the NYC corpus entry (for dedupe on re-add)
  status?: "active" | "proposed"; // proposed = user-suggested, awaiting curator approval
}

/** The ranked unit: a place's offering within a food subcategory ("Ichiran's ramen"). */
export interface Contender {
  id: ID;
  placeId: ID;
  subcategoryId: ID;
  regionId: ID;
  title: string; // the FOOD — clean dish name (the headline; place is the subtitle)
  description: string; // short detail shown under the title (the verbose specifics)
  dishVariantId: ID | null; // reserved for future per-named-dish granularity
  seedSources: string[]; // publications this seed entry was informed by (curator seed only)
  createdBy: ID | null;
  createdAt: ISODate;

  // --- materialized ranking state (written by the ranking engine) ---
  theta: number; // Bradley-Terry latent strength
  rd: number; // rating deviation (confidence)
  weightedVotes: number; // v — trust-weighted evidence volume
  comparisonCount: number; // raw duels involving this contender
  distinctOpponents: number;
  score: number; // displayed 0–100 (shrunk toward the category prior)
  sortKey: number; // score − LCB penalty; what the list sorts by
  status: "provisional" | "active" | "hidden" | "proposed"; // proposed = awaiting curator approval
}

export interface User {
  id: ID;
  handle: string;
  name: string;
  trustScore: number; // [0,1], earned
  ratedCount: number;
  isCurator: boolean;
  createdAt: ISODate;
  // --- profile ---
  bio?: string;
  avatarUrl?: string | null;
  showcase?: string[]; // subcategory slugs to feature on the profile
  pinnacle?: ID[]; // contender ids — the user's ordered, all-time favorite dishes (NYC)
  categoryFavorites?: Record<string, ID>; // subSlug → contenderId (user's declared #1 per food type)
  /**
   * Per-category trust score (subSlug → 0–1). Auto-grows on each comparison in that category.
   * Normal users are capped at TRUST.NORMAL_CAP (0.7); community members at TRUST.EXPERT_CAP (1.0).
   * Falls back to the global trustScore if no entry exists for a category.
   */
  categoryTrust?: Record<string, number>;
  /**
   * Curator-assigned roles for specific food categories (subSlug → role).
   * "member" = trusted community expert for that category; lifts the trust cap to EXPERT_CAP.
   */
  categoryRoles?: Record<string, "member">;
  // --- auth ---
  email?: string;
  /** Linked external identity (e.g. Google), so the same person maps to one account across sign-ins. */
  oauth?: { provider: string; sub: string };
}

export type ComparisonSource = "duel" | "up" | "down";

/** Append-only. Up/down votes are also materialized here as baseline-anchored comparisons at recompute. */
export interface Comparison {
  id: ID;
  subcategoryId: ID;
  regionId: ID;
  userId: ID;
  winnerId: ID;
  loserId: ID;
  source: ComparisonSource;
  weight: number; // trust weight snapshot at cast time
  createdAt: ISODate;
}

/** A user's standing 0–100 "how good is it" rating on a contender (one per user per contender). */
export interface Vote {
  id: ID;
  contenderId: ID;
  userId: ID;
  rating: number; // 0–100 (50 = neutral); folded into the model as a weighted baseline comparison
  weight: number;
  createdAt: ISODate;
}

export interface Photo {
  id: ID;
  contenderId: ID;
  uploaderId: ID;
  url: string;
  status: "pending" | "verified" | "rejected";
  vouchCount: number;
  placeholder: boolean;
  createdAt: ISODate;
}

/** The whole persisted store (what the memory repo serializes to .data/store.json). */
export interface StoreData {
  version: number;
  generatedAt: ISODate;
  regions: Region[];
  categories: Category[];
  subcategories: Subcategory[];
  places: Place[];
  users: User[];
  contenders: Contender[];
  comparisons: Comparison[];
  votes: Vote[];
  photos: Photo[];
}

// --- view models the UI consumes ------------------------------------------------

export interface ContenderView {
  id: ID;
  placeId: ID;
  rank: number | null;
  title: string;
  description: string;
  placeName: string;
  neighborhood: string;
  borough: string;
  lat: number;
  lng: number;
  score: number;
  tier: ConfidenceTier;
  weightedVotes: number;
  comparisonCount: number;
  photoUrl: string | null;
  seedSources: string[];
}

export interface RankedList {
  region: Region;
  category: Category;
  subcategory: Subcategory;
  ranked: ContenderView[]; // eligible, ordered
  contenders: ContenderView[]; // provisional shelf (not yet eligible)
}

export interface CategoryWithSubs {
  category: Category;
  subcategories: Array<
    Subcategory & {
      contenderCount: number;
      topPhotoUrl: string | null;
      topTitle: string | null; // the current #1 dish, for the hub card preview
      topPlaceName: string | null;
    }
  >;
}
