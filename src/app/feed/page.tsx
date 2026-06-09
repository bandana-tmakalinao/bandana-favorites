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
    // Signed-out: don't show a dead end — show what a feed IS (live risers + tasters worth
    // following) with the sign-in CTA on top.
    const repo = getRepo();
    const rising = repo.trendingRisers(4);
    const tasters = repo.topTasters(undefined, 4);
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="text-center">
          <p className="text-3xl">🍽️</p>
          <h1 className="mt-3 font-display text-2xl">Your feed</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-ink-dim)]">
            Follow a few tasters and this fills with what they&apos;re ranking — hot takes, new
            finds, and risers before they blow up.
          </p>
          <Link
            href="/me?returnTo=/feed"
            className="mt-5 inline-block rounded-lg bg-[var(--color-brand)] px-5 py-2.5 font-semibold text-white transition hover:bg-[var(--color-brand-soft)]"
          >
            Sign in →
          </Link>
        </div>

        {rising.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--color-brand)]">
              🔥 Climbing right now
            </h2>
            <ul className="space-y-2">
              {rising.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/c/${r.id}`}
                    className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition hover:border-[var(--color-brand)]"
                  >
                    <span className="text-xl">{r.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.title}</span>
                      <span className="block truncate text-xs text-[var(--color-ink-dim)]">
                        {r.placeName} · {r.subName}
                      </span>
                    </span>
                    <ScoreBadge score={r.score} size="sm" standing={r.standing} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tasters.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--color-brand)]">
              ⭐ Tasters worth following
            </h2>
            <ul className="space-y-2">
              {tasters.map((u) => (
                <li key={u.handle}>
                  <Link
                    href={`/u/${u.handle}`}
                    className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition hover:border-[var(--color-brand)]"
                  >
                    <Avatar url={u.avatarUrl} name={u.name} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{u.name}</span>
                      <span className="block truncate text-xs text-[var(--color-ink-dim)]">
                        @{u.handle}
                        {u.expertIn.length > 0 && ` · ${u.expertIn.map((e) => e.emoji).join(" ")}`}
                      </span>
                    </span>
                    <span className="text-xs text-[var(--color-ink-dim)]">{u.followerCount} followers</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-center text-sm">
              <Link href="/discover" className="font-semibold text-[var(--color-brand)] hover:underline">
                See everyone on Discover →
              </Link>
            </p>
          </section>
        )}
      </div>
    );
  }

  const repo = getRepo();
  const feed = repo.getFollowingFeed(me.id, 50);
  const suggestions = repo.suggestedFollows(me.id, 5);
  const tryThese = repo.getTryThese(me.id, 6);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-black tracking-tight">Your feed</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-dim)]">What the people you follow are ranking.</p>

      {tryThese.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-[var(--color-brand)]">Worth a try</h2>
          <p className="mb-3 text-xs text-[var(--color-ink-dim)]">
            Dishes on the rise — and a few editors&apos; picks — you haven&apos;t ranked yet.
          </p>
          <ul className="space-y-2">
            {tryThese.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/c/${r.id}`}
                  className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition hover:border-[var(--color-brand)]"
                >
                  <ScoreBadge score={r.score} size="sm" standing={r.standing} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.title}</span>
                    <span className="block truncate text-xs text-[var(--color-ink-dim)]">
                      {r.placeName} · {r.emoji} {r.subName}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      r.reason === "rising"
                        ? "bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                        : "bg-[var(--color-surface-2)] text-[var(--color-ink-dim)]"
                    }`}
                  >
                    {r.reason === "rising" ? "On the rise" : "Editors' pick"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {feed.length === 0 ? (
        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
            <p className="text-2xl">👀</p>
            <p className="mt-1 font-bold">Quiet in here</p>
            <p className="mt-0.5 text-sm text-[var(--color-ink-dim)]">
              Follow a few tasters and their duels show up here.
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
