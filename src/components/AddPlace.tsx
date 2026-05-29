"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PlaceHit {
  id: string;
  name: string;
  address: string;
  borough: string;
  source: "corpus" | "place";
  existingContenderId: string | null;
}

const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

export default function AddPlace({
  subSlug,
  subName,
  signedIn,
}: {
  subSlug: string;
  subName: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "suggest">("search");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sg, setSg] = useState({ name: "", address: "", borough: "Manhattan" });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== "search") return;
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
  }, [q, subSlug, mode]);

  async function add(hit: PlaceHit) {
    if (hit.existingContenderId) {
      router.push(`/c/${hit.existingContenderId}`);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/contenders/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placeId: hit.id, sub: subSlug }),
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
        <Link href="/me" className="font-semibold text-[var(--color-brand)] hover:underline">
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
        className="mt-6 rounded-lg border border-dashed border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink-dim)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-ink)]"
      >
        + Add a {subName.toLowerCase()} you&apos;ve tried
      </button>
    );
  }

  return (
    <div ref={boxRef} className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold">Add a {subName.toLowerCase()} you&apos;ve tried</span>
        <button onClick={() => setOpen(false)} className="text-sm text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]">
          Close
        </button>
      </div>

      {mode === "search" ? (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the NYC place by name…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]"
          />
          <div className="mt-2 max-h-72 overflow-auto">
            {hits.map((h) => (
              <button
                key={h.id}
                onClick={() => add(h)}
                disabled={busy}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--color-surface-2)] disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{h.name}</span>
                  <span className="block truncate text-xs text-[var(--color-ink-dim)]">
                    {h.address || h.borough}
                  </span>
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
          <input
            value={sg.name}
            onChange={(e) => setSg({ ...sg, name: e.target.value })}
            placeholder="Place name"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]"
          />
          <input
            value={sg.address}
            onChange={(e) => setSg({ ...sg, address: e.target.value })}
            placeholder="Street address, NYC"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]"
          />
          <select
            value={sg.borough}
            onChange={(e) => setSg({ ...sg, borough: e.target.value })}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]"
          >
            {BOROUGHS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <div className="flex items-center gap-3">
            <button
              onClick={suggest}
              disabled={busy}
              className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-soft)] disabled:opacity-50"
            >
              Submit for review
            </button>
            <button onClick={() => setMode("search")} className="text-sm text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]">
              ← Back to search
            </button>
          </div>
          <p className="text-xs text-[var(--color-ink-dim)]">
            New places must be a real NYC location and are approved by a curator before they&apos;re ranked.
          </p>
        </div>
      )}

      {msg && <p className="mt-2 text-sm text-[var(--color-ink-dim)]">{msg}</p>}
    </div>
  );
}
