"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PhotoThumb, ScoreBadge } from "./bits";
import { TRUST } from "@/lib/config";
import type { ContenderView } from "@/lib/types";
import type { CategoryStanding } from "@/db/repo";

interface Pair {
  category: { emoji: string; name: string };
  subcategory: { slug: string; name: string };
  a: ContenderView;
  b: ContenderView;
}

// ---------------------------------------------------------------------------
// Adaptive binary-search ranking
// ---------------------------------------------------------------------------

interface AdaptiveState {
  /** User's personal ranking so far, best first (index 0 = #1). */
  sortedPlaced: ContenderView[];
  /** Items still to be ranked — in community rank order. */
  toPlace: ContenderView[];
  /** Binary search bounds into sortedPlaced for the current target. */
  lo: number;
  hi: number;
  done: boolean;
  /** Original count of items to place — for progress display. */
  totalToPlace: number;
}

function initAdaptive(king: ContenderView, tried: ContenderView[]): AdaptiveState {
  const toPlace = tried.filter((v) => v.id !== king.id);
  return {
    sortedPlaced: [king],
    toPlace,
    lo: 0,
    hi: 1,
    done: toPlace.length === 0,
    totalToPlace: toPlace.length,
  };
}

/** Compute the next matchup pair from the adaptive state (null when done). */
function nextAdaptivePair(state: AdaptiveState, template: Pair): Pair | null {
  if (state.done || state.toPlace.length === 0) return null;
  const target = state.toPlace[0];
  const mid = Math.floor((state.lo + state.hi) / 2);
  const pivot = state.sortedPlaced[mid];
  return { ...template, a: target, b: pivot };
}

/** Insert the current target into sortedPlaced at `pos`, then advance to the next item. */
function placeTarget(state: AdaptiveState, pos: number): AdaptiveState {
  const target = state.toPlace[0];
  const sp = [...state.sortedPlaced.slice(0, pos), target, ...state.sortedPlaced.slice(pos)];
  const tp = state.toPlace.slice(1);
  return {
    sortedPlaced: sp,
    toPlace: tp,
    lo: 0,
    hi: sp.length,
    done: tp.length === 0,
    totalToPlace: state.totalToPlace,
  };
}

/**
 * Advance the binary-search state after a comparison.
 * If target won → it belongs in the better (upper) half → shrink hi.
 * If target lost → it belongs in the worse (lower) half → grow lo.
 * When lo >= hi, insert target at lo and start the next item.
 */
function advanceAdaptive(winner: ContenderView, state: AdaptiveState): AdaptiveState {
  if (state.done || state.toPlace.length === 0) return state;
  const target = state.toPlace[0];
  const mid = Math.floor((state.lo + state.hi) / 2);
  const targetWon = winner.id === target.id;
  const newLo = targetWon ? state.lo : mid + 1;
  const newHi = targetWon ? mid : state.hi;
  if (newLo >= newHi) return placeTarget(state, newLo);
  return { ...state, lo: newLo, hi: newHi };
}

/** "Too close to call" — settle the current item right below the pivot, recording nothing. */
function resolveTie(state: AdaptiveState): AdaptiveState {
  if (state.done || state.toPlace.length === 0) return state;
  const mid = Math.floor((state.lo + state.hi) / 2);
  return placeTarget(state, Math.min(mid + 1, state.sortedPlaced.length));
}

// ---------------------------------------------------------------------------
// Trust meter
// ---------------------------------------------------------------------------

function standingLabel(s: CategoryStanding, subName: string): { title: string; sub: string } {
  if (s.role === "member") return { title: `★ ${subName} expert`, sub: "Your votes carry full weight here" };
  if (s.trust >= s.cap) return { title: "Trusted taster", sub: "You've earned real pull in this category" };
  return { title: `Building ${subName.toLowerCase()} trust`, sub: "Each duel makes your vote count more" };
}

function TrustMeter({ standing, subName }: { standing: CategoryStanding; subName: string }) {
  // Scale the bar against the expert ceiling so the normal cap reads as "most of the way."
  const pct = Math.max(0, Math.min(100, (standing.trust / TRUST.EXPERT_CAP) * 100));
  const capPct = (standing.cap / TRUST.EXPERT_CAP) * 100;
  const { title, sub } = standingLabel(standing, subName);
  const isExpert = standing.role === "member";
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className={`text-sm font-bold ${isExpert ? "text-[#b57e12]" : "text-[var(--color-ink)]"}`}>
          {title}
        </span>
        <span className="text-xs text-[var(--color-ink-dim)]">vote weight ×{standing.weight.toFixed(2)}</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isExpert ? "bg-[var(--color-gold)]" : "bg-[var(--color-brand)]"}`}
          style={{ width: `${pct}%` }}
        />
        {!isExpert && (
          // The normal-user ceiling marker; the zone beyond is reserved for category experts.
          <div
            className="absolute top-0 h-full w-px bg-[var(--color-ink-dim)]/50"
            style={{ left: `${capPct}%` }}
            title="Normal-user cap — experts go further"
          />
        )}
      </div>
      <p className="mt-1.5 text-xs text-[var(--color-ink-dim)]">{sub}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DuelBoard({
  initialPair,
  sub,
  signedIn,
  initialKeepId,
  initialPrefer,
  adaptiveItems,
  kingView,
  placeId,
  placeName,
  initialStanding,
}: {
  initialPair: Pair | null;
  sub?: string;
  signedIn: boolean;
  initialKeepId?: string;
  initialPrefer?: string[];
  adaptiveItems?: ContenderView[];
  kingView?: ContenderView;
  placeId?: string;
  placeName?: string;
  initialStanding?: CategoryStanding | null;
}) {
  const isAdaptive = Boolean(kingView && adaptiveItems && adaptiveItems.length > 0);

  const [adaptiveState, setAdaptiveState] = useState<AdaptiveState | null>(() =>
    isAdaptive ? initAdaptive(kingView!, adaptiveItems!) : null,
  );

  const [pair, setPair] = useState<Pair | null>(() => {
    if (adaptiveState && initialPair) return nextAdaptivePair(adaptiveState, initialPair) ?? initialPair;
    return initialPair;
  });

  const [kingId, setKingId] = useState<string | null>(initialKeepId ?? null);
  const [streak, setStreak] = useState(0);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefer, setPrefer] = useState<string[]>(initialPrefer ?? []);
  const [standing, setStanding] = useState<CategoryStanding | null>(initialStanding ?? null);
  const [justGrew, setJustGrew] = useState(false);

  const pairTemplate = initialPair;
  const subSlug = () => pair?.subcategory.slug ?? sub;
  const subName = initialPair?.subcategory.name ?? pair?.subcategory.name ?? "dish";

  // Pulse the trust meter briefly whenever the trust value ticks up.
  useEffect(() => {
    if (!justGrew) return;
    const t = setTimeout(() => setJustGrew(false), 600);
    return () => clearTimeout(t);
  }, [justGrew]);

  async function load(keep?: string, preferList?: string[]) {
    const qs = new URLSearchParams();
    if (subSlug()) qs.set("sub", subSlug()!);
    if (keep) qs.set("keep", keep);
    if (preferList && preferList.length > 0) qs.set("prefer", preferList.join(","));
    const res = await fetch(`/api/duel?${qs.toString()}`);
    const data = await res.json();
    setPair(data.pair ?? null);
  }

  async function swapChallenger() {
    setError(null);
    if (kingId) await load(kingId, prefer);
    else await load(undefined, prefer);
  }

  async function newMatchup() {
    setError(null);
    setKingId(null);
    setStreak(0);
    await load();
  }

  // Adaptive "too close to call" — settle without recording a noisy coin-flip.
  function tooClose() {
    if (!adaptiveState || adaptiveState.done) return;
    const newState = resolveTie(adaptiveState);
    setAdaptiveState(newState);
    setPair(newState.done || !pairTemplate ? null : nextAdaptivePair(newState, pairTemplate));
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
        body: JSON.stringify({
          winnerId: winner.id,
          loserId: loser.id,
          sub: subSlug(),
          ...(isAdaptive ? {} : { prefer: prefer.filter((id) => id !== loser.id) }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setCount((c) => c + 1);
      if (data.standing) {
        if (standing && data.standing.trust > standing.trust) setJustGrew(true);
        setStanding(data.standing);
      }

      if (adaptiveState && !adaptiveState.done) {
        const newState = advanceAdaptive(winner, adaptiveState);
        setAdaptiveState(newState);
        setPair(newState.done || !pairTemplate ? null : nextAdaptivePair(newState, pairTemplate));
      } else {
        const nextPrefer = prefer.filter((id) => id !== loser.id);
        setPrefer(nextPrefer);
        setStreak((s) => (winner.id === kingId ? s + 1 : 1));
        setKingId(winner.id);
        setPair(data.next ?? null);
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Adaptive done: the payoff — personal ranking vs the crowd
  // ---------------------------------------------------------------------------
  if (adaptiveState?.done) {
    const ranked = adaptiveState.sortedPlaced;
    // How contrarian is this taste? Average |personal rank − community rank| over items the crowd has ranked.
    const deltas = ranked
      .map((v, i) => (v.rank != null ? Math.abs(v.rank - (i + 1)) : null))
      .filter((d): d is number => d != null);
    const avgDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
    const summary =
      deltas.length === 0
        ? "You're charting fresh territory — the crowd hasn't ranked these yet."
        : avgDelta < 1.2
          ? "You're dialed in with the crowd — refined taste."
          : avgDelta < 3
            ? "A few hot takes in here — you don't just follow the pack."
            : "Genuinely contrarian taste. The list bends to you.";

    return (
      <div className="bf-fade">
        <h1 className="mb-1 text-2xl font-black sm:text-3xl">Your {subName} ranking</h1>
        <p className="mb-5 text-sm text-[var(--color-ink-dim)]">
          {summary} <span className="text-[var(--color-ink-dim)]">· {count} comparison{count !== 1 ? "s" : ""}</span>
        </p>

        {standing && (
          <div className="mb-5">
            <TrustMeter standing={standing} subName={subName} />
          </div>
        )}

        <ol className="mb-6 overflow-hidden rounded-2xl border border-[var(--color-border)]">
          {ranked.map((v, i) => {
            const crowd = v.rank;
            const delta = crowd != null ? crowd - (i + 1) : null;
            return (
              <li
                key={v.id}
                className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 last:border-b-0"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-brand)] text-sm font-black text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/c/${v.id}`} className="font-semibold hover:underline">
                    {v.title}
                  </Link>
                  <p className="truncate text-sm text-[var(--color-ink-dim)]">
                    {v.placeName} · {v.neighborhood}
                  </p>
                </div>
                {crowd != null && (
                  <span
                    className="hidden shrink-0 items-center gap-1 text-xs text-[var(--color-ink-dim)] sm:flex"
                    title={`Community rank #${crowd}`}
                  >
                    Crowd #{crowd}
                    {delta != null && delta !== 0 && (
                      <span className={delta > 0 ? "text-[var(--color-good)]" : "text-[var(--color-brand)]"}>
                        {delta > 0 ? "▲" : "▼"}
                      </span>
                    )}
                  </span>
                )}
                <ScoreBadge score={v.score} size="sm" />
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col gap-4">
          {placeId && placeName && (
            <Link
              href={`/p/${placeId}`}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[var(--color-brand)] px-6 py-8 text-center transition hover:bg-[var(--color-brand)]/5"
            >
              <span className="text-3xl">🍜</span>
              <span className="text-xl font-black text-[var(--color-ink)]">Love {placeName}?</span>
              <span className="text-sm text-[var(--color-ink-dim)]">
                Add more of their dishes across every food type you&apos;ve tried there.
              </span>
              <span className="mt-1 rounded-lg bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white">
                Add more dishes from {placeName} →
              </span>
            </Link>
          )}
          <Link
            href={`/nyc/${sub ?? ""}`}
            className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-[var(--color-brand)]/30 px-6 py-6 text-center transition hover:border-[var(--color-brand)]/60 hover:bg-[var(--color-surface)]"
          >
            <span className="text-lg font-bold text-[var(--color-ink)]">
              See where your picks land in the full {subName} ranking →
            </span>
            <span className="text-sm text-[var(--color-ink-dim)]">
              Your comparisons just moved the needle on the community list.
            </span>
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // No pair available
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Active duel
  // ---------------------------------------------------------------------------
  const isKing = (c: ContenderView) => c.id === kingId && streak >= 1;

  const adaptiveProgress =
    adaptiveState && !adaptiveState.done
      ? {
          itemsDone: adaptiveState.totalToPlace - adaptiveState.toPlace.length,
          itemsTotal: adaptiveState.totalToPlace,
          target: adaptiveState.toPlace[0],
          pivotRank: Math.floor((adaptiveState.lo + adaptiveState.hi) / 2) + 1, // 1-indexed
          lo: adaptiveState.lo,
          hi: adaptiveState.hi,
          placed: adaptiveState.sortedPlaced,
        }
      : null;

  // In adaptive mode card `a` is always the new dish being placed; `b` is one of your ranked picks.
  const Card = ({ c, other, ribbon }: { c: ContenderView; other: ContenderView; ribbon?: string }) => {
    const badge = isKing(c) ? `👑 ${streak} in a row` : ribbon;
    return (
      <button
        onClick={() => choose(c, other)}
        disabled={busy}
        className="group relative flex-1 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-left transition hover:border-[var(--color-brand)] hover:shadow-[0_0_0_3px_var(--color-brand)] disabled:opacity-60"
      >
        <PhotoThumb url={c.photoUrl} alt={c.title} className="h-40 w-full sm:h-52" />
        <div className="p-3">
          {badge && (
            <span
              className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold text-white ${
                isKing(c) ? "bg-[var(--color-ink)]" : "bg-[var(--color-brand)]"
              }`}
            >
              {badge}
            </span>
          )}
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{c.title}</div>
              <div className="truncate text-sm text-[var(--color-ink-dim)]">
                {c.placeName} · {c.neighborhood}
              </div>
            </div>
            <ScoreBadge score={c.score} size="sm" />
          </div>
        </div>
      </button>
    );
  };

  return (
    <div>
      {/* Trust meter — visible for any signed-in taster */}
      {signedIn && standing && (
        <div className={`mb-5 transition ${justGrew ? "scale-[1.01]" : ""}`}>
          <TrustMeter standing={standing} subName={subName} />
        </div>
      )}

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          {adaptiveProgress ? (
            <>
              <h1 className="text-xl font-black sm:text-2xl">
                Is it better than your #{adaptiveProgress.pivotRank}?
              </h1>
              <p className="mt-0.5 text-sm text-[var(--color-ink-dim)]">
                Placing <span className="font-semibold text-[var(--color-ink)]">{adaptiveProgress.target.title}</span> ·
                dish {adaptiveProgress.itemsDone + 1} of {adaptiveProgress.itemsTotal}
              </p>
            </>
          ) : (
            <h1 className="text-xl font-black sm:text-2xl">
              Which {pair.subcategory.name.toLowerCase()} is better?
            </h1>
          )}
        </div>
        <Link
          href={`/nyc/${pair.subcategory.slug}`}
          className="shrink-0 text-sm text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
        >
          See the ranking →
        </Link>
      </div>

      <div key={pair.a.id + pair.b.id} className="bf-fade flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <Card c={pair.a} other={pair.b} ribbon={isAdaptive ? "New pick" : undefined} />
        <div className="grid shrink-0 place-items-center py-1 text-sm font-black text-[var(--color-ink-dim)] sm:py-0">
          VS
        </div>
        <Card c={pair.b} other={pair.a} ribbon={adaptiveProgress ? `Your #${adaptiveProgress.pivotRank}` : undefined} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-ink-dim)]">
        {isAdaptive ? (
          <button
            onClick={tooClose}
            disabled={busy}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 font-medium transition hover:border-[var(--color-ink-dim)] hover:text-[var(--color-ink)] disabled:opacity-50"
          >
            Too close to call
          </button>
        ) : (
          <div className="flex flex-wrap gap-4">
            <button onClick={swapChallenger} disabled={busy} className="hover:text-[var(--color-ink)] disabled:opacity-50">
              Haven&apos;t tried one → new challenger
            </button>
            <button onClick={newMatchup} disabled={busy} className="hover:text-[var(--color-ink)] disabled:opacity-50">
              ⤨ New matchup
            </button>
          </div>
        )}
        <span>
          {count > 0 ? `${count} duel${count === 1 ? "" : "s"} this session` : "Pick the better one — winner stays"}
        </span>
      </div>

      {/* Live "it's learning" ranking — watch your list build as you duel */}
      {adaptiveProgress && adaptiveProgress.placed.length > 0 && (
        <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-dim)]">
            Your ranking so far · narrowing {adaptiveProgress.target.title} to{" "}
            {adaptiveProgress.lo + 1 === adaptiveProgress.hi
              ? `#${adaptiveProgress.lo + 1}`
              : `#${adaptiveProgress.lo + 1}–#${adaptiveProgress.hi}`}
          </p>
          <ol className="space-y-0.5">
            {adaptiveProgress.placed.map((v, i) => {
              const inBand = i >= adaptiveProgress.lo && i < adaptiveProgress.hi;
              const isPivot = i + 1 === adaptiveProgress.pivotRank;
              return (
                <li
                  key={v.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                    isPivot
                      ? "bg-[var(--color-brand)]/10 ring-1 ring-[var(--color-brand)]"
                      : inBand
                        ? "bg-[var(--color-brand)]/5"
                        : ""
                  }`}
                >
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-[var(--color-ink-dim)]">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{v.title}</span>
                  <span className="min-w-0 max-w-[42%] shrink truncate text-xs text-[var(--color-ink-dim)]">{v.placeName}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

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
