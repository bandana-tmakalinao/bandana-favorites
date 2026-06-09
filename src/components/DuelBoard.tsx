"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PhotoThumb, ScoreBadge, btn } from "./bits";
import { categoryGradient } from "@/lib/categoryTheme";
import { TRUST } from "@/lib/config";
import {
  initPlacement,
  advancePlace,
  resolveTie,
  removePivot,
  pivotIndex,
  type PlaceState,
} from "@/lib/placement";
import type { ContenderView } from "@/lib/types";
import type { CategoryStanding } from "@/db/repo";

interface Pair {
  category: { emoji: string; name: string };
  subcategory: { slug: string; name: string };
  a: ContenderView;
  b: ContenderView;
}

type Template = { category: { emoji: string; name: string }; subcategory: { slug: string; name: string } };
type Mode = "open" | "place";
type Phase = "duel" | "grid" | "recap";

/** Build the current matchup from a placement state: a = the dish being placed, b = the pivot. */
function buildPlacePair(state: PlaceState<ContenderView>, tmpl: Template): Pair | null {
  if (state.done || state.toPlace.length === 0) return null;
  const target = state.toPlace[0];
  const pivot = state.sortedPlaced[pivotIndex(state)];
  if (!pivot) return null;
  return { category: tmpl.category, subcategory: tmpl.subcategory, a: target, b: pivot };
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
  mode,
  initialPair,
  sub,
  signedIn,
  initialKeepId,
  initialPrefer,
  template,
  placed,
  candidates,
  targets,
  placeId,
  placeName,
  initialStanding,
}: {
  mode: Mode;
  initialPair?: Pair | null;
  sub?: string;
  signedIn: boolean;
  initialKeepId?: string;
  initialPrefer?: string[];
  // place mode:
  template?: Template;
  placed?: ContenderView[];
  candidates?: ContenderView[];
  targets?: ContenderView[];
  placeId?: string;
  placeName?: string;
  initialStanding?: CategoryStanding | null;
}) {
  const isPlace = mode === "place";
  const hasCandidates = (candidates?.length ?? 0) > 0;

  // Place mode runs ONE continuous flow: place whatever's queued (e.g. a new dish vs your history) →
  // ask which community top picks you've tried (grid) → place those into the same ladder → recap.
  // No untried randoms; the grid is shown exactly once per session.
  const initialPlaceState = isPlace ? initPlacement(placed ?? [], targets ?? []) : null;
  const initialPhase: Phase = !isPlace
    ? "duel"
    : initialPlaceState && !initialPlaceState.done
      ? "duel"
      : hasCandidates
        ? "grid"
        : "recap";

  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [tried, setTried] = useState<Set<string>>(new Set());
  const [gridShown, setGridShown] = useState(false);
  const [placeState, setPlaceState] = useState<PlaceState<ContenderView> | null>(initialPlaceState);
  // The accumulated personal order across runs — the ladder the next run inserts into, and what the recap shows.
  const [ladder, setLadder] = useState<ContenderView[]>(initialPlaceState?.sortedPlaced ?? placed ?? []);

  const [pair, setPair] = useState<Pair | null>(() => {
    if (isPlace) {
      return initialPhase === "duel" && initialPlaceState && template
        ? buildPlacePair(initialPlaceState, template)
        : null;
    }
    return initialPair ?? null;
  });

  const [kingId, setKingId] = useState<string | null>(initialKeepId ?? null);
  const [streak, setStreak] = useState(0);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  // The card just clicked — pulses while the next pair loads, so a pick feels like a hit.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefer, setPrefer] = useState<string[]>(initialPrefer ?? []);
  const [standing, setStanding] = useState<CategoryStanding | null>(initialStanding ?? null);
  const [justGrew, setJustGrew] = useState(false);

  const subSlug = () => pair?.subcategory.slug ?? template?.subcategory.slug ?? sub;
  const subName =
    template?.subcategory.name ?? initialPair?.subcategory.name ?? pair?.subcategory.name ?? "dish";

  // Pulse the trust meter briefly whenever the trust value ticks up.
  useEffect(() => {
    if (!justGrew) return;
    const t = setTimeout(() => setJustGrew(false), 600);
    return () => clearTimeout(t);
  }, [justGrew]);

  // --- open / king-of-the-hill helpers ---
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

  // --- place-mode transitions ---
  function startFromGrid() {
    const chosen = (candidates ?? []).filter((c) => tried.has(c.id));
    // Insert into the CURRENT ladder (which already holds your history + anything placed so far).
    // initPlacement dedupes, so a target already placed in the first run is skipped here.
    const st = initPlacement(ladder, [...(targets ?? []), ...chosen]);
    setGridShown(true);
    setPlaceState(st);
    setLadder(st.sortedPlaced);
    if (!st.done && template) {
      setPair(buildPlacePair(st, template));
      setPhase("duel");
    } else {
      setPair(null);
      setPhase("recap");
    }
  }

  function skipGrid() {
    setGridShown(true);
    setPhase("recap");
  }

  function recordPlaceResult(next: PlaceState<ContenderView>) {
    setPlaceState(next);
    if (!next.done) {
      setPair(template ? buildPlacePair(next, template) : null);
      return;
    }
    // A placement run finished — continue the flow: show the "have you tried?" grid once, then recap.
    setLadder(next.sortedPlaced);
    setPair(null);
    setPhase(hasCandidates && !gridShown ? "grid" : "recap");
  }

  // "Too close to call" — settle without recording a noisy coin-flip.
  function tooClose() {
    if (!placeState || placeState.done) return;
    recordPlaceResult(resolveTie(placeState));
  }

  // "Haven't tried this" — the opponent isn't something you've eaten; drop it and re-pick. No record.
  function notTried() {
    if (!placeState || placeState.done) return;
    recordPlaceResult(removePivot(placeState));
  }

  async function choose(winner: ContenderView, loser: ContenderView) {
    if (!signedIn) {
      setError("Sign in to settle duels.");
      return;
    }
    setBusy(true);
    setError(null);
    setPickedId(winner.id);
    try {
      const res = await fetch("/api/duel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          winnerId: winner.id,
          loserId: loser.id,
          sub: subSlug(),
          ...(isPlace ? {} : { prefer: prefer.filter((id) => id !== loser.id) }),
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

      if (isPlace && placeState && !placeState.done) {
        recordPlaceResult(advancePlace(winner.id === placeState.toPlace[0].id, placeState));
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
      setPickedId(null);
    }
  }

  // Desktop power flow: ← picks the left dish, → picks the right. Active only mid-duel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (busy || !pair) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        choose(pair.a, pair.b);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        choose(pair.b, pair.a);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------------------------------------------------------------------------
  // Place mode: the "have you tried?" grid
  // ---------------------------------------------------------------------------
  if (isPlace && phase === "grid") {
    const target = targets?.[0];
    const targetPending = target ? !ladder.some((v) => v.id === target.id) : false;
    function toggle(id: string) {
      setTried((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
    const pendingCount = tried.size + (targetPending ? 1 : 0);
    const nothing = pendingCount === 0;
    return (
      <div className="bf-fade">
        <h1 className="text-xl font-black sm:text-2xl">Which {subName.toLowerCase()} have you tried?</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-dim)]">
          We only rank dishes you&apos;ve actually had. Pick the ones you&apos;ve tried and we&apos;ll slot them into
          {ladder.length > 0 ? <> your ranking.</> : <> a ranking.</>}
        </p>

        {target && targetPending && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--color-brand)]/40 bg-[var(--color-brand)]/5 px-4 py-3">
            <PhotoThumb url={target.photoUrl} alt={target.title} className="h-12 w-12 rounded-lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{target.title}</p>
              <p className="truncate text-xs text-[var(--color-ink-dim)]">Your new pick — we&apos;ll place this one</p>
            </div>
          </div>
        )}

        <div className="mt-4 max-h-[55vh] overflow-y-auto rounded-2xl border border-[var(--color-border)]">
          {(candidates ?? []).map((v) => {
            const checked = tried.has(v.id);
            return (
              <button
                key={v.id}
                onClick={() => toggle(v.id)}
                className={`flex w-full items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 text-left transition last:border-b-0 hover:bg-[var(--color-surface)] ${checked ? "bg-[var(--color-brand)]/5" : ""}`}
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

        <button onClick={startFromGrid} disabled={nothing} className={`${btn("primary")} mt-4 w-full`}>
          {nothing ? "Pick the ones you've tried →" : `Rank my ${pendingCount} pick${pendingCount === 1 ? "" : "s"} →`}
        </button>
        {ladder.length > 0 ? (
          <button
            onClick={skipGrid}
            className="mt-2 block w-full text-center text-sm text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
          >
            Skip — see my ranking
          </button>
        ) : (
          <Link
            href={`/nyc/${sub ?? ""}`}
            className="mt-2 block text-center text-sm text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
          >
            Skip for now
          </Link>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Place mode done: the payoff — personal ranking vs the crowd
  // ---------------------------------------------------------------------------
  if (isPlace && phase === "recap") {
    const ranked = ladder;
    // How contrarian is this taste? Average |personal rank − community rank| over crowd-ranked items.
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
          {summary}{" "}
          <span className="text-[var(--color-ink-dim)]">· {count} comparison{count !== 1 ? "s" : ""}</span>
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
                <ScoreBadge score={v.score} size="sm" standing={v.standing} />
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col gap-4">
          {hasCandidates && (
            <Link
              href={`/duel?sub=${sub ?? ""}&mode=place`}
              className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-[var(--color-brand)]/30 px-6 py-6 text-center transition hover:border-[var(--color-brand)]/60 hover:bg-[var(--color-surface)]"
            >
              <span className="text-lg font-bold text-[var(--color-ink)]">
                Rank more {subName.toLowerCase()} you&apos;ve tried →
              </span>
              <span className="text-sm text-[var(--color-ink-dim)]">
                Add more of the spots you&apos;ve been to and we&apos;ll slot them in.
              </span>
            </Link>
          )}
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

  const placeProgress =
    isPlace && placeState && !placeState.done
      ? {
          itemsDone: placeState.totalToPlace - placeState.toPlace.length,
          itemsTotal: placeState.totalToPlace,
          target: placeState.toPlace[0],
          pivotRank: pivotIndex(placeState) + 1, // 1-indexed
          lo: placeState.lo,
          hi: placeState.hi,
          placed: placeState.sortedPlaced,
        }
      : null;

  // In place mode card `a` is always the new dish being placed; `b` is one of your ranked picks.
  const duelGradient = categoryGradient(subSlug());
  const Card = ({
    c,
    other,
    ribbon,
    highlight,
    keyHint,
  }: {
    c: ContenderView;
    other: ContenderView;
    ribbon?: string;
    highlight?: boolean;
    keyHint?: string;
  }) => {
    const badge = isKing(c) ? `👑 ${streak} in a row` : highlight ? `★ ${ribbon ?? "Ranking this"}` : ribbon;
    return (
      <button
        onClick={() => choose(c, other)}
        disabled={busy}
        className={`group relative flex-1 overflow-hidden rounded-2xl border bg-[var(--color-surface)] text-left transition hover:-translate-y-0.5 hover:border-[var(--color-brand)] hover:shadow-[0_12px_32px_-14px_rgba(35,28,22,0.45)] disabled:opacity-60 ${
          highlight ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/55" : "border-[var(--color-border)]"
        } ${pickedId === c.id ? "bf-pick" : ""}`}
      >
        {c.photoUrl ? (
          <PhotoThumb url={c.photoUrl} alt={c.title} className="h-44 w-full sm:h-56 lg:h-64" />
        ) : (
          // No photo yet → the category's poster gradient carries the card.
          <div
            className="relative grid h-28 w-full place-items-center overflow-hidden sm:h-36"
            style={{ backgroundImage: duelGradient }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-7 -right-2 select-none text-[6.5rem] opacity-20"
            >
              {pair?.category.emoji}
            </span>
            <span className="text-5xl drop-shadow-md transition-transform duration-200 group-hover:scale-110">
              {pair?.category.emoji}
            </span>
          </div>
        )}
        {keyHint && (
          <kbd className="absolute left-2.5 top-2.5 hidden rounded-md bg-black/30 px-2 py-0.5 font-mono text-xs font-bold text-white backdrop-blur-sm sm:block">
            {keyHint}
          </kbd>
        )}
        <div className="p-3 sm:p-4">
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
              <div className="line-clamp-2 font-bold leading-snug sm:text-lg">{c.title}</div>
              <div className="truncate text-sm text-[var(--color-ink-dim)]">
                {c.placeName} · {c.neighborhood}
              </div>
            </div>
            <ScoreBadge score={c.score} size="sm" standing={c.standing} />
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
          {placeProgress ? (
            <>
              <h1 className="font-display text-xl sm:text-2xl">
                Is it better than your #{placeProgress.pivotRank}?
              </h1>
              <p className="mt-0.5 text-sm text-[var(--color-ink-dim)]">
                Placing <span className="font-semibold text-[var(--color-ink)]">{placeProgress.target.title}</span> ·
                dish {placeProgress.itemsDone + 1} of {placeProgress.itemsTotal}
              </p>
            </>
          ) : (
            <h1 className="font-display text-xl sm:text-2xl">
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
        <Card c={pair.a} other={pair.b} ribbon={isPlace ? "Ranking this" : undefined} highlight={isPlace} keyHint="←" />
        <div className="grid shrink-0 place-items-center py-1 sm:py-0">
          <span
            className="grid h-11 w-11 place-items-center rounded-full font-display text-sm text-white shadow-[0_6px_18px_-6px_rgba(35,28,22,0.5)]"
            style={{ backgroundImage: duelGradient }}
          >
            VS
          </span>
        </div>
        <Card c={pair.b} other={pair.a} ribbon={placeProgress ? `Your #${placeProgress.pivotRank}` : undefined} keyHint="→" />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-ink-dim)]">
        {isPlace ? (
          <div className="flex flex-wrap gap-4">
            <button
              onClick={tooClose}
              disabled={busy}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 font-medium transition hover:border-[var(--color-ink-dim)] hover:text-[var(--color-ink)] disabled:opacity-50"
            >
              Too close to call
            </button>
            <button
              onClick={notTried}
              disabled={busy}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 font-medium transition hover:border-[var(--color-ink-dim)] hover:text-[var(--color-ink)] disabled:opacity-50"
            >
              Haven&apos;t tried {pair.b.title.length > 22 ? "this one" : `“${pair.b.title}”`}
            </button>
          </div>
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
          {count > 0 ? `${count} duel${count === 1 ? "" : "s"} this session` : "Pick the one you liked better"}
          <span className="hidden sm:inline"> · or press ←/→</span>
        </span>
      </div>

      {/* Live "it's learning" ranking — watch your list build as you duel */}
      {placeProgress && placeProgress.placed.length > 0 && (
        <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-dim)]">
            Your ranking so far · narrowing {placeProgress.target.title} to{" "}
            {placeProgress.lo + 1 === placeProgress.hi
              ? `#${placeProgress.lo + 1}`
              : `#${placeProgress.lo + 1}–#${placeProgress.hi}`}
          </p>
          <ol className="space-y-0.5">
            {placeProgress.placed.map((v, i) => {
              const inBand = i >= placeProgress.lo && i < placeProgress.hi;
              const isPivot = i + 1 === placeProgress.pivotRank;
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
