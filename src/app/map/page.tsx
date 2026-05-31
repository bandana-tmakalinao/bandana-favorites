import { getRepo } from "@/db/repo";
import CityMap, { type CityGroup } from "@/components/CityMap";

export const dynamic = "force-dynamic";
export const metadata = { title: "Map · Bandana Faves" };

// Every real, geocoded food type — each a colored, toggleable layer on the citywide map.
const LAYERS = [
  { slug: "pizza", color: "#ed7f54" },
  { slug: "bagel", color: "#efb745" },
  { slug: "black-and-white-cookie", color: "#4b4b4b" },
  { slug: "pastrami", color: "#c0392b" },
  { slug: "chopped-cheese", color: "#d98b2b" },
  { slug: "bacon-egg-cheese", color: "#8d6e63" },
  { slug: "ramen", color: "#e0683c" },
  { slug: "soup-dumplings", color: "#009275" },
  { slug: "dim-sum", color: "#26a69a" },
  { slug: "tacos", color: "#e158a8" },
  { slug: "korean-fried-chicken", color: "#ffa726" },
  { slug: "pho", color: "#5fae6e" },
  { slug: "dosa", color: "#b07e12" },
  { slug: "cheeseburger", color: "#7e57c2" },
  { slug: "steak", color: "#a65be0" },
  { slug: "lobster-roll", color: "#5991d3" },
  { slug: "halal-cart", color: "#ec407a" },
  { slug: "hot-dog", color: "#42a5f5" },
  { slug: "cheesecake", color: "#9ccc65" },
  { slug: "cannoli", color: "#c0567f" },
  { slug: "ice-cream", color: "#78909c" },
];

export default function MapPage() {
  const repo = getRepo();
  const groups: CityGroup[] = LAYERS.flatMap(({ slug, color }) => {
    const list = repo.getRankedList(slug);
    if (!list || list.ranked.length === 0) return [];
    return [
      {
        key: slug,
        label: list.subcategory.name,
        emoji: list.subcategory.emoji,
        color,
        points: list.ranked.slice(0, 6).map((v) => ({
          id: v.id,
          lat: v.lat,
          lng: v.lng,
          score: v.score,
          title: v.title,
          placeName: v.placeName,
        })),
      },
    ];
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-black tracking-tight">NYC&apos;s best, mapped</h1>
      <p className="mt-1 text-[var(--color-ink-dim)]">
        Top spots across food types on one map. Tap a color to toggle a food; tap a pin for the dish.
      </p>
      <div className="mt-6">
        <CityMap groups={groups} />
      </div>
    </div>
  );
}
