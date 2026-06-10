import { getRepo } from "@/db/repo";
import { dishPath } from "@/lib/links";

/**
 * Legacy dish URLs: /c/<contender-id> → 301 to the canonical slug URL
 * (/nyc/[sub]/[dishSlug]). Every dish link minted before the SEO slug migration —
 * shared posters, old unfurls, bookmarks — lands here. Unknown ids get a soft
 * 302 to /explore rather than a dead 404.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getRepo().getContenderDetail(id);
  const dest = detail ? dishPath(detail.contender) : "/explore";
  return new Response(null, {
    status: detail ? 301 : 302,
    headers: { Location: new URL(dest, req.url).toString() },
  });
}
