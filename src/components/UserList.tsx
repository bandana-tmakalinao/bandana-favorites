import Link from "next/link";
import { Avatar } from "@/components/bits";
import FollowButton from "@/components/FollowButton";
import type { UserCard } from "@/db/repo";

/** A list of user cards (followers / following / discovery) with inline follow buttons. */
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
    return <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-ink-dim)]">{emptyText}</p>;
  }
  return (
    <ul className="space-y-2">
      {users.map((u) => (
        <li
          key={u.handle}
          className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition hover:border-[var(--color-ink-dim)]"
        >
          <Link href={`/u/${u.handle}`} className="shrink-0">
            <Avatar url={u.avatarUrl} name={u.name} size={44} />
          </Link>
          <Link href={`/u/${u.handle}`} className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-semibold">{u.name}</span>
              {u.isCurator && <span className="text-xs text-[var(--color-good)]">✓</span>}
            </span>
            <span className="block truncate text-xs text-[var(--color-ink-dim)]">
              @{u.handle}
              {u.followerCount > 0 ? ` · ${u.followerCount} followers` : ""}
              {u.bio ? ` · ${u.bio}` : ""}
            </span>
          </Link>
          <FollowButton handle={u.handle} initialFollowing={u.followedByViewer} signedIn={signedIn} size="sm" />
        </li>
      ))}
    </ul>
  );
}
