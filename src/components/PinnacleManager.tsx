"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Item {
  id: string;
  title: string;
  placeName: string;
  subName: string;
  emoji: string;
}

export default function PinnacleManager({ items }: { items: Item[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(id: string, action: "up" | "down" | "remove") {
    setBusy(true);
    try {
      await fetch("/api/pinnacle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contenderId: id, action }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!items.length) {
    return (
      <p className="text-sm text-[var(--color-ink-dim)]">
        Open any dish and tap <strong>☆ Add to favorites</strong> to build your all-time Pinnacle.
      </p>
    );
  }

  const iconBtn =
    "grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-border)] text-sm transition hover:border-[var(--color-ink-dim)] disabled:opacity-40";

  return (
    <ol className="space-y-2">
      {items.map((p, i) => (
        <li
          key={p.id}
          className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5"
        >
          <span className="w-5 text-center text-lg font-black tabular-nums text-[var(--color-brand)]">{i + 1}</span>
          <span className="text-lg">{p.emoji}</span>
          <Link href={`/c/${p.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
            <span className="font-semibold">{p.title}</span>{" "}
            <span className="text-[var(--color-ink-dim)]">· {p.placeName}</span>
          </Link>
          <button onClick={() => act(p.id, "up")} disabled={busy || i === 0} className={iconBtn} aria-label="Move up">
            ↑
          </button>
          <button
            onClick={() => act(p.id, "down")}
            disabled={busy || i === items.length - 1}
            className={iconBtn}
            aria-label="Move down"
          >
            ↓
          </button>
          <button onClick={() => act(p.id, "remove")} disabled={busy} className={iconBtn} aria-label="Remove">
            ✕
          </button>
        </li>
      ))}
    </ol>
  );
}
