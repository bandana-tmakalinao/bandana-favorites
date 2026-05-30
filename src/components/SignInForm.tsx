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
  googleEnabled = false,
}: {
  signedInName: string | null;
  googleEnabled?: boolean;
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
      {googleEnabled && (
        <>
          <a
            href="/api/auth/google"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-semibold transition hover:border-[var(--color-ink-dim)]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
            </svg>
            Continue with Google
          </a>
          <div className="my-3 flex items-center gap-3 text-xs text-[var(--color-ink-dim)]">
            <span className="h-px flex-1 bg-[var(--color-border)]" /> or <span className="h-px flex-1 bg-[var(--color-border)]" />
          </div>
        </>
      )}
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
