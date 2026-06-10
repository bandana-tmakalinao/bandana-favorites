import Link from "next/link";
import { ConfidenceDot, RankBadge, ScoreBadge } from "@/components/bits";
import { categoryGradient } from "@/lib/categoryTheme";
import type { ContenderView } from "@/lib/types";
import type { ShowcaseEntry } from "@/db/repo";
import { dishPath } from "@/lib/links";

function placeLine(v: ContenderView) {
  const loc = v.neighborhood || v.borough;
  return loc ? `${v.placeName} · ${loc}` : v.placeName;
}

/**
 * One self-contained Top-N ranking, photo-less. Two variants:
 *  - "feed": compact card for the grid (top 6 + "see all").
 *  - "cover": the hero treatment (pizza/burger) — taller band, #1 promoted, all rows.
 * The header band wears the category's share-poster gradient (categoryTheme), so the card reads
 * as a mini version of the Instagram poster — one visual identity from app to share.
 * The dish is the headline; the place is the subtitle; the 0–100 ScoreBadge is the right rail.
 * Overflow defense is the truncation contract: min-w-0 + truncate on the text stack, shrink-0
 * on the medal and the badge — long dish names can never push the layout sideways.
 */
export default function RankingCard({
  entry,
  rows = 6,
  variant = "feed",
  hook,
  kicker,
}: {
  entry: ShowcaseEntry;
  rows?: number;
  variant?: "feed" | "cover";
  hook?: string;
  kicker?: string;
}) {
  const cover = variant === "cover";
  const shown = entry.items.slice(0, rows);
  const total = entry.items.length;
  // Label reflects the LIST's headline size (capped at 10), not how many rows this card previews —
  // so a 5-row home preview of a 10-deep list still reads "Top 10 in NYC" (and the footer's
  // "See all 10 →" agrees), while a thin list with only 7 ranked dishes honestly reads "Top 7".
  // Callers (e.g. /explore featured) can override with an explicit kicker.
  const label = kicker ?? `Top ${Math.min(10, total)} in NYC`;

  return (
    <div
      className={`flex flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] transition duration-200 ${
        cover
          ? "rounded-3xl ring-1 ring-black/5 shadow-[0_8px_34px_-14px_rgba(35,28,22,0.45)]"
          : "rounded-2xl shadow-[0_2px_12px_-8px_rgba(35,28,22,0.25)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-12px_rgba(35,28,22,0.35)]"
      }`}
    >
      {/* Header band — the category's poster gradient; links to the full ranking */}
      <Link
        href={`/nyc/${entry.slug}`}
        className={`group relative block overflow-hidden ${cover ? "px-5 py-6 sm:px-7 sm:py-7" : "px-4 py-3"}`}
        style={{ backgroundImage: categoryGradient(entry.slug) }}
      >
        {/* oversized emoji watermark, poster-style */}
        <span
          aria-hidden
          className={`pointer-events-none absolute -right-3 select-none opacity-25 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${
            cover ? "-bottom-6 text-[7rem]" : "-bottom-3 text-[4rem]"
          }`}
        >
          {entry.emoji}
        </span>
        <div className={`relative flex items-center gap-3 ${cover ? "sm:gap-4" : ""}`}>
          <span className={cover ? "text-5xl drop-shadow-sm sm:text-6xl" : "text-2xl drop-shadow-sm"}>
            {entry.emoji}
          </span>
          <div className="min-w-0">
            <div
              className={`font-bold uppercase tracking-[0.14em] text-white/80 ${
                cover ? "text-[11px]" : "text-[10px]"
              }`}
            >
              {label}
            </div>
            <h3 className={`truncate font-display text-white drop-shadow-sm ${cover ? "text-3xl sm:text-4xl" : "text-lg"}`}>
              {entry.name}
            </h3>
          </div>
        </div>
        {cover && hook && <p className="relative mt-3 text-sm font-medium text-white/85">{hook}</p>}
      </Link>

      {/* Ranked rows — each links to the dish */}
      <ol className="divide-y divide-[var(--color-border)]">
        {shown.map((v, i) => {
          const champ = cover && i === 0;
          return (
            <li key={v.id} className={champ ? "bg-[var(--color-surface-2)]" : ""}>
              <Link
                href={dishPath(v)}
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
                <ScoreBadge score={v.score} size={champ ? "md" : "sm"} standing={v.standing} />
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
