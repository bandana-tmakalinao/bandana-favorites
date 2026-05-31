import Link from "next/link";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import { Avatar, ScoreBadge } from "@/components/bits";
import UserList from "@/components/UserList";
import { relativeTime } from "@/lib/relativeTime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your feed · Bandana Faves" };

export default async function FeedPage() {
  const me = await getCurrentUser();

  if (!me) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-3xl">🍽️</p>
        <h1 className="mt-3 text-xl font-black tracking-tight">Your feed</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-dim)]">
          Sign in and follow some tasters to see what they&apos;re ranking.
        </p>
        <Link
          href="/me?returnTo=/feed"
          className="mt-6 inline-block rounded-lg bg-[var(--color-brand)] px-5 py-2.5 font-semibold text-white transition hover:bg-[var(--color-brand-soft)]"
        >
          Sign in →
        </Link>
      </div>
    );
  }

  const repo = getRepo();
  const feed = repo.getFollowingFeed(me.id, 50);
  const suggestions = repo.suggestedFollows(me.id, 5);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-black tracking-tight">Your feed</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-dim)]">What the people you follow are ranking.</p>

      {feed.length === 0 ? (
        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
            <p className="text-2xl">👀</p>
            <p className="mt-1 font-bold">Quiet in here</p>
            <p className="mt-0.5 text-sm text-[var(--color-ink-dim)]">
              Follow a few tasters and their duels &amp; ratings show up here.
            </p>
          </div>
          {suggestions.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--color-brand)]">
                Suggested tasters
              </h2>
              <UserList users={suggestions} signedIn />
            </div>
          )}
          <Link href="/discover" className="block text-center text-sm font-semibold text-[var(--color-brand)] hover:underline">
            Explore discovery →
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {feed.map((f) => (
            <li
              key={f.id}
              className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
            >
              <Link href={`/u/${f.actor.handle}`} className="shrink-0">
                <Avatar url={f.actor.avatarUrl} name={f.actor.name} size={40} />
              </Link>
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-[var(--color-ink)]">
                  <Link href={`/u/${f.actor.handle}`} className="font-semibold hover:text-[var(--color-brand)]">
                    {f.actor.name}
                  </Link>{" "}
                  {f.kind === "duel" ? (
                    <>
                      picked{" "}
                      <Link href={`/c/${f.contenderId}`} className="font-medium hover:underline">
                        {f.dishTitle}
                      </Link>
                      {f.loserTitle ? <> over {f.loserTitle}</> : null}{" "}
                      in <Link href={`/nyc/${f.subSlug}`} className="text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]">{f.emoji} {f.subName}</Link>
                    </>
                  ) : (
                    <>
                      rated{" "}
                      <Link href={`/c/${f.contenderId}`} className="font-medium hover:underline">
                        {f.dishTitle}
                      </Link>{" "}
                      in <Link href={`/nyc/${f.subSlug}`} className="text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]">{f.emoji} {f.subName}</Link>
                    </>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-ink-dim)]">
                  {f.placeName} · {relativeTime(f.at)}
                </p>
              </div>
              {f.kind === "rating" && f.rating != null && <ScoreBadge score={f.rating} size="sm" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
