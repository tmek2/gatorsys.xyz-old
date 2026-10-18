import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/utils/site-url";

/**
 * Only the site's own marketing pages. Every other route is behind a session or
 * is customer content, which robots.ts keeps out of search.
 */

export default function sitemap(): MetadataRoute.Sitemap {
  const BASE = getSiteUrl();
  const now = new Date();
  return [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/servers`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
