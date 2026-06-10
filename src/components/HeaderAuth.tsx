"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/bits";

type Me = {
  handle: string;
  name: string;
  avatarUrl: string | null;
  isCurator: boolean;
  isModerator: boolean;
};

/**
 * The auth-aware corner of the header, hydrated client-side from /api/me/context.
 * Keeping cookies OUT of the server-rendered header is what lets every public page be
 * cached/ISR — the shell is identical for everyone; this swaps in Feed/Admin/Profile.
 * While loading it reserves the "Sign in" footprint so nothing shifts (no CLS).
 */
export default function HeaderAuth() {
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    let on = true;
    fetch("/api/me/context")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => on && setMe(d?.user ?? null))
      .catch(() => on && setMe(null));
    return () => {
      on = false;
    };
  }, []);

  if (me === undefined) {
    return (
      <span className="-my-2 py-2 opacity-0" aria-hidden>
        Sign in
      </span>
    );
  }

  return (
    <>
      {me && (
        <Link href="/feed" className="hidden hover:text-[var(--color-ink)] sm:inline">
          Feed
        </Link>
      )}
      {me?.isModerator && (
        <Link
          href="/admin"
          className="hidden font-medium text-[var(--color-brand)] hover:text-[var(--color-brand-soft)] sm:inline"
        >
          Admin
        </Link>
      )}
      {me ? (
        <Link
          href="/me"
          className="-my-1 flex items-center gap-2 py-1 font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)]"
        >
          <Avatar url={me.avatarUrl} name={me.name} size={26} />
          <span className="hidden sm:inline">Profile</span>
        </Link>
      ) : (
        <Link href="/me" className="-my-2 py-2 hover:text-[var(--color-ink)]">
          Sign in
        </Link>
      )}
    </>
  );
}
