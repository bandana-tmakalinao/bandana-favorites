import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import PlaceFinder from "@/components/PlaceFinder";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add a favorite · Bandana Favorites" };

export default async function AddPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">Add a favorite</h1>
      <p className="mt-1 text-[var(--color-ink-dim)]">
        Start with the restaurant — then tell us what you had. Pick a real NYC spot below.
      </p>

      {!user && (
        <p className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-ink-dim)]">
          You can browse freely.{" "}
          <Link href="/me?returnTo=%2Fadd" className="font-semibold text-[var(--color-brand)] hover:underline">
            Sign in
          </Link>{" "}
          to log a dish — it takes a name and nothing else.
        </p>
      )}

      <div className="mt-6">
        <PlaceFinder />
      </div>

      <p className="mt-6 text-sm text-[var(--color-ink-dim)]">
        Looking for the best of a single food instead?{" "}
        <Link href="/nyc" className="font-semibold text-[var(--color-brand)] hover:underline">
          Browse by category →
        </Link>
      </p>
    </div>
  );
}
