import {
  RANKING,
  MATCH,
  TRUST,
  HIDDEN_SUBCATEGORIES,
  DEFAULT_PUBLICATION_WEIGHT,
  publicationName,
  publicationWeight,
  type ConfidenceTier,
} from "@/lib/config";
import { trustToWeight } from "@/lib/ranking";
import { mintDishSlug } from "@/lib/slug";
import { normalizeName, resolveDishName, similarity, type DishResolution } from "@/lib/match";
import { recomputeSubcategory } from "@/seed/placeholder";
import type {
  Category,
  Contender,
  ContenderView,
  Photo,
  Place,
  Region,
  StoreData,
  Subcategory,
  User,
} from "@/lib/types";
import type {
  CategoryStanding,
  CategoryWithSubs,
  ContenderDetail,
  DuelPair,
  RankSession,
  MenuImportInput,
  MenuImportResult,
  PinnacleItem,
  PlaceDetail,
  PlaceDishView,
  PlaceHit,
  PlaceSearchHit,
  ProfileView,
  PublicationStat,
  ProposedItem,
  RankedList,
  Recommendation,
  Repository,
  FeedItem,
  SearchHitContender,
  SearchResults,
  ShowcaseEntry,
  UserCard,
} from "./repo";
import { type CorpusPlace, saveStore } from "./store";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "taster";

export class MemoryRepository implements Repository {
  constructor(
    protected store: StoreData,
    private corpus: CorpusPlace[] = [],
  ) {}

  // `protected` so PgRepository can override persistence to write through to Postgres.
  protected persist() {
    try {
      saveStore(this.store);
    } catch {
      /* read-only fs (e.g. some prod hosts) — fine, store stays in memory */
    }
  }

  // --- lookups ----------------------------------------------------------------
  private place(id: string): Place | undefined {
    return this.store.places.find((p) => p.id === id);
  }
  private subById(id: string): Subcategory | undefined {
    return this.store.subcategories.find((s) => s.id === id);
  }
  private catById(id: string): Category | undefined {
    return this.store.categories.find((c) => c.id === id);
  }
  private photosFor(contenderId: string): Photo[] {
    return this.store.photos.filter((p) => p.contenderId === contenderId);
  }
  private photoUrlFor(contenderId: string): string | null {
    const ps = this.photosFor(contenderId);
    const verified = ps.find((p) => p.status === "verified");
    return (verified ?? ps[0])?.url ?? null;
  }
  private tierFor(con: Contender): ConfidenceTier {
    if (con.status === "provisional") return "provisional";
    return con.rd < RANKING.RD_ESTABLISHED ? "established" : "rising";
  }
  /** Mint a URL slug for a NEW contender, unique within its subcategory (see src/lib/slug.ts). */
  private mintSlugFor(subId: string, title: string, placeName: string, id: string): string {
    const taken = new Set<string>();
    for (const c of this.store.contenders) {
      if (c.subcategoryId === subId && c.slug) taken.add(c.slug);
    }
    return mintDishSlug(taken, title, placeName, id);
  }
  private toView(con: Contender, rank: number | null): ContenderView {
    const pl = this.place(con.placeId);
    return {
      id: con.id,
      placeId: con.placeId,
      // Slug falls back to the id so dish links keep working for rows minted before the
      // slug migration ran (the /nyc/[sub]/[dishSlug] route resolves raw ids → redirects).
      slug: con.slug || con.id,
      subSlug: this.subById(con.subcategoryId)?.slug ?? "",
      rank,
      title: con.title,
      description: con.description ?? "",
      placeName: pl?.name ?? "Unknown",
      neighborhood: pl?.neighborhood ?? "",
      borough: pl?.borough ?? "",
      lat: pl?.lat ?? 0,
      lng: pl?.lng ?? 0,
      score: con.score,
      tier: this.tierFor(con),
      standing: con.standing ?? (con.status === "active" ? "ranked" : "new"),
      riserScore: con.riserScore ?? 0,
      weightedVotes: Math.round(con.weightedVotes * 10) / 10,
      comparisonCount: con.comparisonCount,
      photoUrl: this.photoUrlFor(con.id),
      seedSources: con.seedSources ?? [],
    };
  }

  /** Up-and-coming: highest recent-velocity contenders in a food type (incl. unranked ones). */
  getRisers(subSlug: string, limit = 6): ContenderView[] {
    const sub = this.subBySlug(subSlug);
    if (!sub) return [];
    const ranked = this.getRankedList(subSlug);
    const rankByCon = new Map<string, number | null>();
    for (const v of ranked?.ranked ?? []) rankByCon.set(v.id, v.rank);
    return this.store.contenders
      .filter(
        (c) =>
          c.subcategoryId === sub.id &&
          c.status !== "proposed" &&
          c.status !== "hidden" &&
          (c.riserScore ?? 0) > 0,
      )
      .sort((a, b) => (b.riserScore ?? 0) - (a.riserScore ?? 0))
      .slice(0, limit)
      .map((c) => this.toView(c, rankByCon.get(c.id) ?? null));
  }

  /**
   * "Worth a try" for the feed: dishes the crowd is building momentum on but that aren't ranked yet
   * ("getting rankings but still unranked"), then strong editorial picks the user hasn't tried. Skips
   * anything the user created, pinned, or already dueled, so it always surfaces something fresh.
   */
  getTryThese(userId: string, limit = 6): Recommendation[] {
    const user = this.getUser(userId);
    const pinned = new Set(user?.pinnacle ?? []);
    const dueled = new Set<string>();
    for (const cmp of this.store.comparisons) {
      if (cmp.userId === userId) {
        dueled.add(cmp.winnerId);
        dueled.add(cmp.loserId);
      }
    }
    const seen = new Set<string>();
    const recs: Recommendation[] = [];
    const consider = (c: Contender, reason: "rising" | "editor"): boolean => {
      if (recs.length >= limit || seen.has(c.id)) return false;
      if (c.status === "proposed" || c.status === "hidden") return false;
      if (c.createdBy === userId || pinned.has(c.id) || dueled.has(c.id)) return false;
      const sub = this.subById(c.subcategoryId);
      if (!sub || HIDDEN_SUBCATEGORIES.has(sub.slug)) return false;
      seen.add(c.id);
      recs.push({
        ...this.toView(c, this.rankOf(c)),
        subSlug: sub.slug,
        subName: sub.name,
        emoji: sub.emoji,
        reason,
      });
      return true;
    };

    // 1) Rising but not yet ranked — real duel momentum the crowd (incl. people you follow) is building.
    const risers = this.store.contenders
      .filter((c) => (c.riserScore ?? 0) > 0 && (c.standing ?? "new") !== "ranked")
      .sort((a, b) => (b.riserScore ?? 0) - (a.riserScore ?? 0));
    for (const c of risers) consider(c, "rising");

    // 2) Fill with strong editorial picks (high seed consensus) the user hasn't engaged with yet.
    if (recs.length < limit) {
      const gems = this.store.contenders
        .filter((c) => (c.seedScore ?? 0) >= 70)
        .sort((a, b) => (b.seedScore ?? 0) - (a.seedScore ?? 0));
      for (const c of gems) consider(c, "editor");
    }
    return recs;
  }

  getRegion(slug: string): Region | null {
    return this.store.regions.find((r) => r.slug === slug) ?? null;
  }

  listCategories(): CategoryWithSubs[] {
    const cats = [...this.store.categories].sort((a, b) => a.sort - b.sort);
    return cats.map((category) => {
      const subs = this.store.subcategories
        .filter((s) => s.categoryId === category.id && !HIDDEN_SUBCATEGORIES.has(s.slug))
        .map((s) => {
          const cons = this.store.contenders.filter((c) => c.subcategoryId === s.id);
          const top = [...cons].sort((a, b) => b.score - a.score || b.sortKey - a.sortKey)[0];
          return {
            ...s,
            contenderCount: cons.length,
            topPhotoUrl: top ? this.photoUrlFor(top.id) : null,
            topTitle: top?.title ?? null,
            topPlaceName: top ? (this.place(top.placeId)?.name ?? null) : null,
          };
        });
      return { category, subcategories: subs };
    });
  }

  getRankedList(subSlug: string): RankedList | null {
    const subcategory = this.store.subcategories.find((s) => s.slug === subSlug);
    if (!subcategory) return null;
    const category = this.catById(subcategory.categoryId);
    const region = this.store.regions[0];
    if (!category || !region) return null;

    const cons = this.store.contenders.filter((c) => c.subcategoryId === subcategory.id);
    const active = cons.filter((c) => c.status === "active").sort((a, b) => b.score - a.score || b.sortKey - a.sortKey);
    const provisional = cons.filter((c) => c.status === "provisional").sort((a, b) => b.score - a.score);

    return {
      region,
      category,
      subcategory,
      ranked: active.map((c, i) => this.toView(c, i + 1)),
      contenders: provisional.map((c) => this.toView(c, null)),
    };
  }

  getPersonalRankedList(userId: string, subSlug: string): ContenderView[] {
    const sub = this.store.subcategories.find((s) => s.slug === subSlug);
    if (!sub) return [];
    const subCons = this.store.contenders.filter(
      (c) => c.subcategoryId === sub.id && c.status !== "proposed" && c.status !== "hidden",
    );
    const ids = new Set(subCons.map((c) => c.id));

    // Comparison-only: your personal list is built purely from YOUR duels (win rate vs the things
    // you've pitted it against) — no 0–100 standing ratings.
    const wins = new Map<string, number>();
    const losses = new Map<string, number>();
    for (const cmp of this.store.comparisons) {
      if (cmp.userId !== userId || cmp.subcategoryId !== sub.id) continue;
      wins.set(cmp.winnerId, (wins.get(cmp.winnerId) ?? 0) + 1);
      losses.set(cmp.loserId, (losses.get(cmp.loserId) ?? 0) + 1);
    }

    const scored: Array<{ con: Contender; score: number; n: number }> = [];
    for (const con of subCons) {
      const w = wins.get(con.id) ?? 0;
      const l = losses.get(con.id) ?? 0;
      if (w + l > 0) scored.push({ con, score: Math.round((w / (w + l)) * 100), n: w + l });
    }
    scored.sort((a, b) => b.score - a.score || b.n - a.n);
    return scored.map((s, i) => ({
      ...this.toView(s.con, i + 1),
      score: s.score,
      // More duels involving the item ⇒ more settled in your personal list.
      tier: s.n >= 3 ? ("established" as const) : ("rising" as const),
      // Everything in your personal list is "ranked" for you, regardless of global standing.
      standing: "ranked" as const,
    }));
  }

  getPersonalRankedListByHandle(handle: string, subSlug: string): ContenderView[] {
    const user = this.store.users.find((u) => u.handle === handle);
    return user ? this.getPersonalRankedList(user.id, subSlug) : [];
  }

  /** Slug-first dish resolution for /nyc/[sub]/[dishSlug]. Falls through to id (pre-slug links). */
  getContenderBySlug(subSlug: string, dishSlug: string): ContenderDetail | null {
    const sub = this.subBySlug(subSlug);
    if (!sub) return null;
    const con = this.store.contenders.find(
      (c) => c.subcategoryId === sub.id && (c.slug === dishSlug || c.id === dishSlug),
    );
    return con ? this.getContenderDetail(con.id) : null;
  }

  getContenderDetail(id: string): ContenderDetail | null {
    const con = this.store.contenders.find((c) => c.id === id);
    if (!con) return null;
    const subcategory = this.subById(con.subcategoryId);
    if (!subcategory) return null;
    const category = this.catById(subcategory.categoryId);
    const place = this.place(con.placeId);
    if (!category || !place) return null;

    const list = this.getRankedList(subcategory.slug);
    const all = [...(list?.ranked ?? []), ...(list?.contenders ?? [])];
    const myIdx = all.findIndex((v) => v.id === id);
    const self = all[myIdx] ?? this.toView(con, null);
    const neighbors = all.filter((v) => v.id !== id).slice(Math.max(0, myIdx - 2), myIdx + 3).slice(0, 4);

    return {
      contender: self,
      category,
      subcategory,
      place,
      photos: this.photosFor(id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      neighbors,
    };
  }

  getHomeShowcase(perCategory = 10): ShowcaseEntry[] {
    const out: ShowcaseEntry[] = [];
    for (const sub of this.store.subcategories) {
      if (HIDDEN_SUBCATEGORIES.has(sub.slug)) continue;
      const list = this.getRankedList(sub.slug);
      if (!list || list.ranked.length === 0) continue;
      const category = this.catById(sub.categoryId);
      out.push({
        slug: sub.slug,
        name: sub.name,
        emoji: sub.emoji,
        categoryName: category?.name ?? "",
        items: list.ranked.slice(0, perCategory),
      });
    }
    // Most-populated (most-dueled) food types first, so the rotation leads with the liveliest lists.
    return out.sort((a, b) => b.items.length - a.items.length);
  }

  search(query: string, limit = 8): SearchResults {
    const q = query.trim().toLowerCase();
    if (!q) return { query, subcategories: [], contenders: [] };

    const subcategories = this.store.subcategories
      .filter(
        (s) =>
          !HIDDEN_SUBCATEGORIES.has(s.slug) &&
          (s.name.toLowerCase().includes(q) || s.slug.replace(/-/g, " ").includes(q)),
      )
      .slice(0, 6)
      .map((s) => ({
        slug: s.slug,
        name: s.name,
        emoji: s.emoji,
        categoryName: this.catById(s.categoryId)?.name ?? "",
        contenderCount: this.store.contenders.filter((c) => c.subcategoryId === s.id).length,
      }));

    const matches = this.store.contenders.filter((c) => {
      if (c.status === "proposed" || c.status === "hidden") return false;
      if (c.title.toLowerCase().includes(q)) return true;
      const pl = this.place(c.placeId);
      return !!pl && (pl.name.toLowerCase().includes(q) || pl.neighborhood.toLowerCase().includes(q));
    });
    // Prefer place-name matches, then higher score.
    matches.sort((a, b) => {
      const an = this.place(a.placeId)?.name.toLowerCase().startsWith(q) ? 1 : 0;
      const bn = this.place(b.placeId)?.name.toLowerCase().startsWith(q) ? 1 : 0;
      return bn - an || b.score - a.score;
    });
    const contenders: SearchHitContender[] = matches.slice(0, limit).map((c) => {
      const sub = this.subById(c.subcategoryId);
      return { ...this.toView(c, null), subSlug: sub?.slug ?? "", subName: sub?.name ?? "" };
    });

    return { query, subcategories, contenders };
  }

  getDuelPair(subSlug?: string, keepId?: string, prefer?: string[]): DuelPair | null {
    let subcategory: Subcategory | undefined;
    const king = keepId ? this.store.contenders.find((c) => c.id === keepId) : undefined;
    if (king) subcategory = this.subById(king.subcategoryId);
    if (!subcategory && subSlug) subcategory = this.store.subcategories.find((s) => s.slug === subSlug);
    if (!subcategory) {
      const eligible = this.store.subcategories.filter(
        (s) =>
          !HIDDEN_SUBCATEGORIES.has(s.slug) &&
          this.store.contenders.filter((c) => c.subcategoryId === s.id).length >= 2,
      );
      subcategory = eligible[Math.floor(Math.random() * eligible.length)];
    }
    if (!subcategory) return null;
    const category = this.catById(subcategory.categoryId);
    if (!category) return null;

    const pool = this.store.contenders.filter((c) => c.subcategoryId === subcategory!.id);
    if (pool.length < 2) return null;

    // "a" = the king (kept side) when given and in this pool; otherwise an uncertainty-weighted pick.
    let a: Contender;
    if (king && king.subcategoryId === subcategory.id) {
      a = king;
    } else {
      const byUncertainty = [...pool].sort((x, y) => y.rd - x.rd);
      a = byUncertainty[Math.floor(Math.random() * Math.min(pool.length, Math.ceil(pool.length / 2)))];
    }

    // "b" = challenger. When a prefer list is given, pick the first ID from it that's in the pool.
    // Falls back to the normal proximity/random logic when the prefer list is empty or exhausted.
    const rest = pool.filter((c) => c.id !== a.id);
    const b = this.pickChallenger(a, rest, prefer);
    return { category, subcategory, a: this.toView(a, null), b: this.toView(b, null) };
  }

  /** Returns the trust cap for a user in a category (lifted for community members). */
  private catTrustCap(user: User, subSlug: string): number {
    return user.categoryRoles?.[subSlug] === "member" ? TRUST.EXPERT_CAP : TRUST.NORMAL_CAP;
  }

  /**
   * Returns the effective (cap-clamped) trust score for a user in a specific food category.
   * Clamping at read time means a revoked member role immediately reduces influence, while the
   * stored value is preserved (so re-promotion restores their earned trust).
   */
  private catTrustFor(user: User, subSlug: string): number {
    const raw = user.categoryTrust?.[subSlug] ?? user.trustScore;
    return Math.min(raw, this.catTrustCap(user, subSlug));
  }

  /** Grows the user's per-category trust by one comparison increment, respecting their cap. */
  private growCategoryTrust(user: User, subSlug: string): void {
    const current = this.catTrustFor(user, subSlug);
    const cap = this.catTrustCap(user, subSlug);
    if (current >= cap) return;
    const next = Math.min(cap, current + TRUST.GROWTH_PER_COMPARISON);
    if (!user.categoryTrust) user.categoryTrust = {};
    user.categoryTrust[subSlug] = +next.toFixed(4);
  }

  private pickChallenger(a: Contender, rest: Contender[], prefer?: string[]): Contender {
    if (prefer && prefer.length > 0) {
      const firstPreferred = prefer
        .map((id) => rest.find((c) => c.id === id))
        .find((c): c is Contender => c !== undefined);
      if (firstPreferred) return firstPreferred;
    }
    // Default: 25% exploration (random), 75% proximity (close score + high uncertainty).
    if (Math.random() < 0.25) {
      return rest[Math.floor(Math.random() * rest.length)];
    }
    const close = [...rest].sort((x, y) => Math.abs(x.sortKey - a.sortKey) - Math.abs(y.sortKey - a.sortKey));
    const top = close.slice(0, Math.min(4, close.length));
    return top[Math.floor(Math.random() * top.length)];
  }

  /**
   * Assemble a tried-gated placement session. The ladder (`placed`) is the user's own duel history —
   * everything in it is a dish they've tried — seeded with their declared #1 when they've no history
   * yet. `candidates` are the community top picks they haven't placed (the "have you tried?" grid);
   * `targets` are dishes to place right away (e.g. one just added). See src/lib/placement.ts.
   */
  getRankSession(userId: string, subSlug: string, targetIds: string[] = []): RankSession | null {
    const list = this.getRankedList(subSlug);
    if (!list) return null;
    const { category, subcategory, ranked, contenders } = list;
    const all = [...ranked, ...contenders];
    const byId = (id: string): ContenderView | undefined =>
      all.find((v) => v.id === id) ?? this.getContenderDetail(id)?.contender;

    // Re-rank: an explicit target already in your ladder is PULLED OUT here so it gets re-inserted
    // from scratch via fresh duels (rather than deduped away — which is what blocks re-ranking).
    const targetIdSet = new Set(targetIds);
    let placed = this.getPersonalRankedList(userId, subSlug).filter((v) => !targetIdSet.has(v.id));
    const favoriteId = this.getCategoryFavorite(userId, subSlug);
    // With no duel history, anchor the ladder on the declared #1 (unless it's itself being re-ranked).
    if (placed.length === 0 && favoriteId && !targetIdSet.has(favoriteId)) {
      const fav = byId(favoriteId);
      if (fav) placed = [fav];
    }
    const placedIds = new Set(placed.map((v) => v.id));

    const seen = new Set(placedIds);
    const targets: ContenderView[] = [];
    for (const id of targetIds) {
      if (seen.has(id)) continue;
      const v = byId(id);
      if (v) {
        seen.add(id);
        targets.push(v);
      }
    }

    // The grid: top community picks the user hasn't placed or queued. ~20 is plenty to recognize.
    const RANK_GRID_N = 20;
    const candidates = ranked
      .filter((v) => !placedIds.has(v.id) && !seen.has(v.id))
      .slice(0, RANK_GRID_N);

    return {
      category,
      subcategory,
      placed,
      candidates,
      targets,
      favoriteId,
      standing: this.getCategoryStanding(userId, subSlug),
    };
  }

  recordDuel(userId: string, winnerId: string, loserId: string): { ok: boolean; error?: string } {
    if (winnerId === loserId) return { ok: false, error: "A contender can't duel itself." };
    const w = this.store.contenders.find((c) => c.id === winnerId);
    const l = this.store.contenders.find((c) => c.id === loserId);
    if (!w || !l) return { ok: false, error: "Contender not found." };
    if (w.subcategoryId !== l.subcategoryId)
      return { ok: false, error: "Contenders must be in the same food category." };
    const user = this.getUser(userId);
    if (!user) return { ok: false, error: "Sign in to vote." };

    const sub = this.subById(w.subcategoryId);
    const catTrust = sub ? this.catTrustFor(user, sub.slug) : user.trustScore;
    this.store.comparisons.push({
      id: crypto.randomUUID(),
      subcategoryId: w.subcategoryId,
      regionId: w.regionId,
      userId,
      winnerId,
      loserId,
      source: "duel",
      weight: +trustToWeight(catTrust).toFixed(3),
      createdAt: new Date().toISOString(),
    });
    user.ratedCount += 1;
    if (sub) this.growCategoryTrust(user, sub.slug);
    recomputeSubcategory(this.store, w.subcategoryId);
    this.persist();
    return { ok: true };
  }

  recordVote(userId: string, contenderId: string, rating: number): { ok: boolean; error?: string } {
    const con = this.store.contenders.find((c) => c.id === contenderId);
    if (!con) return { ok: false, error: "Contender not found." };
    const user = this.getUser(userId);
    if (!user) return { ok: false, error: "Sign in to rate." };
    const r = Math.max(0, Math.min(100, Math.round(rating)));

    const existing = this.store.votes.find((v) => v.userId === userId && v.contenderId === contenderId);
    const sub = this.subById(con.subcategoryId);
    const catTrust = sub ? this.catTrustFor(user, sub.slug) : user.trustScore;
    const weight = +trustToWeight(catTrust).toFixed(3);
    if (existing) {
      existing.rating = r;
      existing.weight = weight;
    } else {
      this.store.votes.push({
        id: crypto.randomUUID(),
        contenderId,
        userId,
        rating: r,
        weight,
        createdAt: new Date().toISOString(),
      });
    }
    if (sub) this.growCategoryTrust(user, sub.slug);
    recomputeSubcategory(this.store, con.subcategoryId);
    this.persist();
    return { ok: true };
  }

  addPhoto(userId: string, contenderId: string, url: string): Photo | null {
    const con = this.store.contenders.find((c) => c.id === contenderId);
    if (!con) return null;
    const photo: Photo = {
      id: crypto.randomUUID(),
      contenderId,
      uploaderId: userId,
      url,
      status: "pending", // peer-verification gate is a later phase
      vouchCount: 0,
      placeholder: false,
      createdAt: new Date().toISOString(),
    };
    this.store.photos.push(photo);
    this.persist();
    return photo;
  }

  vouchPhoto(userId: string, photoId: string): { ok: boolean } {
    const photo = this.store.photos.find((p) => p.id === photoId);
    if (!photo) return { ok: false };
    photo.vouchCount += 1;
    this.persist();
    return { ok: true };
  }

  getOrCreateUser(name: string): User {
    const handle = slugify(name);
    const existing = this.store.users.find((u) => u.handle === handle && !u.isCurator);
    if (existing) return existing;
    const user: User = {
      id: crypto.randomUUID(),
      handle,
      name: name.trim() || "Taster",
      trustScore: 0.1,
      ratedCount: 0,
      isCurator: false,
      createdAt: new Date().toISOString(),
    };
    this.store.users.push(user);
    this.persist();
    return user;
  }

  getUserByEmail(email: string): User | null {
    const e = email.trim().toLowerCase();
    if (!e) return null;
    return this.store.users.find((u) => (u.email ?? "").toLowerCase() === e) ?? null;
  }

  createPasswordUser(input: { email: string; name: string; passwordHash: string }) {
    const email = input.email.trim().toLowerCase();
    if (this.getUserByEmail(email)) return { ok: false, error: "An account with this email already exists." };
    const display = (input.name || email.split("@")[0] || "Taster").trim();
    const base = slugify(display) || slugify(email.split("@")[0]) || "taster";
    let handle = base;
    for (let n = 2; this.store.users.some((u) => u.handle === handle); n++) handle = `${base}${n}`;
    const user: User = {
      id: crypto.randomUUID(),
      handle,
      name: display.slice(0, 60),
      trustScore: 0.1,
      ratedCount: 0,
      isCurator: false,
      createdAt: new Date().toISOString(),
      email,
      passwordHash: input.passwordHash,
      avatarUrl: null,
    };
    this.store.users.push(user);
    this.persist();
    return { ok: true, user };
  }

  findOrCreateOAuthUser(p: {
    provider: string;
    sub: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  }): User {
    const existing = this.store.users.find(
      (u) => u.oauth?.provider === p.provider && u.oauth?.sub === p.sub,
    );
    if (existing) return existing;

    const display = (p.name || p.email?.split("@")[0] || "Taster").trim();
    const base = slugify(display) || "taster";
    let handle = base;
    for (let n = 2; this.store.users.some((u) => u.handle === handle); n++) handle = `${base}${n}`;

    const user: User = {
      id: crypto.randomUUID(),
      handle,
      name: display.slice(0, 60),
      trustScore: 0.1,
      ratedCount: 0,
      isCurator: false,
      createdAt: new Date().toISOString(),
      email: p.email,
      avatarUrl: p.avatarUrl ?? null,
      oauth: { provider: p.provider, sub: p.sub },
    };
    this.store.users.push(user);
    this.persist();
    return user;
  }

  getUser(id: string): User | null {
    return this.store.users.find((u) => u.id === id) ?? null;
  }

  stats() {
    return {
      contenders: this.store.contenders.length,
      comparisons: this.store.comparisons.length,
      votes: this.store.votes.length,
      subcategories: this.store.subcategories.length,
    };
  }

  publicationStats(): PublicationStat[] {
    // Aggregate every seedSource across live contenders → canonical publication, weight, dish count.
    const agg = new Map<
      string,
      { weight: number; recognized: boolean; examples: PublicationStat["examples"]; count: number }
    >();
    for (const c of this.store.contenders) {
      if (c.status === "hidden" || c.status === "proposed") continue;
      for (const raw of c.seedSources ?? []) {
        const name = publicationName(raw);
        const recognized = name !== raw || publicationWeight(raw) !== DEFAULT_PUBLICATION_WEIGHT;
        let e = agg.get(name);
        if (!e) {
          e = { weight: publicationWeight(raw), recognized, examples: [], count: 0 };
          agg.set(name, e);
        }
        e.count++;
        if (e.examples.length < 4) {
          e.examples.push({ title: c.title, placeName: this.place(c.placeId)?.name ?? "", contenderId: c.id });
        }
      }
    }
    return [...agg.entries()]
      .map(([name, e]) => ({ name, weight: e.weight, dishCount: e.count, recognized: e.recognized, examples: e.examples }))
      .sort((a, b) => b.weight - a.weight || b.dishCount - a.dishCount);
  }

  // --- add-a-place flow ----------------------------------------------------------
  private subBySlug(slug: string): Subcategory | undefined {
    return this.store.subcategories.find((s) => s.slug === slug);
  }

  /** Distinct dish titles already used in a subcategory — the controlled vocabulary (excludes unreviewed/hidden). */
  private dishTitlesIn(subId: string): string[] {
    return Array.from(
      new Set(
        this.store.contenders
          .filter(
            (c) =>
              c.subcategoryId === subId && c.status !== "hidden" && c.status !== "proposed" && c.title,
          )
          .map((c) => c.title),
      ),
    );
  }

  /**
   * The already-stored place that corresponds to a corpus entry: by corpusId first, else by
   * normalized-name + tight proximity (~250m). This reconciles seeded real-data places (whose
   * corpusId is null) with their corpus twins, so a corpus_ id resolves to the existing place
   * instead of duplicating it. Mirrors the seed-time dedup in seed/placeholder.ts.
   */
  private storePlaceForCorpus(cp: { id: string; name: string; lat: number; lng: number }): Place | undefined {
    const byId = this.store.places.find((p) => p.corpusId === cp.id);
    if (byId) return byId;
    const nn = normalizeName(cp.name);
    return this.store.places.find(
      (p) =>
        p.status !== "proposed" &&
        normalizeName(p.name) === nn &&
        Math.abs(p.lat - cp.lat) <= 0.003 &&
        Math.abs(p.lng - cp.lng) <= 0.003,
    );
  }

  /** Build a fast predicate: "is this corpus row already represented by a stored place?" (name + proximity). */
  private corpusTwinChecker(): (cp: { name: string; lat: number; lng: number }) => boolean {
    const idx = new Map<string, Place[]>();
    for (const p of this.store.places) {
      if (p.status === "proposed") continue;
      const k = normalizeName(p.name);
      const arr = idx.get(k);
      if (arr) arr.push(p);
      else idx.set(k, [p]);
    }
    return (cp) => {
      const arr = idx.get(normalizeName(cp.name));
      return !!arr && arr.some((p) => Math.abs(p.lat - cp.lat) <= 0.003 && Math.abs(p.lng - cp.lng) <= 0.003);
    };
  }

  /** Resolve a typed dish name against the category's vocabulary (snap / suggest / new). */
  matchDish(subSlug: string, query: string): DishResolution {
    const sub = this.subBySlug(subSlug);
    if (!sub) return { name: query.trim(), decision: "new", suggestion: null, score: 0 };
    return resolveDishName(query, this.dishTitlesIn(sub.id), sub.name);
  }

  listDishNames(subSlug: string): string[] {
    const sub = this.subBySlug(subSlug);
    return sub ? this.dishTitlesIn(sub.id).sort((a, b) => a.localeCompare(b)) : [];
  }

  /** Rank of an active contender within its subcategory (null if provisional/hidden). */
  private rankOf(con: Contender): number | null {
    if (con.status !== "active") return null;
    const peers = this.store.contenders
      .filter((c) => c.subcategoryId === con.subcategoryId && c.status === "active")
      .sort((a, b) => b.score - a.score || b.sortKey - a.sortKey);
    const idx = peers.findIndex((c) => c.id === con.id);
    return idx >= 0 ? idx + 1 : null;
  }

  searchAllPlaces(query: string, limit = 10): PlaceSearchHit[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const dishCount = (placeId: string) =>
      this.store.contenders.filter((c) => c.placeId === placeId && c.status !== "hidden").length;

    type Scored = PlaceSearchHit & { s: number };
    const hits: Scored[] = [];
    const score = (name: string, address: string, dishes: number) => {
      const nm = name.toLowerCase();
      let s = similarity(query, name); // fuzzy base (typo-tolerant)
      if (nm.includes(q)) s += 1;
      if (nm.startsWith(q)) s += 0.5;
      if (address.toLowerCase().includes(q)) s += 0.3;
      if (dishes > 0) s += 0.15; // mild boost for places already on Bandana
      return s;
    };

    // Corpus rows that are really an existing place (incl. seeded real-data places whose corpusId
    // is null) are deduped by normalized name + proximity so a restaurant never appears twice.
    const corpusHasTwin = this.corpusTwinChecker();

    for (const p of this.store.places) {
      if (p.status === "proposed") continue;
      const dc = dishCount(p.id);
      const s = score(p.name, p.address, dc);
      if (s < 0.5) continue;
      hits.push({
        id: p.id, name: p.name, address: p.address, neighborhood: p.neighborhood,
        borough: p.borough, source: "place", dishCount: dc, s,
      });
    }
    for (const cp of this.corpus) {
      if (corpusHasTwin(cp)) continue; // already represented by a stored place
      const s = score(cp.name, cp.address, 0);
      if (s < 0.62) continue; // higher bar for the big corpus so fuzzy noise doesn't flood
      hits.push({
        id: cp.id, name: cp.name, address: cp.address, neighborhood: cp.borough,
        borough: cp.borough, source: "corpus", dishCount: 0, s,
      });
    }
    hits.sort((a, b) => b.s - a.s || a.name.localeCompare(b.name));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return hits.slice(0, limit).map(({ s, ...h }) => h);
  }

  getPlaceDetail(placeId: string): PlaceDetail | null {
    let place = this.place(placeId);
    let inCorpus = false;
    if (!place && placeId.startsWith("corpus_")) {
      const cp = this.corpus.find((c) => c.id === placeId);
      if (!cp) return null;
      place = this.storePlaceForCorpus(cp); // resolve to an existing place (incl. seeded twins)
      if (!place) {
        // Synthetic (un-persisted) place view: a corpus restaurant with no dishes logged yet.
        place = {
          id: cp.id, name: cp.name, neighborhood: cp.borough, borough: cp.borough,
          address: cp.address, lat: cp.lat, lng: cp.lng, corpusId: cp.id, status: "active",
        };
        inCorpus = true;
      }
    }
    if (!place) return null;

    const dishes: PlaceDishView[] = this.store.contenders
      .filter((c) => c.placeId === place!.id && c.status !== "hidden" && c.status !== "proposed")
      .map((c) => {
        const sub = this.subById(c.subcategoryId);
        const cat = sub ? this.catById(sub.categoryId) : undefined;
        return {
          ...this.toView(c, this.rankOf(c)),
          subSlug: sub?.slug ?? "",
          subName: sub?.name ?? "",
          emoji: sub?.emoji ?? cat?.emoji ?? "",
          categoryName: cat?.name ?? "",
        };
      })
      .sort((a, b) => b.score - a.score);

    return {
      place: {
        id: place.id, name: place.name, address: place.address, neighborhood: place.neighborhood,
        borough: place.borough, lat: place.lat, lng: place.lng,
        isProposed: place.status === "proposed", inCorpus,
      },
      dishes,
      categories: this.listCategories(),
    };
  }

  searchPlaces(query: string, subSlug: string, limit = 8): PlaceHit[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const subId = this.subBySlug(subSlug)?.id;
    const liveDishes = (placeId: string): { id: string; title: string }[] =>
      subId
        ? this.store.contenders
            .filter((c) => c.placeId === placeId && c.subcategoryId === subId && c.status !== "hidden")
            .map((c) => ({ id: c.id, title: c.title }))
        : [];

    type Hit = PlaceHit & { catMatch: boolean };
    const hits: Hit[] = [];
    for (const p of this.store.places) {
      if (p.status === "proposed" || !p.name.toLowerCase().includes(q)) continue;
      hits.push({
        id: p.id, name: p.name, address: p.address, borough: p.borough,
        source: "place", existingDishes: liveDishes(p.id), catMatch: true,
      });
    }
    const hasTwin = this.corpusTwinChecker();
    for (const cp of this.corpus) {
      if (hasTwin(cp) || !cp.name.toLowerCase().includes(q)) continue;
      hits.push({
        id: cp.id, name: cp.name, address: cp.address, borough: cp.borough,
        source: "corpus", existingDishes: [], catMatch: subSlug ? cp.cats.includes(subSlug) : true,
      });
      if (hits.length > limit * 10) break;
    }
    hits.sort((a, b) => {
      if (a.catMatch !== b.catMatch) return a.catMatch ? -1 : 1;
      const aS = a.name.toLowerCase().startsWith(q) ? 1 : 0;
      const bS = b.name.toLowerCase().startsWith(q) ? 1 : 0;
      return bS - aS || a.name.localeCompare(b.name);
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return hits.slice(0, limit).map(({ catMatch, ...h }) => h);
  }

  addContenderAtPlace(userId: string, placeId: string, subSlug: string, title?: string, description?: string) {
    const sub = this.subBySlug(subSlug);
    if (!sub) return { ok: false, error: "Unknown food type." };
    if (!this.getUser(userId)) return { ok: false, error: "Sign in first." };
    if (!title?.trim()) return { ok: false, error: "Add a dish name." };
    const region = this.store.regions[0];

    let place = this.place(placeId);
    if (!place && placeId.startsWith("corpus_")) {
      const cp = this.corpus.find((c) => c.id === placeId);
      if (!cp) return { ok: false, error: "Place not found." };
      place = this.storePlaceForCorpus(cp); // reuse an existing place (incl. seeded twins) — don't fragment
      if (!place) {
        place = {
          id: crypto.randomUUID(), name: cp.name, neighborhood: cp.borough, borough: cp.borough,
          address: cp.address, lat: cp.lat, lng: cp.lng, corpusId: cp.id, status: "active",
        };
        this.store.places.push(place);
      }
    }
    if (!place) return { ok: false, error: "Place not found." };

    // Canonicalize the dish name against the category vocabulary so near-duplicates snap together,
    // THEN dedup by (place × sub × dish). A place can hold several dishes of the same type (two ramens,
    // many pizzas) — only re-adding the SAME dish returns the existing contender.
    const resolvedTitle = resolveDishName(title, this.dishTitlesIn(sub.id), sub.name).name;
    const existing = this.store.contenders.find(
      (c) =>
        c.placeId === place!.id &&
        c.subcategoryId === sub.id &&
        c.status !== "hidden" &&
        normalizeName(c.title) === normalizeName(resolvedTitle),
    );
    if (existing) {
      this.persist();
      return { ok: true, contenderId: existing.id, placeId: place.id };
    }
    const newId = crypto.randomUUID();
    const con: Contender = {
      id: newId, placeId: place.id, subcategoryId: sub.id, regionId: region.id,
      title: resolvedTitle, description: description?.trim() ?? "", dishVariantId: null,
      slug: this.mintSlugFor(sub.id, resolvedTitle, place.name, newId),
      seedSources: [], seedScore: 0, createdBy: userId, createdAt: new Date().toISOString(), theta: 0, rd: 350,
      weightedVotes: 0, comparisonCount: 0, distinctOpponents: 0, score: 0, sortKey: 0, status: "provisional",
      standing: "new", riserScore: 0,
    };
    this.store.contenders.push(con);
    recomputeSubcategory(this.store, sub.id);
    this.persist();
    return { ok: true, contenderId: con.id, placeId: place.id };
  }

  importMenu(input: MenuImportInput): MenuImportResult {
    const region = this.store.regions[0];
    const added: MenuImportResult["added"] = [];
    const skipped: MenuImportResult["skipped"] = [];

    // Resolve / create the place once for the whole menu.
    let place: Place | undefined;
    if (input.placeId) {
      place = this.place(input.placeId);
      if (!place && input.placeId.startsWith("corpus_")) {
        const cp = this.corpus.find((c) => c.id === input.placeId);
        if (cp) {
          place = this.storePlaceForCorpus(cp);
          if (!place) {
            place = {
              id: crypto.randomUUID(), name: cp.name, neighborhood: cp.borough, borough: cp.borough,
              address: cp.address, lat: cp.lat, lng: cp.lng, corpusId: cp.id, status: "active",
            };
            this.store.places.push(place);
          }
        }
      }
    }
    if (!place) {
      // Match an existing place by name + proximity (if coords given), else create one.
      const nn = normalizeName(input.placeName);
      place = this.store.places.find(
        (p) =>
          p.status !== "proposed" &&
          normalizeName(p.name) === nn &&
          (input.lat == null || input.lng == null ||
            (Math.abs(p.lat - input.lat) <= 0.003 && Math.abs(p.lng - input.lng) <= 0.003)),
      );
      if (!place) {
        if (!input.placeName.trim()) return { ok: false, error: "Place name required.", added, skipped };
        place = {
          id: crypto.randomUUID(), name: input.placeName.trim(), neighborhood: input.borough ?? "",
          borough: input.borough ?? "", address: input.address ?? "",
          lat: input.lat ?? region.center.lat, lng: input.lng ?? region.center.lng,
          corpusId: null, status: "active",
        };
        this.store.places.push(place);
      }
    }

    const touchedSubs = new Set<string>();
    for (const item of input.items) {
      const sub = this.subBySlug(item.subSlug);
      if (!sub) {
        skipped.push({ subSlug: item.subSlug, dish: item.dish, reason: "unknown food type" });
        continue;
      }
      if (!item.dish?.trim()) {
        skipped.push({ subSlug: item.subSlug, dish: item.dish, reason: "empty dish name" });
        continue;
      }
      const resolvedTitle = resolveDishName(item.dish, this.dishTitlesIn(sub.id), sub.name).name;
      const existing = this.store.contenders.find(
        (c) =>
          c.placeId === place!.id &&
          c.subcategoryId === sub.id &&
          c.status !== "hidden" &&
          normalizeName(c.title) === normalizeName(resolvedTitle),
      );
      if (existing) {
        skipped.push({ subSlug: item.subSlug, dish: resolvedTitle, reason: "already on this place" });
        continue;
      }
      // Lands UNRANKED at score 0 — earns its way up via duels/ratings, just like a user add.
      const newId = crypto.randomUUID();
      const con: Contender = {
        id: newId, placeId: place.id, subcategoryId: sub.id, regionId: region.id,
        title: resolvedTitle, description: item.description?.trim() ?? "", dishVariantId: null,
        slug: this.mintSlugFor(sub.id, resolvedTitle, place.name, newId),
        seedSources: [], seedScore: 0, createdBy: null, createdAt: new Date().toISOString(), theta: 0,
        rd: 350, weightedVotes: 0, comparisonCount: 0, distinctOpponents: 0, score: 0, sortKey: 0,
        status: "provisional", standing: "new", riserScore: 0,
      };
      this.store.contenders.push(con);
      added.push({ subSlug: item.subSlug, dish: resolvedTitle, contenderId: con.id });
      touchedSubs.add(sub.id);
    }

    for (const subId of touchedSubs) recomputeSubcategory(this.store, subId);
    this.persist();
    return { ok: true, placeId: place.id, added, skipped };
  }

  suggestPlace(userId: string, input: { name: string; address: string; borough?: string; subSlug: string }) {
    const sub = this.subBySlug(input.subSlug);
    if (!sub) return { ok: false, error: "Unknown food type." };
    if (!this.getUser(userId)) return { ok: false, error: "Sign in first." };
    if (!input.name?.trim() || !input.address?.trim()) return { ok: false, error: "Name and address are required." };
    const region = this.store.regions[0];
    const place: Place = {
      id: crypto.randomUUID(), name: input.name.trim(), neighborhood: input.borough ?? "",
      borough: input.borough ?? "", address: input.address.trim(),
      lat: region.center.lat, lng: region.center.lng, corpusId: null, status: "proposed",
    };
    this.store.places.push(place);
    const newId = crypto.randomUUID();
    this.store.contenders.push({
      id: newId, placeId: place.id, subcategoryId: sub.id, regionId: region.id,
      title: sub.name, description: "", dishVariantId: null,
      slug: this.mintSlugFor(sub.id, sub.name, place.name, newId),
      seedSources: [], seedScore: 0, createdBy: userId,
      createdAt: new Date().toISOString(), theta: 0, rd: 350, weightedVotes: 0,
      comparisonCount: 0, distinctOpponents: 0, score: 0, sortKey: 0, status: "proposed",
      standing: "new", riserScore: 0,
    });
    this.persist();
    return { ok: true };
  }

  listProposed(): ProposedItem[] {
    const activePlaces = this.store.places.filter((p) => p.status !== "proposed");
    return this.store.contenders
      .filter((c) => c.status === "proposed")
      .map((c) => {
        const sub = this.subById(c.subcategoryId);
        const pl = this.place(c.placeId);
        // Flag if this suggested place looks like one we already have (dedupe aid for the curator).
        let possibleDuplicate: string | undefined;
        if (pl) {
          let best: { name: string; score: number } | null = null;
          for (const ap of activePlaces) {
            const score = similarity(pl.name, ap.name);
            if (!best || score > best.score) best = { name: ap.name, score };
          }
          if (best && best.score >= MATCH.PLACE_DUP) possibleDuplicate = best.name;
        }
        return {
          contenderId: c.id, title: c.title, placeName: pl?.name ?? "?", address: pl?.address ?? "",
          borough: pl?.borough ?? "", subSlug: sub?.slug ?? "", subName: sub?.name ?? "",
          proposedBy: c.createdBy, possibleDuplicate,
        };
      });
  }

  reviewProposed(contenderId: string, approve: boolean) {
    const con = this.store.contenders.find((c) => c.id === contenderId && c.status === "proposed");
    if (!con) return { ok: false };
    const place = this.place(con.placeId);
    if (approve) {
      con.status = "provisional";
      if (place && place.status === "proposed") place.status = "active";
      recomputeSubcategory(this.store, con.subcategoryId);
    } else {
      this.store.contenders = this.store.contenders.filter((c) => c.id !== contenderId);
      if (place && place.status === "proposed" && !this.store.contenders.some((c) => c.placeId === place.id)) {
        this.store.places = this.store.places.filter((p) => p.id !== place.id);
      }
    }
    this.persist();
    return { ok: true };
  }

  // --- social graph --------------------------------------------------------------
  /** Count of users who follow the given user id. */
  private followerCountOf(userId: string): number {
    let n = 0;
    for (const u of this.store.users) if ((u.following ?? []).includes(userId)) n++;
    return n;
  }
  private viewerFollows(viewerId: string | undefined, targetId: string): boolean {
    if (!viewerId) return false;
    const v = this.getUser(viewerId);
    return !!v && (v.following ?? []).includes(targetId);
  }
  private toUserCard(u: User, viewerId?: string): UserCard {
    const expertSlugs = u.expertCategories ?? [];
    return {
      handle: u.handle,
      name: u.name,
      avatarUrl: u.avatarUrl ?? null,
      bio: u.bio ?? "",
      isCurator: u.isCurator,
      followerCount: this.followerCountOf(u.id),
      followedByViewer: this.viewerFollows(viewerId, u.id),
      expertIn: this.expertBadges(u, expertSlugs),
      goTos: this.favePicks(u, expertSlugs)
        .slice(0, 2)
        .map((p) => ({ subSlug: p.subSlug, emoji: p.emoji, title: p.contender.title, placeName: p.contender.placeName })),
    };
  }

  /** Resolve the user's self-declared expertise slugs into badge data (★ = curator-recognized). */
  private expertBadges(u: User, slugs: string[]): UserCard["expertIn"] {
    const out: UserCard["expertIn"] = [];
    for (const slug of slugs) {
      const sub = this.subBySlug(slug);
      if (!sub) continue;
      out.push({ subSlug: slug, subName: sub.name, emoji: sub.emoji, verified: u.categoryRoles?.[slug] === "member" });
    }
    return out;
  }

  /**
   * The "go-to" #1 favorites for a set of categories (in slug order = the user's priority): their
   * declared #1 (categoryFavorites) per category, falling back to their personal #1 from ratings/duels.
   * Shared by the follow card (top 2) and the profile gold rail.
   */
  private favePicks(
    user: User,
    slugs: string[],
  ): Array<{ subSlug: string; subName: string; emoji: string; contender: ContenderView }> {
    const out: Array<{ subSlug: string; subName: string; emoji: string; contender: ContenderView }> = [];
    for (const slug of slugs) {
      const sub = this.subBySlug(slug);
      if (!sub) continue;
      const favId = user.categoryFavorites?.[slug];
      let pick: ContenderView | undefined;
      if (favId) {
        const con = this.store.contenders.find((c) => c.id === favId && c.status !== "hidden");
        if (con) pick = this.toView(con, null);
      }
      if (!pick) pick = this.getPersonalRankedList(user.id, slug)[0];
      if (pick) out.push({ subSlug: slug, subName: sub.name, emoji: sub.emoji, contender: pick });
    }
    return out;
  }

  setFollow(userId: string, targetHandle: string, follow: boolean): { ok: boolean; error?: string } {
    const me = this.getUser(userId);
    if (!me) return { ok: false, error: "Sign in to follow." };
    const target = this.store.users.find((u) => u.handle === targetHandle);
    if (!target) return { ok: false, error: "User not found." };
    if (target.id === me.id) return { ok: false, error: "You can't follow yourself." };
    const list = new Set(me.following ?? []);
    if (follow) list.add(target.id);
    else list.delete(target.id);
    me.following = [...list];
    this.persist();
    return { ok: true };
  }

  getFollowers(handle: string, viewerId?: string): UserCard[] {
    const target = this.store.users.find((u) => u.handle === handle);
    if (!target) return [];
    return this.store.users
      .filter((u) => (u.following ?? []).includes(target.id))
      .map((u) => this.toUserCard(u, viewerId))
      .sort((a, b) => b.followerCount - a.followerCount);
  }

  getFollowing(handle: string, viewerId?: string): UserCard[] {
    const target = this.store.users.find((u) => u.handle === handle);
    if (!target) return [];
    const ids = new Set(target.following ?? []);
    return this.store.users
      .filter((u) => ids.has(u.id))
      .map((u) => this.toUserCard(u, viewerId))
      .sort((a, b) => b.followerCount - a.followerCount);
  }

  getFollowingFeed(userId: string, limit = 40): FeedItem[] {
    const me = this.getUser(userId);
    if (!me) return [];
    const following = new Set(me.following ?? []);
    if (following.size === 0) return [];
    const actorOf = (id: string) => this.store.users.find((u) => u.id === id);
    const conTitle = (id: string) => this.store.contenders.find((c) => c.id === id);
    const items: FeedItem[] = [];

    for (const cmp of this.store.comparisons) {
      if (!following.has(cmp.userId) || cmp.source !== "duel") continue;
      const actor = actorOf(cmp.userId);
      const win = conTitle(cmp.winnerId);
      const lose = conTitle(cmp.loserId);
      if (!actor || !win) continue;
      const sub = this.subById(win.subcategoryId);
      items.push({
        id: cmp.id,
        kind: "duel",
        at: cmp.createdAt,
        actor: { handle: actor.handle, name: actor.name, avatarUrl: actor.avatarUrl ?? null },
        contenderId: win.id,
        dishTitle: win.title,
        placeName: this.place(win.placeId)?.name ?? "",
        subSlug: sub?.slug ?? "",
        subName: sub?.name ?? "",
        emoji: sub?.emoji ?? "",
        loserTitle: lose?.title,
      });
    }
    // Comparison-only: the feed surfaces duels, not 0–100 ratings.
    items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    return items.slice(0, limit);
  }

  topTasters(viewerId: string | undefined, limit = 10): UserCard[] {
    return this.store.users
      .map((u) => this.toUserCard(u, viewerId))
      .filter((c) => c.followerCount > 0 || c.isCurator)
      .sort((a, b) => b.followerCount - a.followerCount)
      .slice(0, limit);
  }

  trendingRisers(limit = 12): SearchHitContender[] {
    return this.store.contenders
      .filter((c) => c.status !== "proposed" && c.status !== "hidden" && (c.riserScore ?? 0) > 0)
      .sort((a, b) => (b.riserScore ?? 0) - (a.riserScore ?? 0))
      .slice(0, limit)
      .map((c) => {
        const sub = this.subById(c.subcategoryId);
        return { ...this.toView(c, null), subSlug: sub?.slug ?? "", subName: sub?.name ?? "", emoji: sub?.emoji ?? "" };
      });
  }

  suggestedFollows(viewerId: string | undefined, limit = 8): UserCard[] {
    const viewer = viewerId ? this.getUser(viewerId) : null;
    const already = new Set(viewer?.following ?? []);
    return this.store.users
      .filter((u) => u.id !== viewerId && !already.has(u.id))
      .map((u) => ({ card: this.toUserCard(u, viewerId), activity: u.ratedCount }))
      // Surface trusted, active, well-followed tasters first.
      .sort((a, b) => b.card.followerCount - a.card.followerCount || b.activity - a.activity)
      .slice(0, limit)
      .map((x) => x.card);
  }

  // --- profiles + pinnacle -------------------------------------------------------
  getProfile(handle: string, viewerId?: string): ProfileView | null {
    const user = this.store.users.find((u) => u.handle === handle);
    if (!user) return null;

    const pinnacle: PinnacleItem[] = [];
    for (const cid of user.pinnacle ?? []) {
      const con = this.store.contenders.find((c) => c.id === cid && c.status !== "hidden");
      if (!con) continue;
      const sub = this.subById(con.subcategoryId);
      pinnacle.push({
        ...this.toView(con, null),
        subSlug: sub?.slug ?? "",
        subName: sub?.name ?? "",
        emoji: sub?.emoji ?? "",
      });
    }

    // "#1 Picks" — for each showcased category, the user's declared favorite (from onboarding),
    // falling back to their personal #1 from ratings/duels. This is the gold headline of the profile.
    const topPicks: ProfileView["topPicks"] = [];
    const showcase: ProfileView["showcase"] = [];
    for (const slug of user.showcase ?? []) {
      const sub = this.store.subcategories.find((s) => s.slug === slug);
      if (!sub) continue;
      const personal = this.getPersonalRankedList(user.id, slug);
      showcase.push({ subSlug: slug, subName: sub.name, emoji: sub.emoji, items: personal.slice(0, 8) });

      const favId = user.categoryFavorites?.[slug];
      let pick: ContenderView | undefined;
      if (favId) {
        const con = this.store.contenders.find((c) => c.id === favId && c.status !== "hidden");
        if (con) pick = this.toView(con, null);
      }
      if (!pick && personal[0]) pick = personal[0];
      if (pick) topPicks.push({ subSlug: slug, subName: sub.name, emoji: sub.emoji, contender: pick });
    }

    return {
      handle: user.handle,
      name: user.name,
      bio: user.bio ?? "",
      avatarUrl: user.avatarUrl ?? null,
      trustScore: user.trustScore,
      ratedCount: user.ratedCount,
      isCurator: user.isCurator,
      expertIn: this.expertBadges(user, user.expertCategories ?? []),
      followerCount: this.followerCountOf(user.id),
      followingCount: (user.following ?? []).length,
      followedByViewer: this.viewerFollows(viewerId, user.id),
      isSelf: !!viewerId && viewerId === user.id,
      pinnacle,
      topPicks,
      showcase,
    };
  }

  updateProfile(userId: string, patch: { name?: string; bio?: string; showcase?: string[]; expertCategories?: string[] }): { ok: boolean } {
    const user = this.getUser(userId);
    if (!user) return { ok: false };
    if (typeof patch.name === "string" && patch.name.trim()) user.name = patch.name.trim().slice(0, 60);
    if (typeof patch.bio === "string") user.bio = patch.bio.slice(0, 280);
    const valid = new Set(this.store.subcategories.map((s) => s.slug));
    if (Array.isArray(patch.showcase)) {
      user.showcase = patch.showcase.filter((s) => valid.has(s)).slice(0, 8);
    }
    // Expert categories: ≤3, always a SUBSET of showcase. Run after showcase so dropping a category
    // from showcase auto-drops it from expert.
    if (Array.isArray(patch.expertCategories)) {
      const show = new Set(user.showcase ?? []);
      user.expertCategories = patch.expertCategories.filter((s) => valid.has(s) && show.has(s)).slice(0, 3);
    } else if (user.expertCategories) {
      // Showcase changed without an explicit expert update → prune any now-invalid expert slugs.
      const show = new Set(user.showcase ?? []);
      user.expertCategories = user.expertCategories.filter((s) => show.has(s));
    }
    this.persist();
    return { ok: true };
  }

  setHandle(userId: string, raw: string): { ok: boolean; error?: string; handle?: string } {
    const user = this.getUser(userId);
    if (!user) return { ok: false, error: "Sign in first." };
    const handle = slugify(raw);
    if (!handle || handle === "taster") return { ok: false, error: "Pick a username (letters and numbers)." };
    if (handle.length < 2 || handle.length > 30) return { ok: false, error: "Username must be 2–30 characters." };
    if (handle === user.handle) return { ok: true, handle }; // no-op
    if (this.store.users.some((u) => u.id !== userId && u.handle === handle)) {
      return { ok: false, error: "That username is taken." };
    }
    user.handle = handle;
    this.persist();
    return { ok: true, handle };
  }

  hideContender(contenderId: string): { ok: boolean; error?: string } {
    const con = this.store.contenders.find((c) => c.id === contenderId);
    if (!con) return { ok: false, error: "Contender not found." };
    con.status = "hidden";
    recomputeSubcategory(this.store, con.subcategoryId);
    this.persist();
    return { ok: true };
  }

  setAvatar(userId: string, url: string): { ok: boolean } {
    const user = this.getUser(userId);
    if (!user) return { ok: false };
    user.avatarUrl = url;
    this.persist();
    return { ok: true };
  }

  setCategoryRole(curatorId: string, targetUserId: string, subSlug: string, role: "member" | null) {
    const curator = this.getUser(curatorId);
    if (!curator?.isCurator) return { ok: false, error: "Curator access required." };
    const sub = this.store.subcategories.find((s) => s.slug === subSlug);
    if (!sub) return { ok: false, error: "Unknown food type." };
    const target = this.getUser(targetUserId);
    if (!target) return { ok: false, error: "User not found." };
    if (role === null) {
      if (target.categoryRoles) delete target.categoryRoles[subSlug];
    } else {
      if (!target.categoryRoles) target.categoryRoles = {};
      target.categoryRoles[subSlug] = role;
    }
    this.persist();
    return { ok: true };
  }

  getCategoryFavorite(userId: string, subSlug: string): string | null {
    const user = this.getUser(userId);
    return user?.categoryFavorites?.[subSlug] ?? null;
  }

  getCategoryStanding(userId: string, subSlug: string) {
    const user = this.getUser(userId);
    if (!user) return null;
    const sub = this.subBySlug(subSlug);
    if (!sub) return null;
    const trust = this.catTrustFor(user, subSlug);
    const cap = this.catTrustCap(user, subSlug);
    const role = user.categoryRoles?.[subSlug] ?? null;
    return { trust, cap, role, weight: +trustToWeight(trust).toFixed(2) };
  }

  setCategoryFavorite(userId: string, subSlug: string, contenderId: string): { ok: boolean; error?: string } {
    const user = this.getUser(userId);
    if (!user) return { ok: false, error: "Sign in." };
    const sub = this.store.subcategories.find((s) => s.slug === subSlug);
    if (!sub) return { ok: false, error: "Unknown food type." };
    const con = this.store.contenders.find((c) => c.id === contenderId && c.subcategoryId === sub.id);
    if (!con) return { ok: false, error: "Dish not found in this category." };
    if (!user.categoryFavorites) user.categoryFavorites = {};
    user.categoryFavorites[subSlug] = contenderId;
    this.persist();
    return { ok: true };
  }

  pinnacleAction(userId: string, contenderId: string, action: "add" | "remove" | "up" | "down") {
    const user = this.getUser(userId);
    if (!user) return { ok: false, error: "Sign in." };
    const list = (user.pinnacle ?? []).slice();
    const idx = list.indexOf(contenderId);
    if (action === "add") {
      if (idx === -1) {
        if (!this.store.contenders.find((c) => c.id === contenderId)) return { ok: false, error: "Dish not found." };
        if (list.length >= 25) return { ok: false, error: "Your Pinnacle is full (25 max)." };
        list.push(contenderId);
      }
    } else if (action === "remove") {
      if (idx !== -1) list.splice(idx, 1);
    } else if (action === "up" && idx > 0) {
      [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
    } else if (action === "down" && idx !== -1 && idx < list.length - 1) {
      [list[idx + 1], list[idx]] = [list[idx], list[idx + 1]];
    }
    user.pinnacle = list;
    this.persist();
    return { ok: true };
  }
}
