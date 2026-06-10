import type { MetadataRoute } from "next";
import { getRepo } from "@/db/repo";

/**
 * sitemap.xml — every public URL, straight from the live store. force-dynamic for the same
 * reason the ISR pages return [] from generateStaticParams: the data store only exists at
 * runtime, and a sitemap is exactly the kind of route Next would otherwise render at build.
 * Single file is fine — we're thousands of URLs under the 50k limit.
 */
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const { categories, dishes, places } = getRepo().listSitemapEntries();

  const statics: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, priority: 1.0, changeFrequency: "daily" },
    { url: `${SITE_URL}/nyc`, priority: 0.9, changeFrequency: "daily" },
    { url: `${SITE_URL}/explore`, priority: 0.9, changeFrequency: "daily" },
    { url: `${SITE_URL}/discover`, priority: 0.5, changeFrequency: "daily" },
  ];

  return [
    ...statics,
    ...categories.map((c) => ({
      url: `${SITE_URL}/nyc/${c.slug}`,
      priority: 0.9,
      changeFrequency: "daily" as const,
      ...(c.lastModified ? { lastModified: c.lastModified } : {}),
    })),
    ...dishes.map((d) => ({
      url: `${SITE_URL}/nyc/${d.subSlug}/${d.slug}`,
      priority: 0.7,
      changeFrequency: "weekly" as const,
    })),
    ...places.map((p) => ({
      url: `${SITE_URL}/p/${p.id}`,
      priority: 0.4,
      changeFrequency: "weekly" as const,
    })),
  ];
}
