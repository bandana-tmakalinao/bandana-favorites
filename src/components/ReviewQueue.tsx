"use client";

import { useEffect, useState } from "react";

interface ProposedItem {
  contenderId: string;
  title: string;
  placeName: string;
  address: string;
  borough: string;
  subSlug: string;
  subName: string;
}

export default function ReviewQueue() {
  const [items, setItems] = useState<ProposedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/review");
      const d = await r.json();
      setItems(d.proposed ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function act(id: string, approve: boolean) {
    setBusy(id);
    try {
      await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contenderId: id, approve }),
      });
      setItems((xs) => xs.filter((i) => i.contenderId !== id));
    } finally {
      setBusy(null);
    }
  }

  if (!loaded) return <p className="text-sm text-[var(--color-ink-dim)]">Loading…</p>;
  if (!items.length)
    return <p className="text-[var(--color-ink-dim)]">Nothing pending review. 🎉</p>;

  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div
          key={i.contenderId}
          className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">
              {i.placeName} <span className="font-normal text-[var(--color-ink-dim)]">· {i.subName}</span>
            </span>
            <span className="block truncate text-xs text-[var(--color-ink-dim)]">
              {i.address} · {i.borough}
            </span>
          </span>
          <button
            onClick={() => act(i.contenderId, true)}
            disabled={busy === i.contenderId}
            className="rounded-lg bg-[var(--color-good)] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => act(i.contenderId, false)}
            disabled={busy === i.contenderId}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm transition hover:border-[var(--color-brand)] disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ))}
    </div>
  );
}
