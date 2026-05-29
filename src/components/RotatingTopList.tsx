"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ScoreBadge } from "./bits";
import type { ShowcaseEntry } from "@/db/repo";

const ROTATE_MS = 6000;

export default function RotatingTopList({ entries }: { entries: ShowcaseEntry[] }) {
  const [i, setI] = useState(0);
  const paused = useRef(false);
  const n = entries.length;

  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => {
      if (!paused.current) setI((cur) => (cur + 1) % n);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [n]);

  if (n === 0) return null;
  const entry = entries[i];
  const go = (d: number) => setI((cur) => (cur + d + n) % n);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      {/* progress bar — restarts each rotation via keyed remount */}
      <div className="h-0.5 w-full bg-[var(--color-surface-2)]">
        <div
          key={i}
          className="h-full bg-[var(--color-brand)]"
          style={{ animation: `bf-progress ${ROTATE_MS}ms linear` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <Link href={`/nyc/${entry.slug}`} className="group min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-dim)]">
            Top 10 in NYC
          </div>
          <div className="flex items-center gap-2 truncate text-lg font-black">
            <span>{entry.emoji}</span>
            <span className="truncate group-hover:text-[var(--color-brand)]">{entry.name}</span>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-1 text-[var(--color-ink-dim)]">
          <button onClick={() => go(-1)} aria-label="Previous" className="rounded px-1.5 py-0.5 hover:text-[var(--color-ink)]">
            ‹
          </button>
          <span className="tabular-nums text-xs">
            {i + 1}/{n}
          </span>
          <button onClick={() => go(1)} aria-label="Next" className="rounded px-1.5 py-0.5 hover:text-[var(--color-ink)]">
            ›
          </button>
        </div>
      </div>

      <ol key={entry.slug} className="bf-fade mt-2 divide-y divide-[var(--color-border)]">
        {entry.items.map((v) => (
          <li key={v.id}>
            <Link
              href={`/c/${v.id}`}
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
              <ScoreBadge score={v.score} size="sm" />
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
