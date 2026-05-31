"use client";

import { useEffect, useRef, useState } from "react";

const ROTATE_MS = 6000;

/**
 * Rotates through pre-rendered cover cards (server-rendered RankingCard cover variants passed as
 * children). Only one is shown at a time; a thin progress bar + arrows + dots let you steer.
 * Keeping the cards server-rendered means no data/markup is duplicated on the client — this wrapper
 * just owns which index is visible, so the home hero gets the exact polished cover look, rotating.
 */
export default function RotatingCover({ children }: { children: React.ReactNode[] }) {
  const cards = (Array.isArray(children) ? children : [children]).filter(Boolean);
  const n = cards.length;
  const [i, setI] = useState(0);
  const paused = useRef(false);
  // Guard against the children array shrinking on a re-render (latent today — props are static).
  const active = Math.min(i, Math.max(0, n - 1));

  // Self-rescheduling timeout keyed on the active index: every advance (auto OR manual via the
  // arrows/dots) re-arms the timer, so the progress bar (which restarts on each index change) and
  // the actual advance stay phase-aligned — a manual tap always gets a full ROTATE_MS before the
  // next auto-advance.
  useEffect(() => {
    if (n <= 1) return;
    const t = setTimeout(() => {
      if (!paused.current) setI((cur) => (cur + 1) % n);
    }, ROTATE_MS);
    return () => clearTimeout(t);
  }, [active, n]);

  if (n === 0) return null;
  const go = (d: number) => setI((cur) => (cur + d + n) % n);

  return (
    <div
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      {/* progress bar — restarts each rotation via keyed remount */}
      <div className="mb-2 h-0.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div
          key={active}
          className="h-full bg-[var(--color-brand)]"
          style={{ animation: n > 1 ? `bf-progress ${ROTATE_MS}ms linear` : undefined }}
        />
      </div>

      {/* the active cover card */}
      <div className="bf-fade" key={active}>
        {cards[active]}
      </div>

      {/* steer: ‹ dots › */}
      {n > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            onClick={() => go(-1)}
            aria-label="Previous ranking"
            className="grid h-8 w-8 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-dim)] transition hover:text-[var(--color-ink)]"
          >
            ‹
          </button>
          <div className="flex items-center gap-1.5">
            {cards.map((_, d) => (
              <button
                key={d}
                onClick={() => setI(d)}
                aria-label={`Show ranking ${d + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  d === active ? "w-5 bg-[var(--color-brand)]" : "w-1.5 bg-[var(--color-border)]"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => go(1)}
            aria-label="Next ranking"
            className="grid h-8 w-8 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-dim)] transition hover:text-[var(--color-ink)]"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
