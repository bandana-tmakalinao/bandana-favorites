import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { isModerator } from "@/lib/moderation";
import { getRepo } from "@/db/repo";
import MenuImporter from "@/components/MenuImporter";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import menu · Admin · Bandana Faves" };

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!isModerator(user)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-3xl">🔒</p>
        <h1 className="mt-3 text-xl font-black tracking-tight">Moderators only</h1>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-[var(--color-brand)] px-5 py-2.5 font-semibold text-white">
          Back home
        </Link>
      </div>
    );
  }

  const cats = getRepo()
    .listCategories()
    .flatMap((g) => g.subcategories.map((s) => ({ slug: s.slug, name: s.name, emoji: s.emoji })));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 flex items-center gap-2 text-sm text-[var(--color-ink-dim)]">
        <Link href="/admin" className="hover:text-[var(--color-ink)]">
          Admin
        </Link>
        <span>/</span>
        <span>Import menu</span>
      </div>
      <h1 className="text-3xl font-black tracking-tight">Import a menu</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-dim)]">
        Bulk-add a restaurant&apos;s dishes. Everything lands <strong>unranked</strong> (score 0) and
        earns its way up through duels &amp; ratings — there&apos;s no imported rating. Dishes dedupe
        against what&apos;s already on the place.
      </p>

      <div className="mt-6">
        <MenuImporter cats={cats} />
      </div>
    </div>
  );
}
