import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { isModerator } from "@/lib/moderation";
import { getRepo } from "@/db/repo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Publications · Admin · Bandana Faves" };

export default async function PublicationsPage() {
  const user = await getCurrentUser();
  if (!isModerator(user)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-3xl">🔒</p>
        <h1 className="mt-3 text-xl font-black tracking-tight">Moderators only</h1>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-[var(--color-brand)] px-5 py-2.5 font-semibold text-white">
          Back home
        </Link>
      </div>
    );
  }

  const pubs = getRepo().publicationStats();
  const totalCitations = pubs.reduce((n, p) => n + p.dishCount, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 flex items-center gap-2 text-sm text-[var(--color-ink-dim)]">
        <Link href="/admin" className="hover:text-[var(--color-ink)]">
          Admin
        </Link>
        <span>/</span>
        <span>Publications</span>
      </div>
      <h1 className="text-3xl font-black tracking-tight">Publications</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-dim)]">
        The editorial sources backing the rankings. Publications carry{" "}
        <span className="font-semibold text-[var(--color-ink)]">50%</span> of every dish&apos;s blended
        score; a source&apos;s <em>weight</em> sets how much it counts within that share.{" "}
        {pubs.length} sources · {totalCitations} citations.
      </p>

      <div className="mt-6 space-y-2">
        {pubs.map((p) => (
          <div
            key={p.name}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-bold">{p.name}</span>
                  {!p.recognized && (
                    <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-dim)]">
                      unrecognized
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-[var(--color-ink-dim)]">
                  {p.examples.map((e) => e.title).slice(0, 3).join(" · ")}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-right">
                <div>
                  <div className="text-lg font-black tabular-nums">{p.weight.toFixed(2)}</div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--color-ink-dim)]">weight</div>
                </div>
                <div>
                  <div className="text-lg font-black tabular-nums">{p.dishCount}</div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--color-ink-dim)]">dishes</div>
                </div>
              </div>
            </div>
            {/* weight bar */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
              <div
                className="h-full rounded-full bg-[var(--color-brand)]"
                style={{ width: `${Math.round(p.weight * 100)}%` }}
              />
            </div>
          </div>
        ))}
        {pubs.length === 0 && (
          <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-ink-dim)]">
            No publication-backed dishes yet.
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-[var(--color-ink-dim)]">
        Weights live in <code>src/lib/config.ts</code> (PUBLICATIONS). Unrecognized sources fall back to{" "}
        the default weight — add them to the registry to tune their influence.
      </p>
    </div>
  );
}
