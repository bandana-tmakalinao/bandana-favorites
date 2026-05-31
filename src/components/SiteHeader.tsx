import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { isModerator } from "@/lib/moderation";
import { Avatar } from "@/components/bits";
import SearchBar from "@/components/SearchBar";

/**
 * The global header. Auth-aware (reads the session cookie), so it renders once per request:
 *  - signed out → "Sign in"
 *  - signed in  → "Profile" (with avatar), no "Sign in"
 *  - moderators → an extra "Admin" link
 */
export default async function SiteHeader() {
  const user = await getCurrentUser();
  const mod = isModerator(user);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Bandana Faves" width={32} height={32} className="h-8 w-8 rounded-md" />
          <span className="tracking-tight">
            Bandana <span className="text-[var(--color-brand)]">Faves</span>
          </span>
        </Link>
        <span className="ml-1 hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-ink-dim)] sm:inline-block">
          NYC
        </span>
        <div className="mx-2 hidden flex-1 justify-center sm:flex">
          <SearchBar variant="header" />
        </div>
        <nav className="ml-auto flex items-center gap-3 text-sm text-[var(--color-ink-dim)] sm:ml-0 sm:gap-4">
          <Link href="/explore" className="-my-2 py-2 font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)]">
            Explore
          </Link>
          <Link href="/map" className="hidden hover:text-[var(--color-ink)] sm:inline">
            Map
          </Link>
          {mod && (
            <Link href="/admin" className="hidden font-medium text-[var(--color-brand)] hover:text-[var(--color-brand-soft)] sm:inline">
              Admin
            </Link>
          )}
          {user ? (
            <Link
              href="/me"
              className="-my-1 flex items-center gap-2 py-1 font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)]"
            >
              <Avatar url={user.avatarUrl ?? null} name={user.name} size={26} />
              <span className="hidden sm:inline">Profile</span>
            </Link>
          ) : (
            <Link href="/me" className="-my-2 py-2 hover:text-[var(--color-ink)]">
              Sign in
            </Link>
          )}
          <Link
            href="/nyc"
            aria-label="Rank food"
            className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 font-semibold text-white transition hover:bg-[var(--color-brand-soft)]"
          >
            <span className="sm:hidden">＋</span>
            <span className="hidden sm:inline">＋ Rank Food</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
