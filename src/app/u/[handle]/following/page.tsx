import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import UserList from "@/components/UserList";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return { title: `@${handle} is following`, robots: { index: false, follow: true } };
}

export default async function FollowingPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const me = await getCurrentUser();
  const repo = getRepo();
  const profile = repo.getProfile(handle, me?.id);
  if (!profile) notFound();
  const following = repo.getFollowing(handle, me?.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-1 flex items-center gap-2 text-sm text-[var(--color-ink-dim)]">
        <Link href={`/u/${handle}`} className="hover:text-[var(--color-ink)]">
          {profile.name}
        </Link>
        <span>/</span>
        <span>Following</span>
      </div>
      <h1 className="mb-4 text-2xl font-black tracking-tight">Following</h1>
      <UserList users={following} signedIn={!!me} emptyText={`@${handle} isn't following anyone yet.`} />
    </div>
  );
}
