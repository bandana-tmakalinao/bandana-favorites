"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function label(r: number): string {
  if (r >= 90) return "All-time great";
  if (r >= 75) return "Excellent";
  if (r >= 60) return "Really good";
  if (r >= 45) return "Solid";
  if (r >= 25) return "Just okay";
  return "Skip it";
}

export default function RatingControl({ contenderId, signedIn }: { contenderId: string; signedIn: boolean }) {
  const router = useRouter();
  const [tried, setTried] = useState(false);
  const [rating, setRating] = useState(75);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <div className="text-sm text-[var(--color-ink-dim)]">
        <Link href="/me" className="font-semibold text-[var(--color-brand)] hover:underline">
          Sign in
        </Link>{" "}
        to rate &amp; duel.
      </div>
    );
  }

  if (!tried) {
    return (
      <div className="text-sm">
        <button
          onClick={() => setTried(true)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 font-semibold transition hover:border-[var(--color-brand)]"
        >
          ✓ I&apos;ve tried this — rate it
        </button>
        <p className="mt-1.5 text-xs text-[var(--color-ink-dim)]">
          Only rate places you&apos;ve actually been. Comparisons (duels) still count for more.
        </p>
      </div>
    );
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contenderId, rating }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Something went wrong.");
        return;
      }
      setMsg("Rating counted — thanks!");
      router.refresh();
    } catch {
      setMsg("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium">How good is it? (0–100)</span>
        <span className="flex items-baseline gap-2">
          <span className="text-2xl font-black tabular-nums">{rating}</span>
          <span className="text-xs text-[var(--color-ink-dim)]">{label(rating)}</span>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
        className="w-full accent-[var(--color-brand)]"
      />
      <div className="mt-1 flex justify-between text-[10px] text-[var(--color-ink-dim)]">
        <span>0 · skip it</span>
        <span>50 · average</span>
        <span>100 · best ever</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--color-brand-soft)] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Submit rating"}
        </button>
        {msg && <span className="text-xs text-[var(--color-ink-dim)]">{msg}</span>}
      </div>
    </div>
  );
}
