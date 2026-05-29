"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { btn } from "./bits";

interface PlaceHit {
  id: string;
  name: string;
  address: string;
  borough: string;
  source: "corpus" | "place";
  existingContenderId: string | null;
}

const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]";

export default function AddPlace({
  subSlug,
  subName,
  signedIn,
  dishNames,
}: {
  subSlug: string;
  subName: string;
  signedIn: boolean;
  dishNames: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "suggest">("search");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [picked, setPicked] = useState<PlaceHit | null>(null);
  const [dish, setDish] = useState("");
  const [dishHint, setDishHint] = useState<{ decision: string; suggestion: string | null } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sg, setSg] = useState({ name: "", address: "", borough: "Manhattan" });

  useEffect(() => {
    if (mode !== "search" || picked) return;
    const term = q.trim();
    if (!term) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/places/search?q=${encodeURIComponent(term)}&sub=${subSlug}`);
        const d = await r.json();
        setHits(d.places ?? []);
      } catch {
        /* ignore */
      }
    }, 160);
    return () => clearTimeout(t);
  }, [q, subSlug, mode, picked]);

  // Live dish-name resolution against the category vocabulary (snap/suggest/new).
  useEffect(() => {
    if (!picked) return;
    const term = dish.trim();
    if (term.length < 2) {
      setDishHint(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/dishes/match?sub=${subSlug}&q=${encodeURIComponent(term)}`);
        const d = await r.json();
        setDishHint(d.suggestion && d.suggestion.toLowerCase() !== term.toLowerCase() ? d : null);
      } catch {
        /* ignore */
      }
    }, 200);
    return () => clearTimeout(t);
  }, [dish, picked, subSlug]);

  function chooseHit(hit: PlaceHit) {
    if (hit.existingContenderId) {
      router.push(`/c/${hit.existingContenderId}`);
      return;
    }
    setPicked(hit);
    setDish("");
    setNote("");
    setMsg(null);
  }

  async function confirmAdd() {
    if (!picked) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/contenders/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placeId: picked.id, sub: subSlug, title: dish, description: note }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg(d.error ?? "Couldn't add.");
        return;
      }
      router.push(`/c/${d.contenderId}`);
    } catch {
      setMsg("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function suggest() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/places/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...sg, sub: subSlug }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg(d.error ?? "Couldn't submit.");
        return;
      }
      setMsg("Thanks — sent to a curator for review.");
      setSg({ name: "", address: "", borough: "Manhattan" });
    } catch {
      setMsg("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) {
    return (
      <p className="mt-6 text-sm text-[var(--color-ink-dim)]">
        <Link
          href={`/me?returnTo=${encodeURIComponent(`/nyc/${subSlug}`)}`}
          className="font-semibold text-[var(--color-brand)] hover:underline"
        >
          Sign in
        </Link>{" "}
        to add a {subName.toLowerCase()} you&apos;ve tried.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-6 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink-dim)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-ink)]"
      >
        + Add a {subName.toLowerCase()} you&apos;ve tried
      </button>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold">Add a {subName.toLowerCase()} you&apos;ve tried</span>
        <button onClick={() => setOpen(false)} className="text-sm text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]">
          Close
        </button>
      </div>

      {picked ? (
        <div className="space-y-3">
          <div className="text-sm">
            <span className="font-semibold">{picked.name}</span>
            <span className="text-[var(--color-ink-dim)]"> · {picked.address || picked.borough}</span>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">What did you have? (dish name)</label>
            <input
              value={dish}
              onChange={(e) => setDish(e.target.value)}
              list="bf-dish-names"
              placeholder={dishNames[0] ? `e.g. ${dishNames[0]}` : subName}
              className={inputCls}
            />
            <datalist id="bf-dish-names">
              {dishNames.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-[var(--color-ink-dim)]">
              Pick a suggested name when you can — it keeps dishes clean and avoids duplicates.
            </p>
            {dishHint?.suggestion && (
              <button
                type="button"
                onClick={() => {
                  setDish(dishHint.suggestion as string);
                  setDishHint(null);
                }}
                className="mt-1.5 text-sm text-[var(--color-brand)] hover:underline"
              >
                {dishHint.decision === "snap" ? "We already list this as" : "Did you mean"}{" "}
                <span className="font-semibold">“{dishHint.suggestion}”</span>? Use it →
              </button>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="A few words of detail"
              className={inputCls}
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={confirmAdd} disabled={busy || !dish.trim()} className={btn("primary")}>
              {busy ? "Adding…" : "Add & rate it"}
            </button>
            <button onClick={() => setPicked(null)} className={btn("ghost")}>
              ← Back
            </button>
            {msg && <span className="text-xs text-[var(--color-ink-dim)]">{msg}</span>}
          </div>
        </div>
      ) : mode === "search" ? (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the NYC place by name…"
            className={inputCls}
          />
          <div className="mt-2 max-h-72 overflow-auto">
            {hits.map((h) => (
              <button
                key={h.id}
                onClick={() => chooseHit(h)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--color-surface-2)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{h.name}</span>
                  <span className="block truncate text-xs text-[var(--color-ink-dim)]">{h.address || h.borough}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-[var(--color-brand)]">
                  {h.existingContenderId ? "Rate it →" : "Add →"}
                </span>
              </button>
            ))}
            {q.trim() && hits.length === 0 && (
              <p className="px-2 py-3 text-sm text-[var(--color-ink-dim)]">No match in our NYC list.</p>
            )}
          </div>
          <button
            onClick={() => {
              setMode("suggest");
              setMsg(null);
            }}
            className="mt-2 text-sm text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
          >
            Can&apos;t find it? Suggest a new place →
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <input value={sg.name} onChange={(e) => setSg({ ...sg, name: e.target.value })} placeholder="Place name" className={inputCls} />
          <input value={sg.address} onChange={(e) => setSg({ ...sg, address: e.target.value })} placeholder="Street address, NYC" className={inputCls} />
          <select value={sg.borough} onChange={(e) => setSg({ ...sg, borough: e.target.value })} className={inputCls}>
            {BOROUGHS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <div className="flex items-center gap-3">
            <button onClick={suggest} disabled={busy} className={btn("primary")}>
              Submit for review
            </button>
            <button onClick={() => setMode("search")} className={btn("ghost")}>
              ← Back to search
            </button>
          </div>
          <p className="text-xs text-[var(--color-ink-dim)]">
            New places must be a real NYC location and are approved by a curator before they&apos;re ranked.
          </p>
        </div>
      )}

      {msg && mode === "suggest" && <p className="mt-2 text-sm text-[var(--color-ink-dim)]">{msg}</p>}
    </div>
  );
}
