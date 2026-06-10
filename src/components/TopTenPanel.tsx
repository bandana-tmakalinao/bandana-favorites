import Link from "next/link";
import { ScoreBadge } from "./bits";
import type { ShowcaseEntry } from "@/db/repo";
import { dishPath } from "@/lib/links";

/** A static "Top 10 in NYC" panel for a single food type (used for the marquee lists). */
export default function TopTenPanel({ entry }: { entry: ShowcaseEntry }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <Link href={`/nyc/${entry.slug}`} className="group block px-4 pt-3">
        <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-dim)]">
          Top 10 in NYC
        </div>
        <div className="flex items-center gap-2 text-lg font-black">
          <span>{entry.emoji}</span>
          <span className="group-hover:text-[var(--color-brand)]">{entry.name}</span>
        </div>
      </Link>

      <ol className="mt-2 divide-y divide-[var(--color-border)]">
        {entry.items.map((v) => (
          <li key={v.id}>
            <Link
              href={dishPath(v)}
              className="flex items-center gap-3 px-4 py-2 transition hover:bg-[var(--color-surface-2)]"
            >
              <span className="w-5 shrink-0 text-center text-sm font-black tabular-nums text-[var(--color-ink-dim)]">
                {v.rank}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{v.title}</span>
                <span className="block truncate text-xs text-[var(--color-ink-dim)]">
                  {v.placeName} · {v.neighborhood}
                </span>
              </span>
              <ScoreBadge score={v.score} size="sm" standing={v.standing} />
            </Link>
          </li>
        ))}
      </ol>

      <Link
        href={`/nyc/${entry.slug}`}
        className="block border-t border-[var(--color-border)] px-4 py-2.5 text-center text-sm font-medium text-[var(--color-brand)] hover:bg-[var(--color-surface-2)]"
      >
        See the full {entry.name} ranking →
      </Link>
    </div>
  );
}
