"use client";

import { useState } from "react";
import Link from "next/link";
import { PhotoThumb, ScoreBadge } from "./bits";
import type { ContenderView } from "@/lib/types";

interface Pair {
  category: { emoji: string; name: string };
  subcategory: { slug: string; name: string };
  a: ContenderView;
  b: ContenderView;
}

export default function DuelBoard({
  initialPair,
  sub,
  signedIn,
  initialKeepId,
}: {
  initialPair: Pair | null;
  sub?: string;
  signedIn: boolean;
  initialKeepId?: string;
}) {
  const [pair, setPair] = useState<Pair | null>(initialPair);
  const [kingId, setKingId] = useState<string | null>(initialKeepId ?? null);
  const [streak, setStreak] = useState(0);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subSlug = () => pair?.subcategory.slug ?? sub;

  async function load(keep?: string) {
    const qs = new URLSearchParams();
    if (subSlug()) qs.set("sub", subSlug()!);
    if (keep) qs.set("keep", keep);
    const res = await fetch(`/api/duel?${qs.toString()}`);
    const data = await res.json();
    setPair(data.pair ?? null);
  }

  // Swap only the challenger, keeping the side you know (your "only one side changes").
  async function swapChallenger() {
    setError(null);
    if (kingId) await load(kingId);
    else await load();
  }

  // Fresh matchup, both sides new.
  async function newMatchup() {
    setError(null);
    setKingId(null);
    setStreak(0);
    await load();
  }

  async function choose(winner: ContenderView, loser: ContenderView) {
    if (!signedIn) {
      setError("Sign in to settle duels.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/duel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ winnerId: winner.id, loserId: loser.id, sub: subSlug() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setStreak((s) => (winner.id === kingId ? s + 1 : 1));
      setKingId(winner.id);
      setCount((c) => c + 1);
      setPair(data.next ?? null);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (!pair) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <p className="text-[var(--color-ink-dim)]">No duel available here yet.</p>
        <Link href="/nyc" className="mt-3 inline-block font-semibold text-[var(--color-brand)] hover:underline">
          Browse categories →
        </Link>
      </div>
    );
  }

  const isKing = (c: ContenderView) => c.id === kingId && streak >= 1;

  const Card = ({ c, other }: { c: ContenderView; other: ContenderView }) => (
    <button
      onClick={() => choose(c, other)}
      disabled={busy}
      className="group relative flex-1 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-left transition hover:border-[var(--color-brand)] hover:shadow-[0_0_0_3px_var(--color-brand)] disabled:opacity-60"
    >
      {isKing(c) && (
        <span className="absolute left-2 top-2 z-10 rounded-full bg-[var(--color-ink)] px-2 py-0.5 text-xs font-semibold text-white">
          👑 {streak} in a row
        </span>
      )}
      <PhotoThumb url={c.photoUrl} alt={c.title} className="h-40 w-full sm:h-52" />
      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{c.title}</div>
          <div className="truncate text-sm text-[var(--color-ink-dim)]">
            {c.placeName} · {c.neighborhood}
          </div>
        </div>
        <ScoreBadge score={c.score} size="sm" />
      </div>
    </button>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-black sm:text-2xl">
          Which {pair.subcategory.name.toLowerCase()} is better?
        </h1>
        <Link
          href={`/nyc/${pair.subcategory.slug}`}
          className="text-sm text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
        >
          See the ranking →
        </Link>
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <Card c={pair.a} other={pair.b} />
        <div className="grid shrink-0 place-items-center py-1 text-sm font-black text-[var(--color-ink-dim)] sm:py-0">
          VS
        </div>
        <Card c={pair.b} other={pair.a} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-ink-dim)]">
        <div className="flex flex-wrap gap-4">
          <button onClick={swapChallenger} disabled={busy} className="hover:text-[var(--color-ink)] disabled:opacity-50">
            Haven&apos;t tried one → new challenger
          </button>
          <button onClick={newMatchup} disabled={busy} className="hover:text-[var(--color-ink)] disabled:opacity-50">
            ⤨ New matchup
          </button>
        </div>
        <span>
          {count > 0 ? `${count} duel${count === 1 ? "" : "s"} this session` : "Pick the better one — winner stays"}
        </span>
      </div>

      {error && (
        <p className="mt-3 text-sm text-[var(--color-brand)]">
          {error}{" "}
          {!signedIn && (
            <Link href="/me" className="font-semibold underline">
              Sign in
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
