import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getRepo } from "@/db/repo";
import SignInForm from "@/components/SignInForm";
import ProfileEditor from "@/components/ProfileEditor";
import PinnacleManager from "@/components/PinnacleManager";
import { btn } from "@/components/bits";
import { isGoogleEnabled } from "@/lib/oauth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your profile · Bandana Faves" };

export default async function MePage() {
  const user = await getCurrentUser();
  const repo = getRepo();
  const profile = user ? repo.getProfile(user.handle) : null;
  const cats = repo
    .listCategories()
    .flatMap((g) => g.subcategories.map((s) => ({ slug: s.slug, name: s.name, emoji: s.emoji })));

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-black tracking-tight">Your profile</h1>
      <SignInForm signedInName={user?.name ?? null} googleEnabled={isGoogleEnabled()} />

      {user && (
        <>
          <Link href={`/u/${user.handle}`} className={btn("secondary")}>
            View your public profile →
          </Link>

          <section>
            <h2 className="mb-2 font-bold">Profile</h2>
            <ProfileEditor
              name={user.name}
              bio={user.bio ?? ""}
              avatarUrl={user.avatarUrl ?? null}
              showcase={user.showcase ?? []}
              cats={cats}
            />
          </section>

          <section>
            <h2 className="mb-2 font-bold">
              🏔️ Your Pinnacle{" "}
              <span className="text-sm font-medium text-[var(--color-ink-dim)]">· all-time NYC favorites</span>
            </h2>
            <PinnacleManager items={profile?.pinnacle ?? []} />
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-ink-dim)]">Trust score</span>
              <span className="font-semibold tabular-nums">{user.trustScore.toFixed(2)} / 1.00</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-[var(--color-ink-dim)]">Things you&apos;ve rated</span>
              <span className="font-semibold tabular-nums">{user.ratedCount}</span>
            </div>
            <p className="pt-2 text-xs text-[var(--color-ink-dim)]">
              Trust is earned — duel more, add photos that get verified, agree with the eventual consensus.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
