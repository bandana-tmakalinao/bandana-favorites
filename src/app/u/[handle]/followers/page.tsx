import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/db/repo";
import { getCurrentUser } from "@/lib/auth";
import UserList from "@/components/UserList";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return { title: `@${handle}'s followers`, robots: { index: false, follow: true } };
}

export default async function FollowersPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const me = await getCurrentUser();
  const repo = getRepo();
  const profile = repo.getProfile(handle, me?.id);
  if (!profile) notFound();
  const followers = repo.getFollowers(handle, me?.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-1 flex items-center gap-2 text-sm text-[var(--color-ink-dim)]">
        <Link href={`/u/${handle}`} className="hover:text-[var(--color-ink)]">
          {profile.name}
        </Link>
        <span>/</span>
        <span>Followers</span>
      </div>
      <h1 className="mb-4 text-2xl font-black tracking-tight">Followers</h1>
      <UserList users={followers} signedIn={!!me} emptyText={`No one follows @${handle} yet.`} />
    </div>
  );
}
