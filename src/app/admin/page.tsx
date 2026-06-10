import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { isModerator } from "@/lib/moderation";
import { getRepo } from "@/db/repo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: true } };

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!isModerator(user)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-3xl">🔒</p>
        <h1 className="mt-3 text-xl font-black tracking-tight">Moderators only</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-dim)]">
          This area is limited to Bandana Faves moderators.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-[var(--color-brand)] px-5 py-2.5 font-semibold text-white transition hover:bg-[var(--color-brand-soft)]"
        >
          Back home
        </Link>
      </div>
    );
  }

  const repo = getRepo();
  const stats = repo.stats();
  const pending = repo.listProposed().length;
  const pubs = repo.publicationStats();

  const cards: { label: string; value: number | string }[] = [
    { label: "Pending review", value: pending },
    { label: "Ranked dishes", value: stats.contenders },
    { label: "Duels", value: stats.comparisons },
    { label: "Ratings", value: stats.votes },
    { label: "Food types", value: stats.subcategories },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">Admin</div>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Moderator panel</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-dim)]">
        Signed in as {user!.name} · {user!.email ?? user!.handle}
      </p>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <div className="text-2xl font-black tabular-nums tracking-tight">{c.value}</div>
            <div className="mt-0.5 text-xs text-[var(--color-ink-dim)]">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-8 space-y-3">
        <Link
          href="/review"
          className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition hover:border-[var(--color-brand)]"
        >
          <span>
            <span className="block font-bold">Review queue</span>
            <span className="block text-sm text-[var(--color-ink-dim)]">
              Approve or reject community-suggested places.
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            {pending > 0 && (
              <span className="rounded-full bg-[var(--color-brand)] px-2.5 py-1 text-xs font-bold text-white">
                {pending}
              </span>
            )}
            <span className="text-[var(--color-ink-dim)]">→</span>
          </span>
        </Link>

        <Link
          href="/admin/import"
          className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition hover:border-[var(--color-brand)]"
        >
          <span>
            <span className="block font-bold">Import a menu</span>
            <span className="block text-sm text-[var(--color-ink-dim)]">
              Bulk-add a restaurant&apos;s dishes (they start unranked).
            </span>
          </span>
          <span className="text-[var(--color-ink-dim)]">→</span>
        </Link>

        <Link
          href="/admin/publications"
          className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition hover:border-[var(--color-brand)]"
        >
          <span>
            <span className="block font-bold">Publications</span>
            <span className="block text-sm text-[var(--color-ink-dim)]">
              The editorial sources backing the rankings (50% of every score).
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-bold text-[var(--color-ink-dim)]">
              {pubs.length}
            </span>
            <span className="text-[var(--color-ink-dim)]">→</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
