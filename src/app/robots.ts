import type { MetadataRoute } from "next";

// Runtime, not build-time: the sitemap URL must always reflect the live NEXT_PUBLIC_SITE_URL
// (a static route would bake whatever the env was during `next build`).
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Crawl policy. NOTE: /search and /add are deliberately NOT disallowed here — they carry meta
 * noindex, and Google must be able to crawl a page to see it. robots.txt disallow is reserved
 * for pure-machinery routes with zero indexing ambiguity.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/share/", "/me", "/feed", "/review", "/duel"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
