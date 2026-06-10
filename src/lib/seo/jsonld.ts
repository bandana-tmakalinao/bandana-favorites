/**
 * schema.org builders — pure functions from repo view models to JSON-LD objects.
 *
 * Honesty policy (deliberate): NO aggregateRating anywhere. The 0–100 scores are
 * Bradley-Terry model outputs, not user star-ratings — presenting them as review
 * ratings would misrepresent the data and risks a structured-data manual action.
 * Rankings are expressed as ItemList (which is exactly what they are).
 */
import { dishPath } from "@/lib/links";
import type { ContenderView, RankedList } from "@/lib/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function webSiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Bandana Faves",
    url: SITE_URL,
    description: "The best food in NYC, ranked by the food — head-to-head duels, not star averages.",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Bandana Faves",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
  };
}

/** A category ranking as what it literally is: an ordered ItemList of dish pages. */
export function itemListLd(list: RankedList, max = 50) {
  const items = list.ranked.slice(0, max);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Best ${list.subcategory.name} in NYC`,
    description: `The best ${list.subcategory.name.toLowerCase()} in New York City, ranked by head-to-head comparisons.`,
    numberOfItems: list.ranked.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: items.map((v, i) => ({
      "@type": "ListItem",
      position: v.rank ?? i + 1,
      name: `${v.title} — ${v.placeName}`,
      url: `${SITE_URL}${dishPath(v)}`,
    })),
  };
}

export function breadcrumbLd(crumbs: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path}`,
    })),
  };
}

/** FAQPage markup — callers MUST render the same Q&As visibly on the page. */
export function faqLd(qas: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qas.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

/** A place page as a Restaurant — only real fields (address/geo/cuisines), no invented ratings. */
export function restaurantLd(
  place: { name: string; address: string; lat: number; lng: number },
  canonicalPath: string,
  cuisines: string[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: place.name,
    url: `${SITE_URL}${canonicalPath}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: place.address,
      addressLocality: "New York",
      addressRegion: "NY",
      addressCountry: "US",
    },
    geo: { "@type": "GeoCoordinates", latitude: place.lat, longitude: place.lng },
    ...(cuisines.length > 0 ? { servesCuisine: cuisines } : {}),
  };
}

/** One dish page as a breadcrumb trail (deliberately minimal — no Product/MenuItem claims). */
export function dishBreadcrumbLd(v: ContenderView, subName: string) {
  return breadcrumbLd([
    { name: "Bandana Faves", path: "/" },
    { name: "NYC food rankings", path: "/nyc" },
    { name: `Best ${subName} in NYC`, path: `/nyc/${v.subSlug}` },
    { name: `${v.title} — ${v.placeName}`, path: dishPath(v) },
  ]);
}
