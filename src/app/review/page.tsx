import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import ReviewQueue from "@/components/ReviewQueue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Curator review · Bandana Faves" };

export default async function ReviewPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-black tracking-tight">Curator review</h1>
      <p className="mt-1 text-[var(--color-ink-dim)]">
        Approve or reject user-suggested places before they&apos;re ranked.
      </p>
      <p className="mt-1 text-xs text-[var(--color-ink-dim)]">
        Preview: open to any signed-in user. In production this is gated on a curator role.
      </p>

      <div className="mt-6">
        {user ? (
          <ReviewQueue />
        ) : (
          <p className="text-[var(--color-ink-dim)]">
            <Link href="/me" className="font-semibold text-[var(--color-brand)] hover:underline">
              Sign in
            </Link>{" "}
            to review.
          </p>
        )}
      </div>
    </div>
  );
}
