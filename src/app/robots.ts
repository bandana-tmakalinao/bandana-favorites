import type { MetadataRoute } from "next";

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
