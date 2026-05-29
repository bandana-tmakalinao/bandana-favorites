import { RANKING, type ConfidenceTier } from "@/lib/config";
import { trustToWeight } from "@/lib/ranking";
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
  CategoryWithSubs,
  ContenderDetail,
  DuelPair,
  PlaceHit,
  ProposedItem,
  RankedList,
  Repository,
  SearchHitContender,
  SearchResults,
  ShowcaseEntry,
} from "./repo";
import { type CorpusPlace, saveStore } from "./store";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "taster";

export class MemoryRepository implements Repository {
  constructor(
    private store: StoreData,
    private corpus: CorpusPlace[] = [],
  ) {}

  private persist() {
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
  private toView(con: Contender, rank: number | null): ContenderView {
    const pl = this.place(con.placeId);
    return {
      id: con.id,
      rank,
      title: con.title,
      placeName: pl?.name ?? "Unknown",
      neighborhood: pl?.neighborhood ?? "",
      borough: pl?.borough ?? "",
      lat: pl?.lat ?? 0,
      lng: pl?.lng ?? 0,
      score: con.score,
      tier: this.tierFor(con),
      weightedVotes: Math.round(con.weightedVotes * 10) / 10,
      comparisonCount: con.comparisonCount,
      photoUrl: this.photoUrlFor(con.id),
      seedSources: con.seedSources ?? [],
    };
  }

  getRegion(slug: string): Region | null {
    return this.store.regions.find((r) => r.slug === slug) ?? null;
  }

  listCategories(): CategoryWithSubs[] {
    const cats = [...this.store.categories].sort((a, b) => a.sort - b.sort);
    return cats.map((category) => {
      const subs = this.store.subcategories
        .filter((s) => s.categoryId === category.id)
        .map((s) => {
          const cons = this.store.contenders.filter((c) => c.subcategoryId === s.id);
          const top = [...cons].sort((a, b) => b.sortKey - a.sortKey)[0];
          return {
            ...s,
            contenderCount: cons.length,
            topPhotoUrl: top ? this.photoUrlFor(top.id) : null,
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
    const active = cons.filter((c) => c.status === "active").sort((a, b) => b.sortKey - a.sortKey);
    const provisional = cons.filter((c) => c.status === "provisional").sort((a, b) => b.score - a.score);

    return {
      region,
      category,
      subcategory,
      ranked: active.map((c, i) => this.toView(c, i + 1)),
      contenders: provisional.map((c) => this.toView(c, null)),
    };
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
      .filter((s) => s.name.toLowerCase().includes(q) || s.slug.replace(/-/g, " ").includes(q))
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

  getDuelPair(subSlug?: string, keepId?: string): DuelPair | null {
    let subcategory: Subcategory | undefined;
    const king = keepId ? this.store.contenders.find((c) => c.id === keepId) : undefined;
    if (king) subcategory = this.subById(king.subcategoryId);
    if (!subcategory && subSlug) subcategory = this.store.subcategories.find((s) => s.slug === subSlug);
    if (!subcategory) {
      const eligible = this.store.subcategories.filter(
        (s) => this.store.contenders.filter((c) => c.subcategoryId === s.id).length >= 2,
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
    // "b" = a fresh challenger: close in score & uncertain, with an exploration chance.
    const rest = pool.filter((c) => c.id !== a.id);
    let b: Contender;
    if (Math.random() < 0.25) {
      b = rest[Math.floor(Math.random() * rest.length)];
    } else {
      const close = rest.sort((x, y) => Math.abs(x.sortKey - a.sortKey) - Math.abs(y.sortKey - a.sortKey));
      const top = close.slice(0, Math.min(4, close.length));
      b = top[Math.floor(Math.random() * top.length)];
    }
    return { category, subcategory, a: this.toView(a, null), b: this.toView(b, null) };
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

    this.store.comparisons.push({
      id: crypto.randomUUID(),
      subcategoryId: w.subcategoryId,
      regionId: w.regionId,
      userId,
      winnerId,
      loserId,
      source: "duel",
      weight: +trustToWeight(user.trustScore).toFixed(3),
      createdAt: new Date().toISOString(),
    });
    user.ratedCount += 1;
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
    const weight = +trustToWeight(user.trustScore).toFixed(3);
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

  // --- add-a-place flow ----------------------------------------------------------
  private subBySlug(slug: string): Subcategory | undefined {
    return this.store.subcategories.find((s) => s.slug === slug);
  }

  searchPlaces(query: string, subSlug: string, limit = 8): PlaceHit[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const subId = this.subBySlug(subSlug)?.id;
    const liveContender = (placeId: string) =>
      subId
        ? (this.store.contenders.find(
            (c) => c.placeId === placeId && c.subcategoryId === subId && c.status !== "hidden",
          )?.id ?? null)
        : null;

    type Hit = PlaceHit & { catMatch: boolean };
    const hits: Hit[] = [];
    for (const p of this.store.places) {
      if (p.status === "proposed" || !p.name.toLowerCase().includes(q)) continue;
      hits.push({
        id: p.id, name: p.name, address: p.address, borough: p.borough,
        source: "place", existingContenderId: liveContender(p.id), catMatch: true,
      });
    }
    const usedCorpus = new Set(this.store.places.map((p) => p.corpusId).filter(Boolean) as string[]);
    for (const cp of this.corpus) {
      if (usedCorpus.has(cp.id) || !cp.name.toLowerCase().includes(q)) continue;
      hits.push({
        id: cp.id, name: cp.name, address: cp.address, borough: cp.borough,
        source: "corpus", existingContenderId: null, catMatch: subSlug ? cp.cats.includes(subSlug) : true,
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

  addContenderAtPlace(userId: string, placeId: string, subSlug: string) {
    const sub = this.subBySlug(subSlug);
    if (!sub) return { ok: false, error: "Unknown food type." };
    if (!this.getUser(userId)) return { ok: false, error: "Sign in first." };
    const region = this.store.regions[0];

    let place = this.place(placeId);
    if (!place && placeId.startsWith("corpus_")) {
      place = this.store.places.find((p) => p.corpusId === placeId);
      if (!place) {
        const cp = this.corpus.find((c) => c.id === placeId);
        if (!cp) return { ok: false, error: "Place not found." };
        place = {
          id: crypto.randomUUID(), name: cp.name, neighborhood: cp.borough, borough: cp.borough,
          address: cp.address, lat: cp.lat, lng: cp.lng, corpusId: cp.id, status: "active",
        };
        this.store.places.push(place);
      }
    }
    if (!place) return { ok: false, error: "Place not found." };

    const existing = this.store.contenders.find(
      (c) => c.placeId === place!.id && c.subcategoryId === sub.id && c.status !== "hidden",
    );
    if (existing) {
      this.persist();
      return { ok: true, contenderId: existing.id };
    }
    const con: Contender = {
      id: crypto.randomUUID(), placeId: place.id, subcategoryId: sub.id, regionId: region.id,
      title: sub.name, dishVariantId: null, seedSources: [], createdBy: userId,
      createdAt: new Date().toISOString(), theta: 0, rd: 350, weightedVotes: 0,
      comparisonCount: 0, distinctOpponents: 0, score: 50, sortKey: 0, status: "provisional",
    };
    this.store.contenders.push(con);
    recomputeSubcategory(this.store, sub.id);
    this.persist();
    return { ok: true, contenderId: con.id };
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
    this.store.contenders.push({
      id: crypto.randomUUID(), placeId: place.id, subcategoryId: sub.id, regionId: region.id,
      title: sub.name, dishVariantId: null, seedSources: [], createdBy: userId,
      createdAt: new Date().toISOString(), theta: 0, rd: 350, weightedVotes: 0,
      comparisonCount: 0, distinctOpponents: 0, score: 50, sortKey: 0, status: "proposed",
    });
    this.persist();
    return { ok: true };
  }

  listProposed(): ProposedItem[] {
    return this.store.contenders
      .filter((c) => c.status === "proposed")
      .map((c) => {
        const sub = this.subById(c.subcategoryId);
        const pl = this.place(c.placeId);
        return {
          contenderId: c.id, title: c.title, placeName: pl?.name ?? "?", address: pl?.address ?? "",
          borough: pl?.borough ?? "", subSlug: sub?.slug ?? "", subName: sub?.name ?? "", proposedBy: c.createdBy,
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
}
