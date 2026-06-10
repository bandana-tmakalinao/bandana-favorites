import Link from "next/link";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import { ScoreBadge } from "@/components/bits";
import UserList from "@/components/UserList";
import { dishPath } from "@/lib/links";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover · Bandana Faves" };

export default async function DiscoverPage() {
  const me = await getCurrentUser();
  const repo = getRepo();
  const tasters = repo.topTasters(me?.id, 10);
  const rising = repo.trendingRisers(12);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">Discover</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Find your people &amp; what&apos;s hot</h1>
      <p className="mt-1 text-[var(--color-ink-dim)]">Tasters to follow, and the dishes climbing fastest right now.</p>

      {/* Up & coming */}
      <section className="mt-8">
        <h2 className="mb-1 text-xl font-black tracking-tight">🔥 Up &amp; coming</h2>
        <p className="mb-4 text-sm text-[var(--color-ink-dim)]">Highest momentum across every food type.</p>
        {rising.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {rising.map((r) => (
              <Link
                key={r.id}
                href={dishPath(r)}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition hover:border-[var(--color-brand)]"
              >
                <span className="text-xl">{r.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.title}</span>
                  <span className="block truncate text-xs text-[var(--color-ink-dim)]">
                    {r.placeName} · {r.subName}
                    {r.standing === "unranked" ? " · unranked" : r.rank ? ` · #${r.rank}` : ""}
                  </span>
                </span>
                <ScoreBadge score={r.score} size="sm" standing={r.standing} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-ink-dim)]">
            Nothing trending yet — as people duel &amp; rate, the fastest risers show up here.
          </p>
        )}
      </section>

      {/* Top tasters */}
      <section className="mt-10">
        <h2 className="mb-1 text-xl font-black tracking-tight">⭐ Top tasters</h2>
        <p className="mb-4 text-sm text-[var(--color-ink-dim)]">The palates worth following — what they&apos;re known for, and their boldest calls.</p>
        <UserList users={tasters} signedIn={!!me} emptyText="No tasters to show yet." />
      </section>
    </div>
  );
}
