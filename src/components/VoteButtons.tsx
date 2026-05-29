"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function VoteButtons({ contenderId, signedIn }: { contenderId: string; signedIn: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<1 | -1 | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function vote(value: 1 | -1) {
    setPending(value);
    setMsg(null);
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contenderId, value }),
      });
      if (res.status === 401) {
        setMsg("Sign in to vote.");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Something went wrong.");
        return;
      }
      setMsg(value === 1 ? "Counted — thanks!" : "Counted.");
      router.refresh();
    } catch {
      setMsg("Network error.");
    } finally {
      setPending(null);
    }
  }

  if (!signedIn) {
    return (
      <div className="text-sm text-[var(--color-ink-dim)]">
        <Link href="/me" className="font-semibold text-[var(--color-brand)] hover:underline">
          Sign in
        </Link>{" "}
        to vote &amp; duel.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => vote(1)}
        disabled={pending !== null}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 transition hover:border-[var(--color-good)] disabled:opacity-50"
      >
        👍 Better than most
      </button>
      <button
        onClick={() => vote(-1)}
        disabled={pending !== null}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 transition hover:border-[var(--color-brand)] disabled:opacity-50"
      >
        👎 Overrated
      </button>
      {msg && <span className="text-xs text-[var(--color-ink-dim)]">{msg}</span>}
    </div>
  );
}
