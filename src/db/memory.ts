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
  RankedList,
  Repository,
  SearchHitContender,
  SearchResults,
  ShowcaseEntry,
} from "./repo";
import { saveStore } from "./store";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "taster";

export class MemoryRepository implements Repository {
  constructor(private store: StoreData) {}

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
    const provisional = cons.filter((c) => c.status !== "active").sort((a, b) => b.score - a.score);

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

  getDuelPair(subSlug?: string): DuelPair | null {
    let subcategory: Subcategory | undefined;
    if (subSlug) subcategory = this.store.subcategories.find((s) => s.slug === subSlug);
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

    // Pick A preferring higher uncertainty (rd), then B preferring a close, also-uncertain opponent
    // with an exploration chance. This is the lightweight active-pairing sampler.
    const byUncertainty = [...pool].sort((a, b) => b.rd - a.rd);
    const a = byUncertainty[Math.floor(Math.random() * Math.min(pool.length, Math.ceil(pool.length / 2)))];
    const rest = pool.filter((c) => c.id !== a.id);
    let b: Contender;
    if (Math.random() < 0.25) {
      b = rest[Math.floor(Math.random() * rest.length)];
    } else {
      const close = rest.sort(
        (x, y) => Math.abs(x.sortKey - a.sortKey) - Math.abs(y.sortKey - a.sortKey),
      );
      const top = close.slice(0, Math.min(4, close.length));
      b = top[Math.floor(Math.random() * top.length)];
    }
    return {
      category,
      subcategory,
      a: this.toView(a, null),
      b: this.toView(b, null),
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

  recordVote(userId: string, contenderId: string, value: 1 | -1): { ok: boolean; error?: string } {
    const con = this.store.contenders.find((c) => c.id === contenderId);
    if (!con) return { ok: false, error: "Contender not found." };
    const user = this.getUser(userId);
    if (!user) return { ok: false, error: "Sign in to vote." };

    const existing = this.store.votes.find((v) => v.userId === userId && v.contenderId === contenderId);
    const weight = +trustToWeight(user.trustScore).toFixed(3);
    if (existing) {
      existing.value = value;
      existing.weight = weight;
    } else {
      this.store.votes.push({
        id: crypto.randomUUID(),
        contenderId,
        userId,
        value,
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
}
