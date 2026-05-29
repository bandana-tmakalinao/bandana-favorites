import { getCurrentUser } from "@/lib/auth";
import SignInForm from "@/components/SignInForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account · Bandana Favorites" };

export default async function MePage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-4 text-2xl font-black tracking-tight">Your account</h1>
      <SignInForm signedInName={user?.name ?? null} />

      {user && (
        <div className="mt-4 space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--color-ink-dim)]">Trust score</span>
            <span className="font-semibold tabular-nums">{user.trustScore.toFixed(2)} / 1.00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-ink-dim)]">Things you&apos;ve rated</span>
            <span className="font-semibold tabular-nums">{user.ratedCount}</span>
          </div>
          <p className="pt-2 text-xs text-[var(--color-ink-dim)]">
            Trust is earned: duel more, add photos that get verified, and agree with the eventual
            consensus, and your votes count for more. New accounts start near zero influence — that&apos;s
            the anti-Sybil floor.
          </p>
        </div>
      )}
    </div>
  );
}
