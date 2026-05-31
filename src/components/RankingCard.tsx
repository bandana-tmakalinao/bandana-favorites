import Link from "next/link";
import { ConfidenceDot, RankBadge, ScoreBadge } from "@/components/bits";
import type { ContenderView } from "@/lib/types";
import type { ShowcaseEntry } from "@/db/repo";

function placeLine(v: ContenderView) {
  const loc = v.neighborhood || v.borough;
  return loc ? `${v.placeName} · ${loc}` : v.placeName;
}

/**
 * One self-contained Top-N ranking, photo-less. Two variants:
 *  - "feed": compact card for the grid (top 6 + "see all").
 *  - "cover": the hero treatment (pizza/burger) — taller band, #1 promoted, all rows.
 * The dish is the headline; the place is the subtitle; the 0–100 ScoreBadge is the right rail.
 * Overflow defense is the truncation contract: min-w-0 + truncate on the text stack, shrink-0
 * on the medal and the badge — long dish names can never push the layout sideways.
 */
export default function RankingCard({
  entry,
  tint,
  rows = 6,
  variant = "feed",
  hook,
  kicker,
}: {
  entry: ShowcaseEntry;
  tint: string;
  rows?: number;
  variant?: "feed" | "cover";
  hook?: string;
  kicker?: string;
}) {
  const cover = variant === "cover";
  const shown = entry.items.slice(0, rows);
  const total = entry.items.length;
  // Count-honest label: never claim "Top 10" above fewer rows. Callers (e.g. /explore featured)
  // can override with an explicit kicker.
  const label = kicker ?? `Top ${Math.min(rows, total)} in NYC`;

  return (
    <div
      className={`flex flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] transition duration-200 ${
        cover
          ? "rounded-3xl ring-1 ring-black/5 shadow-[0_8px_34px_-14px_rgba(35,28,22,0.45)]"
          : "rounded-2xl shadow-[0_2px_12px_-8px_rgba(35,28,22,0.25)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-12px_rgba(35,28,22,0.35)]"
      }`}
    >
      {/* Header band — links to the full ranking */}
      <Link
        href={`/nyc/${entry.slug}`}
        className={`group block bg-gradient-to-br ${tint} ${cover ? "px-5 py-6 sm:px-7 sm:py-7" : "px-4 py-3"}`}
      >
        <div className={`flex items-center gap-3 ${cover ? "sm:gap-4" : ""}`}>
          <span className={cover ? "text-5xl drop-shadow-sm sm:text-6xl" : "text-2xl drop-shadow-sm"}>
            {entry.emoji}
          </span>
          <div className="min-w-0">
            <div
              className={`font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-dim)] ${
                cover ? "text-[11px]" : "text-[10px]"
              }`}
            >
              {label}
            </div>
            <h3
              className={`truncate font-black tracking-tight group-hover:text-[var(--color-brand-soft)] ${
                cover ? "text-3xl sm:text-4xl" : "text-lg"
              }`}
            >
              {entry.name}
            </h3>
          </div>
        </div>
        {cover && hook && <p className="mt-3 text-sm font-medium text-[var(--color-ink-dim)]">{hook}</p>}
      </Link>

      {/* Ranked rows — each links to the dish */}
      <ol className="divide-y divide-[var(--color-border)]">
        {shown.map((v, i) => {
          const champ = cover && i === 0;
          return (
            <li key={v.id} className={champ ? "bg-[var(--color-surface-2)]" : ""}>
              <Link
                href={`/c/${v.id}`}
                className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-[var(--color-surface-2)]"
              >
                <RankBadge rank={v.rank} />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate tracking-tight ${champ ? "text-base font-black" : "font-semibold"}`}
                  >
                    {v.title}
                  </span>
                  <span className="block truncate text-xs text-[var(--color-ink-dim)]">{placeLine(v)}</span>
                  {champ && (
                    <span className="mt-1 flex items-center gap-2 text-xs text-[var(--color-ink-dim)]">
                      <ConfidenceDot tier={v.tier} withLabel />
                      {v.comparisonCount > 0 && <span>· {v.comparisonCount} duels</span>}
                    </span>
                  )}
                </span>
                <ScoreBadge score={v.score} size={champ ? "md" : "sm"} />
              </Link>
            </li>
          );
        })}
      </ol>

      {/* Footer — full ranking */}
      <Link
        href={`/nyc/${entry.slug}`}
        className="mt-auto block border-t border-[var(--color-border)] px-4 py-3 text-center text-sm font-semibold text-[var(--color-brand)] hover:bg-[var(--color-surface-2)]"
      >
        {total > shown.length ? `See all ${total} →` : "See full ranking →"}
      </Link>
    </div>
  );
}
