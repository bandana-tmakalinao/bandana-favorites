import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import { Avatar, ScoreBadge, btn } from "@/components/bits";
import ShareButton from "@/components/ShareButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return { title: `@${handle} · Bandana Faves` };
}

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = getRepo().getProfile(handle);
  if (!profile) notFound();
  const me = await getCurrentUser();
  const isYou = me?.handle === handle;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-start gap-4">
        <Avatar url={profile.avatarUrl} name={profile.name} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black tracking-tight">{profile.name}</h1>
          <p className="text-sm text-[var(--color-ink-dim)]">
            @{profile.handle} · trust {profile.trustScore.toFixed(2)} · {profile.ratedCount} rated
          </p>
          {profile.bio && <p className="mt-2 text-[var(--color-ink)]">{profile.bio}</p>}
        </div>
        {isYou && (
          <Link href="/me" className={btn("secondary")}>
            Edit
          </Link>
        )}
      </div>

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
                href={`/c/${p.contender.id}`}
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
                  href={`/c/${p.id}`}
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
                  <ScoreBadge score={p.score} size="sm" />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[var(--color-ink-dim)]">
            No favorites pinned yet.{isYou && " Open any dish and tap “Add to favorites.”"}
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
                  href={`/c/${v.id}`}
                  className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 transition hover:border-[var(--color-ink-dim)]"
                >
                  <span className="w-5 text-center text-sm font-bold text-[var(--color-ink-dim)]">{v.rank}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">{v.title}</span>{" "}
                    <span className="text-[var(--color-ink-dim)]">· {v.placeName}</span>
                  </span>
                  <ScoreBadge score={v.score} size="sm" />
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
