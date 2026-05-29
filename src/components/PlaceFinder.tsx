"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Hit {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  borough: string;
  source: "corpus" | "place";
  dishCount: number;
}

export default function PlaceFinder() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setHits([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/places/all?q=${encodeURIComponent(term)}`);
        const d = await r.json();
        setHits(d.places ?? []);
        setSearched(true);
      } catch {
        /* ignore */
      }
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
        placeholder="Search any NYC restaurant by name or street…"
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-lg outline-none focus:border-[var(--color-brand)]"
      />

      <div className="mt-3 space-y-1.5">
        {hits.map((h) => (
          <button
            key={h.id}
            onClick={() => router.push(`/p/${encodeURIComponent(h.id)}`)}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition hover:border-[var(--color-brand)]"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{h.name}</span>
              <span className="block truncate text-sm text-[var(--color-ink-dim)]">
                {h.address || h.borough}
              </span>
            </span>
            <span className="shrink-0 text-xs font-medium text-[var(--color-ink-dim)]">
              {h.dishCount > 0 ? (
                <span className="text-[var(--color-brand)]">
                  {h.dishCount} dish{h.dishCount === 1 ? "" : "es"} →
                </span>
              ) : (
                "Add a dish →"
              )}
            </span>
          </button>
        ))}

        {searched && hits.length === 0 && (
          <p className="px-1 py-3 text-sm text-[var(--color-ink-dim)]">
            No match in our NYC list. Try the street name, or a different spelling.
          </p>
        )}
      </div>
    </div>
  );
}
