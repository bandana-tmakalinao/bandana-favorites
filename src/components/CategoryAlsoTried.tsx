"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScoreBadge, btn } from "./bits";
import type { ContenderView } from "@/lib/types";

/**
 * Shown on the category page right AFTER a user sets their favorite (welcome flag).
 * Optional by design — a "Skip for now" escape sits up top so we never trap a user in a
 * full checklist. Picking a few sends them into an adaptive duel to rank them vs. the favorite.
 */
export default function CategoryAlsoTried({
  sub,
  subName,
  favoriteId,
  others,
}: {
  sub: string;
  subName: string;
  favoriteId: string;
  others: ContenderView[];
}) {
  const router = useRouter();
  const [tried, setTried] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setTried((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function skip() {
    // Drop the welcome flag and stay on the category page.
    router.push(`/nyc/${sub}`);
  }

  function rankThem() {
    const ids = [...tried].filter((id) => id !== favoriteId);
    if (ids.length === 0) {
      skip();
      return;
    }
    // Place these tried picks into the user's ladder (anchored on their declared #1 server-side).
    const qs = new URLSearchParams({ sub, target: ids.join(",") });
    router.push(`/duel?${qs.toString()}`);
  }

  if (others.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div className="min-w-0">
          <p className="font-bold">Tried any other {subName.toLowerCase()}?</p>
          <p className="text-sm text-[var(--color-ink-dim)]">
            Pick the ones you&apos;ve had and we&apos;ll rank them against your favorite.
          </p>
        </div>
        <button
          onClick={skip}
          className="shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--color-ink-dim)] transition hover:text-[var(--color-ink)]"
        >
          Skip for now
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {others.map((v) => {
          const checked = tried.has(v.id);
          return (
            <button
              key={v.id}
              onClick={() => toggle(v.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--color-bg)] ${checked ? "bg-[var(--color-brand)]/5" : ""}`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${checked ? "border-[var(--color-brand)] bg-[var(--color-brand)]" : "border-[var(--color-border)]"}`}
                aria-hidden
              >
                {checked && (
                  <svg viewBox="0 0 12 10" fill="none" className="h-3 w-3">
                    <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{v.title}</div>
                <div className="truncate text-sm text-[var(--color-ink-dim)]">
                  {v.placeName} · {v.neighborhood}
                </div>
              </div>
              <ScoreBadge score={v.score} size="sm" standing={v.standing} />
            </button>
          );
        })}
      </div>

      <div className="border-t border-[var(--color-border)] px-4 py-3">
        <button onClick={rankThem} disabled={tried.size === 0} className={`${btn("primary")} w-full`}>
          {tried.size === 0 ? "Pick a few to rank →" : `Rank my ${tried.size} pick${tried.size === 1 ? "" : "s"} →`}
        </button>
      </div>
    </div>
  );
}
