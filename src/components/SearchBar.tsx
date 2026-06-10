"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchResults } from "@/db/repo";
import { dishPath } from "@/lib/links";

export default function SearchBar({
  variant = "header",
  autoFocus = false,
}: {
  variant?: "header" | "hero";
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setRes(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        setRes(await r.json());
        setOpen(true);
      } catch {
        /* ignore */
      }
    }, 140);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const big = variant === "hero";
  const hasResults = !!res && (res.subcategories.length > 0 || res.contenders.length > 0);

  return (
    <div ref={boxRef} className={`relative ${big ? "w-full max-w-xl" : "w-full max-w-md"}`}>
      <form onSubmit={submit}>
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q && setOpen(true)}
          placeholder="Search a food or a place — ramen, Lucali, bagels…"
          className={`w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none transition focus:border-[var(--color-brand)] ${
            big ? "px-4 py-3 text-base" : "px-3 py-1.5 text-sm"
          }`}
        />
      </form>

      {open && res && q.trim() && (
        <div className="absolute z-50 mt-2 max-h-[70vh] w-full overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-2xl">
          {res.subcategories.length > 0 && (
            <div className="p-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-dim)]">
                Food types
              </div>
              {res.subcategories.map((s) => (
                <button
                  key={s.slug}
                  onClick={() => go(`/nyc/${s.slug}`)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--color-surface)]"
                >
                  <span className="text-lg">{s.emoji}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">Best {s.name} in NYC</span>
                    <span className="block text-xs text-[var(--color-ink-dim)]">
                      {s.categoryName} · {s.contenderCount} ranked
                    </span>
                  </span>
                  <span className="text-xs text-[var(--color-ink-dim)]">→</span>
                </button>
              ))}
            </div>
          )}

          {res.contenders.length > 0 && (
            <div className="border-t border-[var(--color-border)] p-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-dim)]">
                Dishes &amp; places
              </div>
              {res.contenders.map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(dishPath(c))}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--color-surface)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.title}</span>
                    <span className="block truncate text-xs text-[var(--color-ink-dim)]">
                      {c.placeName} · {c.neighborhood} · {c.subName}
                    </span>
                  </span>
                  <span className="text-xs font-bold tabular-nums text-[var(--color-ink-dim)]">
                    {Math.round(c.score)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!hasResults && (
            <div className="px-3 py-3 text-sm text-[var(--color-ink-dim)]">
              No matches. Press Enter to search &ldquo;{q.trim()}&rdquo;.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
