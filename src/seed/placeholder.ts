/**
 * Deterministic synthetic NYC dataset so every screen has content out of the box.
 *
 * IMPORTANT: place names here are FICTIONAL placeholders, not real NYC restaurants, and photos are
 * generic stock keyed by food type — none of this implies a real ranking. The real-data pipeline
 * (Overture + NYC OpenData, curator-seeded order, user photos) is specced in
 * docs/data-sourcing-research.md and replaces all of this. Generated with a seeded RNG so the
 * placeholder ranking is stable across runs.
 */
import { rankSubcategory, trustToWeight, type EvidenceClass } from "../lib/ranking";
import { NYC, SOURCE, publicationWeight } from "../lib/config";
import { normalizeName } from "../lib/match";
// Real, consensus-seeded datasets keyed by subcategory slug (the rest are fictional placeholders).
import { REAL_DATA } from "./real-data";
import type {
  Category,
  Comparison,
  Contender,
  Photo,
  Place,
  Region,
  StoreData,
  Subcategory,
  User,
  Vote,
} from "../lib/types";

// --- deterministic RNG (mulberry32) -------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = 0x6e7963; // "nyc"
const rng = mulberry32(SEED);
const rand = (lo: number, hi: number) => lo + rng() * (hi - lo);
const randInt = (lo: number, hi: number) => Math.floor(rand(lo, hi + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const GENERATED_AT = "2026-05-29T00:00:00.000Z";
// Synthetic seed evidence is dated well in the past so it never counts as "recent" for the risers
// shelf — only real, post-launch user activity should register as up-and-coming.
const SEED_EVIDENCE_AT = "2026-01-15T00:00:00.000Z";

/** Σ publication weights backing a contender (the publication-class volume). */
function pubVolumeOf(seedSources: string[]): number {
  return (seedSources ?? []).reduce((sum, s) => sum + publicationWeight(s), 0);
}

// --- taxonomy -----------------------------------------------------------------
interface CatDef {
  slug: string;
  name: string;
  kind: Category["kind"];
  emoji: string;
}
interface SubDef {
  slug: string;
  cat: string;
  name: string;
  emoji: string;
  blurb: string;
  suffix: string; // venue-name suffix, e.g. "Ramen-ya"
  img: string; // image keyword
  dishes: string[];
}

const CATS: CatDef[] = [
  { slug: "pizza", name: "Pizza", kind: "format", emoji: "🍕" },
  { slug: "bakery", name: "Bakery & Bagels", kind: "format", emoji: "🥯" },
  { slug: "deli", name: "Deli & Sandwiches", kind: "format", emoji: "🥪" },
  { slug: "japanese", name: "Japanese", kind: "cuisine", emoji: "🍜" },
  { slug: "chinese", name: "Chinese", kind: "cuisine", emoji: "🥟" },
  { slug: "mexican", name: "Mexican", kind: "cuisine", emoji: "🌮" },
  { slug: "korean", name: "Korean", kind: "cuisine", emoji: "🍗" },
  { slug: "vietnamese", name: "Vietnamese", kind: "cuisine", emoji: "🍲" },
  { slug: "indian", name: "Indian", kind: "cuisine", emoji: "🍛" },
  { slug: "burgers", name: "Burgers", kind: "format", emoji: "🍔" },
  { slug: "steakhouse", name: "Steak", kind: "format", emoji: "🥩" },
  { slug: "seafood", name: "Seafood", kind: "format", emoji: "🦞" },
  { slug: "street", name: "Street Food", kind: "format", emoji: "🌭" },
  { slug: "dessert", name: "Dessert", kind: "dessert", emoji: "🍰" },
];

const SUBS: SubDef[] = [
  { slug: "pizza", cat: "pizza", name: "Pizza", emoji: "🍕", blurb: "Slices to whole pies — the city's best.", suffix: "Pizza", img: "pizza", dishes: ["Plain Slice", "Margherita Pie", "Pepperoni Slice", "Grandma Square", "Vodka Slice"] },
  { slug: "bagel", cat: "bakery", name: "Bagel & Lox", emoji: "🥯", blurb: "Hand-rolled, boiled, blistered.", suffix: "Bagels", img: "bagel", dishes: ["Everything w/ Scallion", "Lox & Cream Cheese", "BEC on a Bagel", "Sesame w/ Plain"] },
  { slug: "black-and-white-cookie", cat: "bakery", name: "Black-and-White Cookie", emoji: "🍪", blurb: "Half vanilla, half chocolate, all NYC.", suffix: "Bakery", img: "black+white+cookie", dishes: ["Black-and-White Cookie"] },
  { slug: "pastrami", cat: "deli", name: "Pastrami on Rye", emoji: "🥪", blurb: "The towering NYC deli classic.", suffix: "Delicatessen", img: "pastrami+sandwich", dishes: ["Pastrami on Rye", "Pastrami Reuben", "Hot Pastrami Club"] },
  { slug: "chopped-cheese", cat: "deli", name: "Chopped Cheese", emoji: "🧀", blurb: "The bodega-born griddled icon.", suffix: "Deli & Grocery", img: "chopped+cheese+sandwich", dishes: ["The Chopped Cheese"] },
  { slug: "bacon-egg-cheese", cat: "deli", name: "Bacon, Egg & Cheese", emoji: "🥓", blurb: "The NYC breakfast sandwich.", suffix: "Deli", img: "breakfast+sandwich", dishes: ["BEC on a Roll", "BEC on a Bagel"] },
  { slug: "ramen", cat: "japanese", name: "Ramen", emoji: "🍜", blurb: "Tonkotsu to shoyu — the city's best bowls.", suffix: "Ramen-ya", img: "ramen", dishes: ["Tonkotsu", "Spicy Miso", "Shoyu", "Black Garlic Tonkotsu", "Tsukemen", "Vegan Shio", "Tantanmen"] },
  { slug: "soup-dumplings", cat: "chinese", name: "Soup Dumplings", emoji: "🥟", blurb: "XLB with the perfect skin-to-soup ratio.", suffix: "Dumpling House", img: "soup+dumpling", dishes: ["Pork XLB", "Crab & Pork XLB", "Truffle XLB", "Chicken XLB"] },
  { slug: "dim-sum", cat: "chinese", name: "Dim Sum", emoji: "🥡", blurb: "Carts, baskets, and har gow.", suffix: "Palace", img: "dim+sum", dishes: ["Har Gow", "Shu Mai", "BBQ Pork Bun", "Turnip Cake", "Rice Noodle Roll"] },
  { slug: "tacos", cat: "mexican", name: "Tacos", emoji: "🌮", blurb: "Al pastor to carnitas, the whole spread.", suffix: "Taqueria", img: "tacos", dishes: ["Al Pastor", "Carnitas", "Suadero", "Lengua", "Pollo Asado"] },
  { slug: "korean-fried-chicken", cat: "korean", name: "Korean Fried Chicken", emoji: "🍗", blurb: "Double-fried, soy-garlic or spicy.", suffix: "Chicken", img: "korean+fried+chicken", dishes: ["Soy Garlic", "Spicy Yangnyeom", "Half & Half"] },
  { slug: "pho", cat: "vietnamese", name: "Pho", emoji: "🍲", blurb: "Long-simmered broth, the real test.", suffix: "Pho House", img: "pho", dishes: ["Pho Tai", "Pho Dac Biet", "Oxtail Pho", "Chicken Pho"] },
  { slug: "dosa", cat: "indian", name: "Dosa", emoji: "🥞", blurb: "Crispy South Indian crepe.", suffix: "Dosa House", img: "dosa", dishes: ["Masala Dosa", "Ghee Roast", "Rava Dosa"] },
  { slug: "cheeseburger", cat: "burgers", name: "Cheeseburger", emoji: "🍔", blurb: "Smash to pub, the best patties.", suffix: "Burger Joint", img: "cheeseburger", dishes: ["Double Smash", "Bacon Cheeseburger", "Classic Single", "Pub Burger"] },
  { slug: "steak", cat: "steakhouse", name: "Steak", emoji: "🥩", blurb: "Dry-aged porterhouse to the perfect ribeye.", suffix: "Steakhouse", img: "steak", dishes: ["Dry-Aged Porterhouse", "Bone-In Ribeye", "Filet Mignon", "NY Strip"] },
  { slug: "lobster-roll", cat: "seafood", name: "Lobster Roll", emoji: "🦞", blurb: "Maine cold or Connecticut warm.", suffix: "Seafood", img: "lobster+roll", dishes: ["Maine-Style", "Connecticut-Style"] },
  { slug: "halal-cart", cat: "street", name: "Halal Cart", emoji: "🍛", blurb: "Chicken over rice, white sauce, red sauce.", suffix: "Halal", img: "chicken+over+rice", dishes: ["Chicken Over Rice", "Combo Over Rice", "Lamb Over Rice"] },
  { slug: "hot-dog", cat: "street", name: "Hot Dog", emoji: "🌭", blurb: "Griddled, dirty-water, and specialty dogs.", suffix: "Hot Dogs", img: "hot+dog", dishes: ["Classic Dog", "Chili Cheese Dog", "Bacon-Wrapped"] },
  { slug: "cheesecake", cat: "dessert", name: "New York Cheesecake", emoji: "🍰", blurb: "Dense, tall, the NYC dessert.", suffix: "Bakery", img: "cheesecake", dishes: ["Classic Slice", "Strawberry", "Burnt Basque"] },
  { slug: "cannoli", cat: "dessert", name: "Cannoli", emoji: "🧁", blurb: "Crisp shell, sweet ricotta cream.", suffix: "Pasticceria", img: "cannoli", dishes: ["Classic Cannoli", "Chocolate-Dipped", "Pistachio"] },
  { slug: "ice-cream", cat: "dessert", name: "Ice Cream", emoji: "🍦", blurb: "Scoops, soft-serve, gelato.", suffix: "Creamery", img: "ice+cream", dishes: ["Soft Serve Twist", "Pistachio Scoop", "Black Sesame", "Brown Sugar Boba"] },
];

const NEIGHBORHOODS: Array<{ name: string; borough: string; lat: number; lng: number }> = [
  { name: "East Village", borough: "Manhattan", lat: 40.7265, lng: -73.9815 },
  { name: "West Village", borough: "Manhattan", lat: 40.7358, lng: -74.0036 },
  { name: "Lower East Side", borough: "Manhattan", lat: 40.715, lng: -73.9843 },
  { name: "Chinatown", borough: "Manhattan", lat: 40.7158, lng: -73.997 },
  { name: "Koreatown", borough: "Manhattan", lat: 40.7478, lng: -73.9866 },
  { name: "Harlem", borough: "Manhattan", lat: 40.8116, lng: -73.9465 },
  { name: "Upper West Side", borough: "Manhattan", lat: 40.787, lng: -73.9754 },
  { name: "Chelsea", borough: "Manhattan", lat: 40.7465, lng: -74.0014 },
  { name: "Flushing", borough: "Queens", lat: 40.7596, lng: -73.83 },
  { name: "Astoria", borough: "Queens", lat: 40.7644, lng: -73.9235 },
  { name: "Jackson Heights", borough: "Queens", lat: 40.7557, lng: -73.8831 },
  { name: "Long Island City", borough: "Queens", lat: 40.7447, lng: -73.9485 },
  { name: "Williamsburg", borough: "Brooklyn", lat: 40.7081, lng: -73.9571 },
  { name: "Greenpoint", borough: "Brooklyn", lat: 40.7304, lng: -73.9512 },
  { name: "Park Slope", borough: "Brooklyn", lat: 40.6721, lng: -73.9777 },
  { name: "Sunset Park", borough: "Brooklyn", lat: 40.6453, lng: -74.0125 },
  { name: "Bushwick", borough: "Brooklyn", lat: 40.6944, lng: -73.9213 },
];

const PREFIXES = [
  "Golden", "Lucky", "Empire", "Hudson", "Saint Marks", "Canal", "Bowery", "Liberty", "Atlas",
  "Nori", "Tsuru", "Banchan", "Maple", "Hudson Bell", "Kismet", "Joja", "Marlow", "Greywood",
  "Pelican", "Verde", "Casa", "El Rey", "La Reina", "Brooklyn", "Queensboro", "Astral", "Daughter",
  "Sunset", "Crown", "Ember", "Salt & Stone", "Coro", "Famiglia", "Nonna", "Two Bridges",
  "Hometown", "Foxface", "Wonton", "Jade", "Phoenix", "Dragon", "Hanok", "Lantern", "Mercado",
  "The Smith St", "Court St", "Greenline", "Northern", "Seoul", "Bangkok", "Saigon",
];
const STREETS = [
  "Mott St", "Mulberry St", "Bedford Ave", "Grand St", "Roosevelt Ave", "Broadway", "1st Ave",
  "Smith St", "5th Ave", "Steinway St", "Canal St", "Ludlow St", "Bleecker St", "32nd St",
  "Main St", "Manhattan Ave", "Atlantic Ave", "8th Ave", "Court St", "St Marks Pl",
];

let placeN = 0,
  conN = 0,
  cmpN = 0,
  voteN = 0,
  photoN = 0;

export function generateSeed(): StoreData {
  // reset counters + RNG for determinism if called twice in one process
  placeN = conN = cmpN = voteN = photoN = 0;
  const r = mulberry32(SEED);
  const R = {
    f: (lo: number, hi: number) => lo + r() * (hi - lo),
    i: (lo: number, hi: number) => Math.floor(lo + r() * (hi - lo + 1)),
    pick: <T>(a: T[]): T => a[Math.floor(r() * a.length)],
  };

  const region: Region = { id: "reg_nyc", slug: NYC.slug, name: NYC.name, center: { ...NYC.center } };

  const categories: Category[] = CATS.map((c, i) => ({
    id: `cat_${c.slug}`,
    slug: c.slug,
    name: c.name,
    kind: c.kind,
    emoji: c.emoji,
    sort: i,
  }));

  const subcategories: Subcategory[] = SUBS.map((s) => ({
    id: `sub_${s.slug}`,
    categoryId: `cat_${s.cat}`,
    slug: s.slug,
    name: s.name,
    emoji: s.emoji,
    blurb: s.blurb,
  }));

  // Users: curators (high trust) + regulars (low-mid trust)
  const users: User[] = [];
  const curatorNames = ["Mei Tanaka", "Andre Cole", "Priya Raman", "Sofia Reyes", "Danny Kwon", "Hana Park"];
  curatorNames.forEach((name, i) => {
    users.push({
      id: `user_cur_${i}`,
      handle: name.toLowerCase().replace(/[^a-z]+/g, ""),
      name,
      trustScore: +R.f(0.7, 0.95).toFixed(3),
      ratedCount: R.i(120, 400),
      isCurator: true,
      createdAt: GENERATED_AT,
    });
  });
  for (let i = 0; i < 14; i++) {
    users.push({
      id: `user_${i}`,
      handle: `taster${i}`,
      name: `Taster ${i + 1}`,
      trustScore: +R.f(0.15, 0.55).toFixed(3),
      ratedCount: R.i(5, 60),
      isCurator: false,
      createdAt: GENERATED_AT,
    });
  }
  const weightOf = (u: User) => trustToWeight(u.trustScore);

  const places: Place[] = [];
  const contenders: Contender[] = [];
  const comparisons: Comparison[] = [];
  const votes: Vote[] = [];
  const photos: Photo[] = [];
  const usedNames = new Set<string>();

  for (const sub of SUBS) {
    const subContenders: Contender[] = [];
    const quality = new Map<string, number>();

    // Shared: create a place + contender + placeholder photo and register its hidden quality.
    const addContender = (opts: {
      name: string;
      neighborhood: string;
      borough: string;
      address: string;
      lat: number;
      lng: number;
      title: string;
      description?: string;
      q: number;
      seedSources: string[];
    }) => {
      const lat = +opts.lat.toFixed(5);
      const lng = +opts.lng.toFixed(5);
      // Reuse a place when the same restaurant was already seeded under another food type — one
      // physical spot, many dishes. Normalized-name match + tight proximity (~250m) so different
      // locations of a chain (e.g. two Joe's Pizza) stay separate.
      const nn = normalizeName(opts.name);
      let place = places.find(
        (p) => normalizeName(p.name) === nn && Math.abs(p.lat - lat) <= 0.003 && Math.abs(p.lng - lng) <= 0.003,
      );
      if (!place) {
        place = {
          id: `place_${placeN++}`,
          name: opts.name,
          neighborhood: opts.neighborhood,
          borough: opts.borough,
          address: opts.address,
          lat,
          lng,
        };
        places.push(place);
      }
      const con: Contender = {
        id: `con_${conN++}`,
        placeId: place.id,
        subcategoryId: `sub_${sub.slug}`,
        regionId: region.id,
        title: opts.title,
        description: opts.description ?? "",
        dishVariantId: null,
        seedSources: opts.seedSources,
        seedScore: Math.round(clamp01(opts.q) * 1000) / 10, // 0–100 publication-class quality
        createdBy: null,
        createdAt: GENERATED_AT,
        theta: 0,
        rd: 350,
        weightedVotes: 0,
        comparisonCount: 0,
        distinctOpponents: 0,
        score: 0, // v2: starts at 0 / "new"; recompute sets the real blended score + standing
        sortKey: 0,
        status: "provisional",
        standing: "new",
        riserScore: 0,
      };
      contenders.push(con);
      subContenders.push(con);
      quality.set(con.id, opts.q);
      // No seeded photos — real photos are user-uploaded. Cards/rows show a clean placeholder.
    };

    const realList = REAL_DATA[sub.slug];
    if (realList && realList.length > 0) {
      // Real, consensus-ordered data from 2025+ best-of lists (see src/seed/real-*.ts).
      for (const shop of realList) {
        addContender({
          name: shop.name,
          neighborhood: shop.neighborhood,
          borough: shop.borough,
          address: shop.address,
          lat: shop.lat,
          lng: shop.lng,
          title: shop.title || shop.signatureBowl || sub.name,
          description: shop.description ?? "",
          q: shop.seedQuality,
          seedSources: shop.appearsOn,
        });
      }
    } else {
      const k = R.i(9, 14);
      for (let j = 0; j < k; j++) {
        let name = "";
        for (let tries = 0; tries < 60; tries++) {
          const cand = `${R.pick(PREFIXES)} ${sub.suffix}`;
          if (!usedNames.has(cand)) {
            name = cand;
            break;
          }
        }
        if (!name) name = `${R.pick(PREFIXES)} ${sub.suffix} ${j}`;
        usedNames.add(name);
        const nb = R.pick(NEIGHBORHOODS);
        addContender({
          name,
          neighborhood: nb.name,
          borough: nb.borough,
          address: `${R.i(1, 540)} ${R.pick(STREETS)}, ${nb.name}`,
          lat: nb.lat + R.f(-0.008, 0.008),
          lng: nb.lng + R.f(-0.008, 0.008),
          title: sub.dishes.length ? sub.dishes[j % sub.dishes.length] : sub.name,
          q: R.f(0.05, 0.97),
          seedSources: [],
        });
      }
    }

    // seed duels consistent with hidden quality
    const duelCount = subContenders.length * 7;
    for (let d = 0; d < duelCount; d++) {
      const a = R.pick(subContenders);
      let b = R.pick(subContenders);
      let guard = 0;
      while (b.id === a.id && guard++ < 10) b = R.pick(subContenders);
      if (b.id === a.id) continue;
      const qa = quality.get(a.id)!;
      const qb = quality.get(b.id)!;
      const aWins = r() < sigmoid((qa - qb) * 5);
      const winner = aWins ? a : b;
      const loser = aWins ? b : a;
      const rater = R.pick(users);
      comparisons.push({
        id: `cmp_${cmpN++}`,
        subcategoryId: `sub_${sub.slug}`,
        regionId: region.id,
        userId: rater.id,
        winnerId: winner.id,
        loserId: loser.id,
        source: "duel",
        weight: +weightOf(rater).toFixed(3),
        createdAt: SEED_EVIDENCE_AT,
      });
    }

    // a few standing 0–100 ratings per contender, centered on its hidden quality
    for (const con of subContenders) {
      const q = quality.get(con.id)!;
      const nRaters = Math.round(q * 4) + Math.round((1 - q) * 2);
      const raters = [...users].sort(() => r() - 0.5).slice(0, nRaters);
      raters.forEach((u) => {
        const rating = Math.max(0, Math.min(100, Math.round(q * 100 + (r() - 0.5) * 30)));
        votes.push({
          id: `vote_${voteN++}`,
          contenderId: con.id,
          userId: u.id,
          rating,
          weight: +weightOf(u).toFixed(3),
          createdAt: SEED_EVIDENCE_AT,
        });
      });
    }
  }

  const store: StoreData = {
    version: 1,
    generatedAt: GENERATED_AT,
    regions: [region],
    categories,
    subcategories,
    places,
    users,
    contenders,
    comparisons,
    votes,
    photos,
  };

  computeAllRankings(store);
  return store;
}

/** Recompute ranking state for every subcategory and write it onto the contenders in `store`. */
export function computeAllRankings(store: StoreData): void {
  for (const sub of store.subcategories) {
    recomputeSubcategory(store, sub.id);
  }
}

/** Recompute one subcategory's ranking state in place. Called after every duel/vote mutation. */
export function recomputeSubcategory(store: StoreData, subcategoryId: string): void {
  const sub = store.subcategories.find((s) => s.id === subcategoryId);
  const subSlug = sub?.slug ?? "";
  // Only rank live contenders; proposed (awaiting approval) / hidden ones stay out until approved.
  const rankable = store.contenders.filter(
    (c) => c.subcategoryId === subcategoryId && c.status !== "proposed" && c.status !== "hidden",
  );
  const idSet = new Set(rankable.map((c) => c.id));

  // Classify each rater into a source class (power = curator or category trust ≥ threshold).
  const userById = new Map(store.users.map((u) => [u.id, u]));
  const classOf = (userId: string): EvidenceClass => {
    const u = userById.get(userId);
    if (!u) return "user";
    if (u.isCurator) return "power";
    const t = u.categoryTrust?.[subSlug] ?? u.trustScore;
    return t >= SOURCE.POWER_USER_TRUST ? "power" : "user";
  };
  const at = (iso: string): number | undefined => {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : undefined;
  };

  const contenders = rankable.map((c) => ({
    id: c.id,
    seedScore: c.seedScore ?? 0,
    pubVolume: pubVolumeOf(c.seedSources),
  }));
  const duels = store.comparisons
    .filter((c) => c.subcategoryId === subcategoryId && c.source === "duel")
    .filter((c) => idSet.has(c.winnerId) && idSet.has(c.loserId))
    .map((c) => ({
      winnerId: c.winnerId,
      loserId: c.loserId,
      weight: c.weight,
      cls: classOf(c.userId),
      at: at(c.createdAt),
    }));
  const votes = store.votes
    .filter((v) => idSet.has(v.contenderId))
    .map((v) => ({
      contenderId: v.contenderId,
      rating: v.rating,
      weight: v.weight,
      cls: classOf(v.userId),
      at: at(v.createdAt),
    }));

  const now = typeof Date.now === "function" ? Date.now() : 0;
  const results = rankSubcategory(contenders, duels, votes, now);
  for (const con of rankable) {
    const r = results.get(con.id);
    if (!r) continue;
    con.theta = r.theta;
    con.rd = r.rd;
    con.weightedVotes = r.weightedVotes;
    con.comparisonCount = r.comparisonCount;
    con.distinctOpponents = r.distinctOpponents;
    con.score = r.score;
    con.sortKey = r.sortKey;
    con.status = r.status;
    con.standing = r.standing;
    con.riserScore = r.riserScore;
  }
}
