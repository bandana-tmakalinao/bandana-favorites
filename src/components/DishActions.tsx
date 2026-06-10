"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PhotoUpload from "@/components/PhotoUpload";
import PinButton from "@/components/PinButton";
import ShareButton from "@/components/ShareButton";

/**
 * The viewer-specific action row on a dish page (rank/re-rank CTA, pin state, photo upload),
 * hydrated from /api/me/context?sub= so the page itself stays a cookie-free ISR shell.
 * Renders signed-out defaults immediately; upgrades in place once the context resolves.
 */
export default function DishActions({
  contenderId,
  sub,
  shareTitle,
  pageHref,
}: {
  contenderId: string;
  sub: string;
  shareTitle: string;
  pageHref: string;
}) {
  const [signedIn, setSignedIn] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [alreadyRanked, setAlreadyRanked] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let on = true;
    fetch(`/api/me/context?sub=${encodeURIComponent(sub)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!on || !d) return;
        setSignedIn(!!d.user);
        setPinned((d.pinnacle ?? []).includes(contenderId));
        setAlreadyRanked((d.sub?.personal ?? []).some((v: { id: string }) => v.id === contenderId));
        setResolved(true);
      })
      .catch(() => on && setResolved(true));
    return () => {
      on = false;
    };
  }, [contenderId, sub]);

  return (
    <div className="mt-6 space-y-4 border-t border-[var(--color-border)] pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/duel?sub=${sub}&target=${contenderId}`}
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--color-brand-soft)]"
        >
          {alreadyRanked ? "↻ Re-rank this for me" : "⚔️ Rank this for me"}
        </Link>
        {/* PinButton renders nothing when signed out — keyed remount once context resolves so
            initialPinned lands correctly. */}
        {resolved && <PinButton key={`pin-${pinned}`} contenderId={contenderId} signedIn={signedIn} initialPinned={pinned} />}
        <ShareButton kind="dish" id={contenderId} title={shareTitle} pageHref={pageHref} variant="ghost" />
        {resolved && <PhotoUpload contenderId={contenderId} signedIn={signedIn} />}
        <Link
          href={`/duel?sub=${sub}&keep=${contenderId}&mode=open`}
          className="text-sm text-[var(--color-ink-dim)] transition hover:text-[var(--color-ink)]"
        >
          or open-duel it →
        </Link>
      </div>
      {alreadyRanked && (
        <p className="mt-2 text-xs text-[var(--color-ink-dim)]">
          You&apos;ve ranked this — re-ranking pulls it out and places it fresh against your other picks.
        </p>
      )}
    </div>
  );
}
