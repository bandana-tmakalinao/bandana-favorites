/**
 * Deterministic synthetic NYC dataset so every screen has content out of the box.
 *
 * IMPORTANT: place names here are FICTIONAL placeholders, not real NYC restaurants, and photos are
 * generic stock keyed by food type — none of this implies a real ranking. The real-data pipeline
 * (Overture + NYC OpenData, curator-seeded order, user photos) is specced in
 * docs/data-sourcing-research.md and replaces all of this. Generated with a seeded RNG so the
 * placeholder ranking is stable across runs.
 */
import { rankSubcategory, trustToWeight } from "../lib/ranking";
import { NYC } from "../lib/config";
import { REAL_RAMEN, type RealRamen } from "./real-ramen";
import { REAL_PIZZA } from "./real-pizza";

// Real, consensus-seeded datasets keyed by subcategory slug (the rest are fictional placeholders).
const REAL_DATA: Record<string, RealRamen[]> = { ramen: REAL_RAMEN, pizza: REAL_PIZZA };
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

const GENERATED_AT = "2026-05-29T00:00:00.000Z";

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
  { slug: "japanese", name: "Japanese", kind: "cuisine", emoji: "🍱" },
  { slug: "pizza", name: "Pizza", kind: "format", emoji: "🍕" },
  { slug: "chinese", name: "Chinese", kind: "cuisine", emoji: "🥟" },
  { slug: "mexican", name: "Mexican", kind: "cuisine", emoji: "🌮" },
  { slug: "deli", name: "Deli & Sandwiches", kind: "format", emoji: "🥪" },
  { slug: "bakery", name: "Bakery & Bagels", kind: "format", emoji: "🥯" },
  { slug: "burgers", name: "Burgers", kind: "format", emoji: "🍔" },
  { slug: "korean", name: "Korean", kind: "cuisine", emoji: "🍚" },
  { slug: "thai", name: "Thai", kind: "cuisine", emoji: "🍤" },
  { slug: "vietnamese", name: "Vietnamese", kind: "cuisine", emoji: "🍲" },
  { slug: "indian", name: "Indian", kind: "cuisine", emoji: "🍛" },
  { slug: "dessert", name: "Dessert", kind: "dessert", emoji: "🍦" },
  { slug: "coffee", name: "Coffee", kind: "drink", emoji: "☕" },
];

const SUBS: SubDef[] = [
  { slug: "ramen", cat: "japanese", name: "Ramen", emoji: "🍜", blurb: "Tonkotsu to shoyu — the city's best bowls.", suffix: "Ramen-ya", img: "ramen", dishes: ["Tonkotsu", "Spicy Miso", "Shoyu", "Black Garlic Tonkotsu", "Tsukemen", "Vegan Shio", "Tantanmen"] },
  { slug: "sushi", cat: "japanese", name: "Sushi", emoji: "🍣", blurb: "Omakase counters to neighborhood gems.", suffix: "Sushi", img: "sushi", dishes: ["Omakase", "Chirashi Bowl", "Toro Flight", "Box Set", "Spicy Tuna Roll"] },
  { slug: "udon", cat: "japanese", name: "Udon", emoji: "🍲", blurb: "Chewy, hand-pulled, slurpable.", suffix: "Udon", img: "udon", dishes: ["Curry Udon", "Niku Udon", "Kake Udon", "Tempura Udon"] },
  { slug: "pizza", cat: "pizza", name: "Pizza", emoji: "🍕", blurb: "Slices to whole pies — the city's best.", suffix: "Pizza", img: "pizza", dishes: ["Plain Slice", "Margherita Pie", "Pepperoni Slice", "Grandma Square", "Vodka Slice"] },
  { slug: "soup-dumplings", cat: "chinese", name: "Soup Dumplings", emoji: "🥟", blurb: "XLB with the perfect skin-to-soup ratio.", suffix: "Dumpling House", img: "soup+dumpling", dishes: ["Pork XLB", "Crab & Pork XLB", "Truffle XLB", "Chicken XLB"] },
  { slug: "dim-sum", cat: "chinese", name: "Dim Sum", emoji: "🍤", blurb: "Carts, baskets, and har gow.", suffix: "Palace", img: "dim+sum", dishes: ["Har Gow", "Shu Mai", "BBQ Pork Bun", "Turnip Cake", "Rice Noodle Roll"] },
  { slug: "tacos", cat: "mexican", name: "Tacos", emoji: "🌮", blurb: "Al pastor to carnitas, the whole spread.", suffix: "Taqueria", img: "tacos", dishes: ["Al Pastor", "Carnitas", "Suadero", "Lengua", "Pollo Asado"] },
  { slug: "birria", cat: "mexican", name: "Birria", emoji: "🍲", blurb: "Consommé-dunked, cheese-pulled glory.", suffix: "Birrieria", img: "birria+taco", dishes: ["Birria Tacos", "Quesabirria", "Birria Ramen", "Mulitas"] },
  { slug: "pastrami", cat: "deli", name: "Pastrami on Rye", emoji: "🥪", blurb: "The towering NYC classic.", suffix: "Delicatessen", img: "pastrami+sandwich", dishes: ["Pastrami on Rye", "Pastrami Reuben", "Hot Pastrami Club"] },
  { slug: "bodega-sandwich", cat: "deli", name: "Bodega Sandwich", emoji: "🥖", blurb: "The chopped cheese & BEC canon.", suffix: "Deli & Grocery", img: "deli+sandwich", dishes: ["Chopped Cheese", "Bacon Egg & Cheese", "Turkey Hero", "Italian Combo"] },
  { slug: "bagel", cat: "bakery", name: "Bagel & Schmear", emoji: "🥯", blurb: "Hand-rolled, boiled, blistered.", suffix: "Bagels", img: "bagel", dishes: ["Everything w/ Scallion", "Lox & Cream Cheese", "BEC on a Bagel", "Sesame w/ Plain"] },
  { slug: "cookies", cat: "bakery", name: "Cookies", emoji: "🍪", blurb: "Gooey, thick, NYC-style.", suffix: "Bakeshop", img: "cookie", dishes: ["Chocolate Chunk", "Brown Butter Toffee", "Tahini Cookie", "Levain-Style"] },
  { slug: "cheeseburger", cat: "burgers", name: "Cheeseburger", emoji: "🍔", blurb: "Smash to pub, the best patties.", suffix: "Burger Joint", img: "cheeseburger", dishes: ["Double Smash", "Bacon Cheeseburger", "Classic Single", "Pub Burger"] },
  { slug: "korean-bbq", cat: "korean", name: "Korean BBQ", emoji: "🥩", blurb: "Tabletop grills in K-town and beyond.", suffix: "BBQ House", img: "korean+bbq", dishes: ["Galbi Set", "Samgyeopsal", "Bulgogi Combo", "Premium Set"] },
  { slug: "bibimbap", cat: "korean", name: "Bibimbap", emoji: "🍚", blurb: "Sizzling stone-bowl perfection.", suffix: "Korean Kitchen", img: "bibimbap", dishes: ["Dolsot Bibimbap", "Beef Bibimbap", "Veggie Bibimbap"] },
  { slug: "pad-thai", cat: "thai", name: "Pad Thai", emoji: "🍜", blurb: "Sweet-sour-savory wok hei.", suffix: "Thai Kitchen", img: "pad+thai", dishes: ["Shrimp Pad Thai", "Chicken Pad Thai", "Tofu Pad Thai"] },
  { slug: "pho", cat: "vietnamese", name: "Pho", emoji: "🍲", blurb: "Long-simmered broth, the real test.", suffix: "Pho House", img: "pho", dishes: ["Pho Tai", "Pho Dac Biet", "Oxtail Pho", "Chicken Pho"] },
  { slug: "banh-mi", cat: "vietnamese", name: "Bánh Mì", emoji: "🥖", blurb: "Crackly baguette, the perfect bite.", suffix: "Bánh Mì", img: "banh+mi", dishes: ["Grilled Pork Bánh Mì", "Classic Combo", "Lemongrass Chicken", "Tofu Bánh Mì"] },
  { slug: "biryani", cat: "indian", name: "Biryani", emoji: "🍛", blurb: "Layered, fragrant, debated.", suffix: "Biryani House", img: "biryani", dishes: ["Chicken Biryani", "Goat Biryani", "Veg Biryani", "Hyderabadi Dum"] },
  { slug: "ice-cream", cat: "dessert", name: "Ice Cream", emoji: "🍦", blurb: "Scoops, soft-serve, gelato.", suffix: "Creamery", img: "ice+cream", dishes: ["Soft Serve Twist", "Pistachio Scoop", "Black Sesame", "Brown Sugar Boba"] },
  { slug: "espresso", cat: "coffee", name: "Espresso", emoji: "☕", blurb: "The shot that anchors the city.", suffix: "Coffee", img: "espresso", dishes: ["Cortado", "Double Espresso", "Flat White", "Cappuccino"] },
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
      q: number;
      seedSources: string[];
    }) => {
      const place: Place = {
        id: `place_${placeN++}`,
        name: opts.name,
        neighborhood: opts.neighborhood,
        borough: opts.borough,
        address: opts.address,
        lat: +opts.lat.toFixed(5),
        lng: +opts.lng.toFixed(5),
      };
      places.push(place);
      const con: Contender = {
        id: `con_${conN++}`,
        placeId: place.id,
        subcategoryId: `sub_${sub.slug}`,
        regionId: region.id,
        title: opts.title,
        dishVariantId: null,
        seedSources: opts.seedSources,
        createdBy: null,
        createdAt: GENERATED_AT,
        theta: 0,
        rd: 350,
        weightedVotes: 0,
        comparisonCount: 0,
        distinctOpponents: 0,
        score: 50,
        sortKey: 0,
        status: "provisional",
      };
      contenders.push(con);
      subContenders.push(con);
      quality.set(con.id, opts.q);
      // placeholder photo (generic stock keyed by food type; clearly not the actual dish)
      photos.push({
        id: `photo_${photoN++}`,
        contenderId: con.id,
        uploaderId: R.pick(users).id,
        url: `https://loremflickr.com/800/600/${sub.img}?lock=${photoN}`,
        status: "verified",
        vouchCount: R.i(0, 6),
        placeholder: true,
        createdAt: GENERATED_AT,
      });
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
          title: shop.signatureBowl || "Ramen",
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
        createdAt: GENERATED_AT,
      });
    }

    // a few standing up/down votes per contender, biased by quality
    for (const con of subContenders) {
      const q = quality.get(con.id)!;
      const ups = Math.round(q * 4);
      const downs = Math.round((1 - q) * 2);
      const voters = [...users].sort(() => r() - 0.5).slice(0, ups + downs);
      voters.forEach((u, idx) => {
        votes.push({
          id: `vote_${voteN++}`,
          contenderId: con.id,
          userId: u.id,
          value: idx < ups ? 1 : -1,
          weight: +weightOf(u).toFixed(3),
          createdAt: GENERATED_AT,
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
  const cons = store.contenders.filter((c) => c.subcategoryId === subcategoryId);
  const ids = cons.map((c) => c.id);
  const idSet = new Set(ids);
  const duels = store.comparisons
    .filter((c) => c.subcategoryId === subcategoryId && c.source === "duel")
    .map((c) => ({ winnerId: c.winnerId, loserId: c.loserId, weight: c.weight }));
  const votes = store.votes
    .filter((v) => idSet.has(v.contenderId))
    .map((v) => ({ contenderId: v.contenderId, value: v.value, weight: v.weight }));
  const results = rankSubcategory(ids, duels, votes);
  for (const con of cons) {
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
  }
}
