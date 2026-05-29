"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ConfidenceDot, PhotoThumb, ScoreBadge } from "./bits";
import type { ContenderView } from "@/lib/types";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[62vh] place-items-center rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-ink-dim)]">
      Loading map…
    </div>
  ),
});

function Row({ v }: { v: ContenderView }) {
  return (
    <Link
      href={`/c/${v.id}`}
      className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition hover:border-[var(--color-ink-dim)]"
    >
      <span className="w-6 shrink-0 text-center text-lg font-black tabular-nums text-[var(--color-ink-dim)]">
        {v.rank ?? "–"}
      </span>
      <PhotoThumb url={v.photoUrl} alt={v.title} className="h-16 w-16 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{v.title}</span>
        <span className="block truncate text-sm text-[var(--color-ink-dim)]">
          {v.placeName} · {v.neighborhood}
        </span>
        <span className="mt-1 flex items-center gap-2 text-xs text-[var(--color-ink-dim)]">
          <ConfidenceDot tier={v.tier} withLabel />
          <span>· {v.comparisonCount} duels</span>
        </span>
      </span>
      <ScoreBadge score={v.score} />
    </Link>
  );
}

export default function BrowseView({
  ranked,
  provisional,
  center,
}: {
  ranked: ContenderView[];
  provisional: ContenderView[];
  center: { lat: number; lng: number };
}) {
  const [view, setView] = useState<"list" | "map">("list");
  const points = ranked.map((v) => ({
    id: v.id,
    lat: v.lat,
    lng: v.lng,
    rank: v.rank,
    score: v.score,
    title: v.title,
    placeName: v.placeName,
  }));

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-sm">
        {(["list", "map"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-md px-4 py-1.5 font-medium capitalize transition ${
              view === v ? "bg-[var(--color-brand)] text-white" : "text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "list" ? (
        <div className="space-y-2">
          {ranked.map((v) => (
            <Row key={v.id} v={v} />
          ))}
          {provisional.length > 0 && (
            <div className="pt-6">
              <h2 className="mb-1 text-sm font-semibold text-[var(--color-ink-dim)]">
                Contenders — earning their rank
              </h2>
              <p className="mb-3 text-xs text-[var(--color-ink-dim)]">
                Not enough trusted votes yet to place on the board. Duel them to help.
              </p>
              <div className="space-y-2 opacity-80">
                {provisional.map((v) => (
                  <Row key={v.id} v={v} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <MapView points={points} center={center} />
      )}
    </div>
  );
}
