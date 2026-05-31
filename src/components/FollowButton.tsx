"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Follow / unfollow a user by handle. Optimistic toggle with a server round-trip; on 401 it nudges
 * the viewer to sign in. `signedIn` lets a signed-out viewer see the button (and be sent to sign-in).
 */
export default function FollowButton({
  handle,
  initialFollowing,
  signedIn,
  size = "md",
}: {
  handle: string;
  initialFollowing: boolean;
  signedIn: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);

  async function toggle() {
    if (!signedIn) {
      router.push(`/me?returnTo=${encodeURIComponent(`/u/${handle}`)}`);
      return;
    }
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, follow: next }),
      });
      if (!res.ok) setFollowing(!next); // revert on failure
      else router.refresh();
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  const pad = size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm";
  const base = `inline-flex items-center justify-center gap-1 rounded-full font-semibold transition disabled:opacity-60 ${pad}`;
  const cls = following
    ? `${base} border border-[var(--color-border)] bg-[var(--color-surface)] ${
        hover ? "text-[var(--color-brand-soft)] border-[var(--color-brand)]" : "text-[var(--color-ink-dim)]"
      }`
    : `${base} bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-soft)]`;

  return (
    <button
      onClick={toggle}
      disabled={busy}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cls}
      aria-pressed={following}
    >
      {following ? (hover ? "Unfollow" : "Following") : "＋ Follow"}
    </button>
  );
}
