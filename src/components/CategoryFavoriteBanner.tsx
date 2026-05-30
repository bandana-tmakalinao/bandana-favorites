import Link from "next/link";
import { ScoreBadge } from "./bits";
import type { ContenderView } from "@/lib/types";

export default function CategoryFavoriteBanner({
  sub,
  subName,
  favorite,
}: {
  sub: string;
  subName: string;
  favorite: ContenderView;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--color-brand)]/20 bg-[var(--color-brand)]/8 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
          ⭐ Your favorite {subName.toLowerCase()}
        </p>
        <Link href={`/c/${favorite.id}`} className="block truncate font-bold hover:underline">
          {favorite.title}
        </Link>
        <p className="truncate text-sm text-[var(--color-ink-dim)]">
          {favorite.placeName} · {favorite.borough}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <ScoreBadge score={favorite.score} size="sm" />
        <Link
          href={`/duel?sub=${sub}&keep=${favorite.id}`}
          className="text-sm font-semibold text-[var(--color-brand)] hover:underline"
        >
          Change →
        </Link>
      </div>
    </div>
  );
}
