"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { btn } from "./bits";

function label(r: number): string {
  if (r >= 90) return "All-time great";
  if (r >= 75) return "Excellent";
  if (r >= 60) return "Really good";
  if (r >= 45) return "Solid";
  if (r >= 25) return "Just okay";
  return "Skip it";
}
function valueColor(r: number): string {
  if (r >= 75) return "var(--color-good)";
  if (r >= 45) return "var(--color-ink)";
  return "var(--color-ink-dim)";
}

export default function RatingControl({ contenderId, signedIn }: { contenderId: string; signedIn: boolean }) {
  const router = useRouter();
  const [tried, setTried] = useState(false);
  const [rating, setRating] = useState(70);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <p className="text-sm text-[var(--color-ink-dim)]">
        <Link href="/me" className="font-semibold text-[var(--color-brand)] hover:underline">
          Sign in
        </Link>{" "}
        to rate &amp; duel.
      </p>
    );
  }

  if (!tried) {
    return (
      <div>
        <button onClick={() => setTried(true)} className={btn("secondary")}>
          ✓ I&apos;ve tried this — rate it
        </button>
        <p className="mt-2 text-xs text-[var(--color-ink-dim)]">
          Only rate places you&apos;ve actually been. Duels still count for more.
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
    <div className="max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-end justify-between">
        <span className="text-sm font-medium text-[var(--color-ink-dim)]">How good is it?</span>
        <span className="flex items-baseline gap-2">
          <span className="text-3xl font-black tabular-nums" style={{ color: valueColor(rating) }}>
            {rating}
          </span>
          <span className="text-sm font-semibold">{label(rating)}</span>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
        className="bf-range"
        style={{
          background: `linear-gradient(90deg, var(--color-brand) ${rating}%, var(--color-surface-2) ${rating}%)`,
        }}
      />
      <div className="mt-1.5 flex justify-between text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-dim)]">
        <span>Skip it</span>
        <span>Average</span>
        <span>Best ever</span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button onClick={submit} disabled={busy} className={btn("primary")}>
          {busy ? "Saving…" : "Submit rating"}
        </button>
        <button onClick={() => setTried(false)} className={btn("ghost")}>
          Cancel
        </button>
        {msg && <span className="ml-1 text-xs text-[var(--color-ink-dim)]">{msg}</span>}
      </div>
    </div>
  );
}
