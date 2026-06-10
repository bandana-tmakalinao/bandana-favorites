import { getRepo } from "@/db/repo";
import { dishPath } from "@/lib/links";

/**
 * Legacy dish URLs: /c/<contender-id> → 301 to the canonical slug URL
 * (/nyc/[sub]/[dishSlug]). Every dish link minted before the SEO slug migration —
 * shared posters, old unfurls, bookmarks — lands here. Unknown ids get a soft
 * 302 to /explore rather than a dead 404.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getRepo().getContenderDetail(id);
  const dest = detail ? dishPath(detail.contender) : "/explore";
  // Behind Render's proxy req.url is http://localhost:10000/... — never derive the host from it.
  // Absolute via the canonical site URL when configured; a relative Location is spec-legal otherwise.
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  return new Response(null, {
    status: detail ? 301 : 302,
    headers: { Location: base ? new URL(dest, base).toString() : dest },
  });
}
