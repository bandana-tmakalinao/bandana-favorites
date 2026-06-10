import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import { Avatar, ScoreBadge, btn } from "@/components/bits";
import ShareButton from "@/components/ShareButton";
import FollowButton from "@/components/FollowButton";
import { dishPath } from "@/lib/links";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = getRepo().getProfile(handle);
  const title = profile ? `${profile.name} (@${handle})` : `@${handle}`;
  const description =
    profile && profile.pinnacle.length > 0
      ? `${profile.name.split(" ")[0]}'s all-time NYC favorites — #1: ${profile.pinnacle[0].title} at ${profile.pinnacle[0].placeName}.`
      : `${profile?.name ?? handle} on Bandana Faves — NYC food, ranked by duels.`;
  return {
    title,
    description,
    alternates: { canonical: `/u/${handle}` },
    openGraph: {
      title,
      description,
      images: [{ url: `/share/pinnacle/${handle}/image?og=1`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image" as const },
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const me = await getCurrentUser();
  const profile = getRepo().getProfile(handle, me?.id);
  if (!profile) notFound();
  const isYou = profile.isSelf;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10">
      {/* Hero — the brand poster gradient (same color field as the share posters) */}
      <div
        className="relative -mx-4 h-28 overflow-hidden sm:h-32"
        style={{ backgroundImage: "linear-gradient(150deg, #f59568 0%, #ed7f54 45%, #d9551f 100%)" }}
      >
        <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 left-10 h-44 w-44 rounded-full bg-white/[0.07]" />
      </div>
      <div className="-mt-12 flex items-end gap-4 sm:-mt-14">
        <span className="rounded-full ring-4 ring-[var(--color-bg)]">
          <Avatar url={profile.avatarUrl} name={profile.name} size={96} />
        </span>
        <div className="flex-1 pb-1">
          {isYou ? (
            <Link href="/me" className={`${btn("secondary")} float-right`}>
              Edit profile
            </Link>
          ) : (
            <span className="float-right">
              <FollowButton handle={profile.handle} initialFollowing={profile.followedByViewer} signedIn={!!me} />
            </span>
          )}
        </div>
      </div>

      <div className="mt-3">
        <h1 className="flex items-center gap-2 font-display text-2xl">
          {profile.name}
          {profile.isCurator && (
            <span className="rounded-full bg-[var(--color-good)]/15 px-2 py-0.5 text-xs font-bold text-[var(--color-good)]">
              ✓ Curator
            </span>
          )}
        </h1>
        <p className="text-sm text-[var(--color-ink-dim)]">@{profile.handle}</p>
        {profile.bio && <p className="mt-2 max-w-xl text-[var(--color-ink)]">{profile.bio}</p>}

        {/* Stat row — followers / following / rated / trust */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <Link href={`/u/${profile.handle}/followers`} className="hover:text-[var(--color-brand)]">
            <span className="font-black tabular-nums">{profile.followerCount}</span>{" "}
            <span className="text-[var(--color-ink-dim)]">followers</span>
          </Link>
          <Link href={`/u/${profile.handle}/following`} className="hover:text-[var(--color-brand)]">
            <span className="font-black tabular-nums">{profile.followingCount}</span>{" "}
            <span className="text-[var(--color-ink-dim)]">following</span>
          </Link>
          <span>
            <span className="font-black tabular-nums">{profile.ratedCount}</span>{" "}
            <span className="text-[var(--color-ink-dim)]">rated</span>
          </span>
          <span className="text-[var(--color-ink-dim)]">trust {profile.trustScore.toFixed(2)}</span>
        </div>
      </div>

      {/* Expert in — the ≤3 categories this person headlines (★ = curator-recognized) */}
      {profile.expertIn.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-dim)]">
            Expert in
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.expertIn.map((e) => (
              <Link
                key={e.subSlug}
                href={`/nyc/${e.subSlug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brand)]/40 bg-[var(--color-brand)]/10 px-3 py-1 text-sm font-semibold text-[var(--color-brand-soft)] transition hover:border-[var(--color-brand)]"
              >
                <span aria-hidden>{e.emoji}</span>
                {e.subName}
                {e.verified && (
                  <span aria-hidden className="text-[var(--color-gold)]" title="Curator-recognized expert">
                    ★
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 🥇 #1 Picks — the gold headline: your declared #1 in each showcased category */}
      {profile.topPicks.length > 0 ? (
        <section className="mt-7">
          <h2 className="mb-3 text-lg font-black tracking-tight">
            🥇 {profile.name.split(" ")[0]}&apos;s #1 Picks
          </h2>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {profile.topPicks.map((p) => (
              <Link
                key={p.subSlug}
                href={dishPath(p.contender)}
                className="group flex w-40 shrink-0 flex-col items-center gap-1.5 rounded-2xl border-2 border-[var(--color-gold)]/45 bg-gradient-to-b from-[#fdf4dd] to-[var(--color-surface)] p-4 text-center shadow-[0_4px_16px_-10px_rgba(224,169,60,0.7)] transition hover:-translate-y-0.5 hover:border-[var(--color-gold)] hover:shadow-[0_10px_24px_-10px_rgba(224,169,60,0.8)]"
              >
                <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-3xl shadow-[0_2px_8px_-2px_rgba(35,28,22,0.25)] ring-2 ring-[var(--color-gold)] transition-transform group-hover:scale-105">
                  {p.emoji}
                </span>
                <span className="mt-0.5 text-[11px] font-black uppercase tracking-wide text-[#b57e12]">
                  #1 {p.subName}
                </span>
                <span className="w-full truncate text-sm font-bold leading-tight">{p.contender.title}</span>
                <span className="w-full truncate text-xs text-[var(--color-ink-dim)]">
                  {p.contender.placeName}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        isYou && (
          <section className="mt-7 rounded-2xl border-2 border-dashed border-[var(--color-gold)]/50 bg-[#fdf4dd]/40 p-5 text-center">
            <p className="text-2xl">🥇</p>
            <p className="mt-1 font-bold">Show off your #1 Picks</p>
            <p className="mt-0.5 text-sm text-[var(--color-ink-dim)]">
              Pick categories in your{" "}
              <Link href="/me" className="font-semibold text-[var(--color-brand)] hover:underline">
                profile settings
              </Link>{" "}
              — your declared #1 in each lands here in gold.
            </p>
          </section>
        )
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">
            🏔️ The Pinnacle{" "}
            <span className="text-sm font-medium text-[var(--color-ink-dim)]">· all-time NYC favorites</span>
          </h2>
          {profile.pinnacle.length > 0 && (
            <ShareButton
              kind="pinnacle"
              id={profile.handle}
              title={`${profile.name.split(" ")[0]}'s top NYC dishes`}
              pageHref={`/u/${profile.handle}`}
              variant="ghost"
            />
          )}
        </div>
        {profile.pinnacle.length > 0 ? (
          <ol className="space-y-2">
            {profile.pinnacle.map((p, i) => (
              <li key={p.id}>
                <Link
                  href={dishPath(p)}
                  className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition hover:border-[var(--color-ink-dim)]"
                >
                  <span className="w-6 text-center text-lg font-black tabular-nums text-[var(--color-brand)]">
                    {i + 1}
                  </span>
                  <span className="text-xl">{p.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.title}</span>
                    <span className="block truncate text-sm text-[var(--color-ink-dim)]">
                      {p.placeName} · {p.subName}
                    </span>
                  </span>
                  <ScoreBadge score={p.score} size="sm" standing={p.standing} />
                </Link>
              </li>
            ))}
          </ol>
        ) : isYou ? (
          <Link
            href="/explore"
            className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-[var(--color-brand)]/30 px-6 py-8 text-center transition hover:border-[var(--color-brand)]/60 hover:bg-[var(--color-surface)]"
          >
            <span className="text-2xl">🏔️</span>
            <span className="font-bold">Build your Pinnacle</span>
            <span className="max-w-sm text-sm text-[var(--color-ink-dim)]">
              Your all-time NYC top 5 — open any dish and tap 🏔️ to pin it. It becomes a
              shareable poster.
            </span>
          </Link>
        ) : (
          <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-6 text-center text-sm text-[var(--color-ink-dim)]">
            {profile.name.split(" ")[0]} hasn&apos;t pinned any all-time favorites yet.
          </p>
        )}
      </section>

      {profile.showcase.map((s) => (
        <section key={s.subSlug} className="mt-8">
          <h2 className="mb-2 flex items-center justify-between text-lg font-black">
            <span>
              {s.emoji} {s.subName}
            </span>
            <Link href={`/nyc/${s.subSlug}`} className="text-sm font-medium text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]">
              see all →
            </Link>
          </h2>
          {s.items.length > 0 ? (
            <div className="space-y-2">
              {s.items.map((v) => (
                <Link
                  key={v.id}
                  href={dishPath(v)}
                  className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 transition hover:border-[var(--color-ink-dim)]"
                >
                  <span className="w-5 text-center text-sm font-bold text-[var(--color-ink-dim)]">{v.rank}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">{v.title}</span>{" "}
                    <span className="text-[var(--color-ink-dim)]">· {v.placeName}</span>
                  </span>
                  <ScoreBadge score={v.score} size="sm" standing={v.standing} />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-ink-dim)]">Nothing rated here yet.</p>
          )}
        </section>
      ))}

      {profile.showcase.length === 0 && isYou && (
        <p className="mt-8 text-sm text-[var(--color-ink-dim)]">
          Pick categories to showcase in your{" "}
          <Link href="/me" className="font-semibold text-[var(--color-brand)] hover:underline">
            profile settings
          </Link>
          .
        </p>
      )}
    </div>
  );
}
