import Link from "next/link";
import HeaderAuth from "@/components/HeaderAuth";
import SearchBar from "@/components/SearchBar";

/**
 * The global header — a fully static server shell (NO cookies; reading them here would force
 * every page dynamic and kill ISR). The auth-aware corner (Feed/Admin/Profile vs Sign in)
 * hydrates client-side via <HeaderAuth /> from /api/me/context.
 */
export default function SiteHeader() {
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
          <Link href="/discover" className="hidden hover:text-[var(--color-ink)] sm:inline">
            Discover
          </Link>
          <Link href="/map" className="hidden hover:text-[var(--color-ink)] sm:inline">
            Map
          </Link>
          <HeaderAuth />
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
