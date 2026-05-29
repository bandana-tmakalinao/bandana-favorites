import { getRepo } from "@/db/repo";
import CityMap, { type CityGroup } from "@/components/CityMap";

export const dynamic = "force-dynamic";
export const metadata = { title: "Map · Bandana Favorites" };

// The real, geocoded food types — each a colored layer on the citywide map.
const LAYERS = [
  { slug: "ramen", color: "#ed7f54" }, // coral
  { slug: "pizza", color: "#efb745" }, // gold
  { slug: "bagel", color: "#a65be0" }, // purple
  { slug: "ice-cream", color: "#5991d3" }, // blue
  { slug: "steak", color: "#e158a8" }, // pink
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
        points: list.ranked.slice(0, 10).map((v) => ({
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
