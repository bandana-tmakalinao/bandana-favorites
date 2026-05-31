import Link from "next/link";
import { Avatar } from "@/components/bits";
import FollowButton from "@/components/FollowButton";
import type { UserCard } from "@/db/repo";

/**
 * The "Taste Résumé" card: identity → bio (the hook) → "Expert in" badges → "Go-to" #1 favorites.
 * Built to SELL the person — make you want to follow them. Server-rendered; the follow button is
 * the only client island. Each element collapses independently so a brand-new user shows a clean
 * header-only row.
 */
export default function UserList({
  users,
  signedIn,
  emptyText = "No one here yet.",
}: {
  users: UserCard[];
  signedIn: boolean;
  emptyText?: string;
}) {
  if (users.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-ink-dim)]">
        {emptyText}
      </p>
    );
  }
  return (
    <ul className="space-y-2.5">
      {users.map((u) => {
        const hasBody = !!u.bio || u.expertIn.length > 0 || u.goTos.length > 0;
        return (
          <li
            key={u.handle}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 transition hover:border-[var(--color-ink-dim)]"
          >
            {/* header — avatar · identity · follow */}
            <div className="flex items-start gap-3">
              <Link href={`/u/${u.handle}`} className="shrink-0">
                <Avatar url={u.avatarUrl} name={u.name} size={44} />
              </Link>
              <Link href={`/u/${u.handle}`} className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-semibold leading-tight">{u.name}</span>
                  {u.isCurator && (
                    <span className="shrink-0 text-xs text-[var(--color-good)]" title="Curator">
                      ✓
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-[var(--color-ink-dim)]">
                  @{u.handle}
                  {u.followerCount > 0 ? ` · ${u.followerCount} followers` : ""}
                </span>
              </Link>
              <FollowButton handle={u.handle} initialFollowing={u.followedByViewer} signedIn={signedIn} size="sm" />
            </div>

            {/* body — aligns under the name (44 avatar + 12 gap) */}
            {hasBody && (
              <div className="mt-2 space-y-2 pl-[56px]">
                {u.bio && <p className="line-clamp-1 text-xs leading-snug text-[var(--color-ink)]">{u.bio}</p>}

                {u.expertIn.length > 0 && (
                  <div className="flex flex-wrap gap-1" aria-label="Expert in">
                    {u.expertIn.map((e) => (
                      <span
                        key={e.subSlug}
                        className="inline-flex max-w-[10.5rem] items-center gap-1 rounded-full border border-[var(--color-brand)]/35 bg-[var(--color-brand)]/10 px-2 py-0.5 text-[11px] font-semibold leading-none text-[var(--color-brand-soft)]"
                      >
                        <span aria-hidden className="shrink-0">{e.emoji}</span>
                        <span className="truncate">{e.subName}</span>
                        {e.verified && (
                          <span aria-hidden className="shrink-0 text-[var(--color-gold)]" title="Curator-recognized expert">
                            ★
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {u.goTos.length > 0 && (
                  <div className="flex flex-col gap-0.5 text-[11px] leading-snug">
                    {u.goTos.map((g) => (
                      <span key={g.subSlug} className="flex min-w-0 items-baseline gap-1">
                        <span aria-hidden className="shrink-0">{g.emoji}</span>
                        <span className="shrink-0 font-black text-[var(--color-gold)]">#1</span>
                        <span className="min-w-0 truncate">
                          <span className="font-semibold text-[var(--color-ink)]">{g.title}</span>
                          <span className="text-[var(--color-ink-dim)]"> · {g.placeName}</span>
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
