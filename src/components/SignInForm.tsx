"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { btn } from "./bits";

// Only honor same-origin relative paths (no "//evil.com" open-redirect).
function safeReturnTo(v: string | null): string | null {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
}

export default function SignInForm({
  signedInName,
}: {
  signedInName: string | null;
}) {
  const router = useRouter();
  const returnTo = safeReturnTo(useSearchParams().get("returnTo"));
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not sign in.");
        return;
      }
      if (returnTo) router.push(returnTo);
      else router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    await fetch("/api/auth", { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (signedInName) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <span>
          Signed in as <strong>{signedInName}</strong>
        </span>
        <button onClick={signOut} disabled={busy} className={btn("secondary")}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <label className="block text-sm font-medium">Pick a display name to start</label>
      <p className="mb-3 text-xs text-[var(--color-ink-dim)]">
        Dev sign-in for the scaffold. The real version verifies a phone and earns trust over time.
      </p>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tim"
          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]"
        />
        <button type="submit" disabled={busy} className={btn("primary")}>
          Sign in
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-[var(--color-brand)]">{error}</p>}
    </form>
  );
}
