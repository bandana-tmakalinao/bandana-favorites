"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScoreBadge, btn } from "./bits";
import type { ContenderView } from "@/lib/types";

interface PlaceHit {
  id: string;
  name: string;
  address: string;
  borough: string;
  source: "corpus" | "place";
  existingDishes: { id: string; title: string }[];
}

type Phase = "idle" | "step1" | "step2" | "saving";

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]";

export default function CategoryOnboarding({
  sub,
  subName,
  top20,
}: {
  sub: string;
  subName: string;
  top20: ContenderView[];
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [favoritePlaceId, setFavoritePlaceId] = useState<string | null>(null);
  const [favoritePlaceName, setFavoritePlaceName] = useState<string | null>(null);
  const [triedIds, setTriedIds] = useState<Set<string>>(new Set());

  // Step-1 search state
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<PlaceHit[]>([]);
  const [pickedHit, setPickedHit] = useState<PlaceHit | null>(null);
  const [dishName, setDishName] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  // Escape closes the sheet (when open).
  useEffect(() => {
    if (phase === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhase("idle");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // Debounced place search
  useEffect(() => {
    if (phase !== "step1" || pickedHit) return;
    const term = searchQ.trim();
    if (!term) {
      setSearchHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/places/search?q=${encodeURIComponent(term)}&sub=${sub}`);
        const d = await r.json();
        setSearchHits(d.places ?? []);
      } catch {
        /* ignore */
      }
    }, 200);
    return () => clearTimeout(t);
  }, [searchQ, pickedHit, phase, sub]);

  function open() {
    setPhase("step1");
    setFavoriteId(null);
    setFavoritePlaceId(null);
    setFavoritePlaceName(null);
    setTriedIds(new Set());
    setSearchQ("");
    setSearchHits([]);
    setPickedHit(null);
    setDishName("");
  }

  function close() {
    setPhase("idle");
  }

  function confirmFavorite(id: string, placeId?: string, placeName?: string) {
    setFavoriteId(id);
    setFavoritePlaceId(placeId ?? null);
    setFavoritePlaceName(placeName ?? null);
    setPhase("step2");
  }

  async function addAndConfirm() {
    if (!pickedHit || !dishName.trim()) return;
    setAddBusy(true);
    try {
      const r = await fetch("/api/contenders/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placeId: pickedHit.id, sub, title: dishName.trim() }),
      });
      const d = await r.json();
      if (d.contenderId) confirmFavorite(d.contenderId, d.placeId ?? undefined, pickedHit.name);
    } catch {
      /* ignore */
    } finally {
      setAddBusy(false);
    }
  }

  function toggleTried(id: string) {
    setTriedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function finish() {
    if (!favoriteId) return;
    setPhase("saving");
    await fetch("/api/category/favorite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sub, contenderId: favoriteId }),
    });
    const tried = [...triedIds].filter((id) => id !== favoriteId);
    const qs = new URLSearchParams({ sub, keep: favoriteId });
    if (tried.length > 0) qs.set("tried", tried.join(","));
    if (favoritePlaceId) qs.set("placeId", favoritePlaceId);
    if (favoritePlaceName) qs.set("place", favoritePlaceName);
    router.push(`/duel?${qs.toString()}`);
  }

  // --- Render trigger (idle state) ---
  if (phase === "idle") {
    return (
      <button
        onClick={open}
        className="mb-6 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[var(--color-brand)] px-6 py-8 text-center transition hover:bg-[var(--color-brand)]/5"
      >
        <span className="text-3xl">⭐</span>
        <span className="text-xl font-black text-[var(--color-ink)]">
          What&apos;s your favorite {subName.toLowerCase()}?
        </span>
        <span className="text-sm text-[var(--color-ink-dim)]">
          Tell us your #1 and we&apos;ll build your personal ranking from there.
        </span>
        <span className="mt-1 rounded-lg bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white">
          Set my favorite →
        </span>
      </button>
    );
  }

  // --- Modal sheet ---
  const step2List = top20.filter((v) => v.id !== favoriteId);
  const isSaving = phase === "saving";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={close}
        aria-hidden
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal
        className="bf-fade fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-[var(--color-bg)] shadow-2xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:max-h-[80vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg sm:rounded-2xl"
        style={{ maxHeight: "85dvh" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <p className="font-black text-lg leading-tight">
              {phase === "step2" ? "Which have you also tried?" : `What's your favorite ${subName.toLowerCase()}?`}
            </p>
            {phase === "step2" && (
              <p className="mt-0.5 text-sm text-[var(--color-ink-dim)]">
                Tap every one you&apos;ve actually eaten — we&apos;ll rank them against your favorite.
              </p>
            )}
          </div>
          <button
            onClick={close}
            className="ml-4 shrink-0 rounded-full p-1 text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* --- Step 1 --- */}
          {phase === "step1" && (
            <div>
              {/* Top-20 list */}
              {top20.length > 0 && (
                <div>
                  <p className="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-dim)]">
                    Community top picks
                  </p>
                  {top20.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => confirmFavorite(v.id, v.placeId, v.placeName)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-[var(--color-surface)]"
                    >
                      {v.rank !== null && (
                        <span className="w-5 shrink-0 text-center text-xs font-bold text-[var(--color-ink-dim)]">
                          {v.rank}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{v.title}</div>
                        <div className="truncate text-sm text-[var(--color-ink-dim)]">
                          {v.placeName} · {v.neighborhood}
                        </div>
                      </div>
                      <ScoreBadge score={v.score} size="sm" />
                    </button>
                  ))}
                </div>
              )}

              {/* Search section */}
              <div className="border-t border-[var(--color-border)] px-5 py-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-dim)]">
                  Not on the list? Search any NYC restaurant
                </p>
                {!pickedHit ? (
                  <>
                    <input
                      ref={searchRef}
                      type="text"
                      value={searchQ}
                      onChange={(e) => setSearchQ(e.target.value)}
                      placeholder={`Search restaurant for your favorite ${subName.toLowerCase()}…`}
                      className={inputCls}
                    />
                    {searchHits.length > 0 && (
                      <ul className="mt-2 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
                        {searchHits.map((h) => (
                          <li key={h.id} className="px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="block truncate font-semibold">{h.name}</span>
                                <span className="block truncate text-xs text-[var(--color-ink-dim)]">
                                  {h.address} · {h.borough}
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  setPickedHit(h);
                                  setSearchHits([]);
                                }}
                                className="shrink-0 text-xs font-semibold text-[var(--color-brand)]"
                              >
                                {h.existingDishes.length ? "+ new dish" : "Pick →"}
                              </button>
                            </div>
                            {h.existingDishes.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {h.existingDishes.map((d) => (
                                  <button
                                    key={d.id}
                                    onClick={() => confirmFavorite(d.id, h.id, h.name)}
                                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs transition hover:border-[var(--color-brand)]"
                                  >
                                    ⭐ {d.title}
                                  </button>
                                ))}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <div className="rounded-lg border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/5 p-3">
                    <p className="font-semibold">{pickedHit.name}</p>
                    <p className="text-sm text-[var(--color-ink-dim)]">{pickedHit.address}</p>
                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-ink-dim)]">
                        What did you have there?
                      </label>
                      <input
                        type="text"
                        value={dishName}
                        onChange={(e) => setDishName(e.target.value)}
                        placeholder={`e.g. Tonkotsu Ramen`}
                        className={inputCls}
                        onKeyDown={(e) => e.key === "Enter" && addAndConfirm()}
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={addAndConfirm}
                        disabled={!dishName.trim() || addBusy}
                        className={btn("primary")}
                      >
                        {addBusy ? "Adding…" : "Add & mark as favorite →"}
                      </button>
                      <button
                        onClick={() => setPickedHit(null)}
                        className={btn("ghost")}
                      >
                        Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- Step 2 --- */}
          {phase === "step2" && (
            <div>
              <p className="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-dim)]">
                Select all you&apos;ve tried
              </p>
              {step2List.map((v) => {
                const checked = triedIds.has(v.id);
                return (
                  <button
                    key={v.id}
                    onClick={() => toggleTried(v.id)}
                    className={`flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-[var(--color-surface)] ${checked ? "bg-[var(--color-brand)]/5" : ""}`}
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
                    <ScoreBadge score={v.score} size="sm" />
                  </button>
                );
              })}
              {step2List.length === 0 && (
                <p className="px-5 py-4 text-sm text-[var(--color-ink-dim)]">
                  No other ranked dishes yet — you&apos;re first to the table!
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer (step 2 only) */}
        {phase === "step2" && (
          <div className="shrink-0 border-t border-[var(--color-border)] px-5 py-4">
            <p className="mb-2 text-xs text-[var(--color-ink-dim)]">
              {triedIds.size === 0
                ? "Pick a few to build a real ranking — or just lock in your favorite."
                : `${triedIds.size} selected · ~${Math.max(1, Math.ceil(Math.log2(triedIds.size + 1)) * triedIds.size)} quick taps to rank them all`}
            </p>
            <button onClick={finish} disabled={isSaving} className={`${btn("primary")} w-full`}>
              {isSaving
                ? "Setting up your duels…"
                : triedIds.size === 0
                  ? "Lock in my favorite →"
                  : `Rank my ${triedIds.size + 1} picks →`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
