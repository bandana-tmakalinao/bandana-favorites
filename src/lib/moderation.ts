import type { User } from "@/lib/types";

/**
 * Moderators / admins. A user is a moderator if either:
 *  - their account carries `isCurator` (curator-granted in the data), or
 *  - their email is in the `ADMIN_EMAILS` allowlist (comma-separated env var).
 *
 * The env allowlist is the load-bearing path for the founder account — it survives reseeds and
 * needs no DB edit. Set e.g. `ADMIN_EMAILS=tmakalinao@gmail.com` (production: on Render).
 */
const ADMIN_EMAILS: ReadonlySet<string> = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

export function isModerator(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.isCurator) return true;
  const email = user.email?.toLowerCase();
  return !!email && ADMIN_EMAILS.has(email);
}
