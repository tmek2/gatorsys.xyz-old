import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/utils/site-url";

/**
 * Only the site's own marketing pages are allowed; everything else is
 * disallowed. Transcripts, disciplinary records, documents, spreadsheets, forms
 * and shared docs are public by link on purpose but must not be indexed. Those
 * routes also set `robots: { index: false }` in their metadata (see
 * utils/no-index.ts), since robots.txt is only a request.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/servers", "/privacy", "/terms"],
        disallow: [
          "/api/",
          "/manage/",
          "/owner",
          "/account",
          "/auth/",
          // Customer content. See the note above.
          "/transcript/",
          "/panel/",
          "/document/",
          "/spreadsheet/",
          "/form/",
          "/application/",
          "/d/",
          "/docs/shared/",
          "/departments/",
          "/p/",
          "/verified",
        ],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
    host: getSiteUrl(),
  };
}
