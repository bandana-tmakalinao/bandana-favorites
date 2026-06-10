import Link from "next/link";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import { isModerator } from "@/lib/moderation";
import ReviewQueue from "@/components/ReviewQueue";

export const dynamic = "force-dynamic";

export const metadata = { title: "Review queue", robots: { index: false, follow: true } };

export default async function ReviewPage() {
  const user = await getCurrentUser();

  // Moderators only — community suggestions are approved by mods, not everyone.
  if (!isModerator(user)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-3xl">🔒</p>
        <h1 className="mt-3 text-xl font-black tracking-tight">Moderators only</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-dim)]">
          The review queue is limited to Bandana Faves moderators.
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

  const proposed = getRepo().listProposed();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 flex items-center gap-2 text-sm text-[var(--color-ink-dim)]">
        <Link href="/admin" className="hover:text-[var(--color-ink)]">
          Admin
        </Link>
        <span>/</span>
        <span>Review</span>
      </div>
      <h1 className="text-2xl font-black tracking-tight">Review queue</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-dim)]">
        Community-suggested places awaiting approval. {proposed.length} pending.
      </p>
      <div className="mt-6">
        <ReviewQueue />
      </div>
    </div>
  );
}
