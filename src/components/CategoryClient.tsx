"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BrowseView from "@/components/BrowseView";
import CategoryAlsoTried from "@/components/CategoryAlsoTried";
import CategoryFavoriteBanner from "@/components/CategoryFavoriteBanner";
import CategoryOnboarding from "@/components/CategoryOnboarding";
import AddPlace from "@/components/AddPlace";
import type { ContenderView } from "@/lib/types";

type Me = { handle: string; name: string } | null;
type SubContext = {
  favoriteId: string | null;
  favorite: ContenderView | null;
  personal: ContenderView[];
};

/**
 * Everything viewer-specific on a category page, hydrated from ONE /api/me/context?sub= fetch —
 * the page itself stays a cookie-free ISR shell (the ranked list arrives as server props and is
 * fully crawlable in the cached HTML). Child components keep their exact pre-ISR prop contracts.
 */
export default function CategoryClient({
  sub,
  subName,
  ranked,
  provisional,
  center,
  dishNames,
}: {
  sub: string;
  subName: string;
  ranked: ContenderView[];
  provisional: ContenderView[];
  center: { lat: number; lng: number };
  dishNames: string[];
}) {
  const [me, setMe] = useState<Me | undefined>(undefined); // undefined = loading
  const [ctx, setCtx] = useState<SubContext | null>(null);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    setWelcome(new URLSearchParams(window.location.search).has("welcome"));
    let on = true;
    fetch(`/api/me/context?sub=${encodeURIComponent(sub)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!on) return;
        setMe(d?.user ?? null);
        setCtx(d?.sub ?? null);
      })
      .catch(() => on && setMe(null));
    return () => {
      on = false;
    };
  }, [sub]);

  const signedIn = !!me;
  const favoriteId = ctx?.favoriteId ?? null;

  return (
    <>
      {/* Sign-in CTA renders only once we KNOW the viewer is signed out — no flash for members. */}
      {me === null && (
        <div className="mb-4 flex items-center gap-4 rounded-xl border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/5 p-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/15 text-2xl">
            🍴
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Rank your favorite {subName.toLowerCase()}</p>
            <p className="text-sm text-[var(--color-ink-dim)]">
              Sign in or create an account to set your favorite and add the spots you&apos;ve tried.
            </p>
          </div>
          <Link
            href={`/me?returnTo=${encodeURIComponent(`/nyc/${sub}`)}`}
            className="shrink-0 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-soft)]"
          >
            Sign in →
          </Link>
        </div>
      )}

      {ctx?.favorite && <CategoryFavoriteBanner sub={sub} subName={subName} favorite={ctx.favorite} />}

      {signedIn && favoriteId && welcome && (
        <CategoryAlsoTried
          sub={sub}
          subName={subName}
          favoriteId={favoriteId}
          others={ranked.filter((v) => v.id !== favoriteId).slice(0, 20)}
        />
      )}

      {signedIn && !favoriteId && (
        <CategoryOnboarding sub={sub} subName={subName} top20={ranked.slice(0, 20)} />
      )}

      <BrowseView
        ranked={ranked}
        provisional={provisional}
        center={center}
        personal={ctx?.personal ?? []}
        signedIn={signedIn}
        subName={subName}
        sub={sub}
        meHandle={me?.handle}
        meName={me?.name}
      />

      <AddPlace subSlug={sub} subName={subName} signedIn={signedIn} dishNames={dishNames} />
    </>
  );
}
