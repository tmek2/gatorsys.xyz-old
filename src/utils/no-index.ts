import type { Metadata } from "next";

/**
 * Keeps a route out of search results. robots.ts asks crawlers not to fetch
 * these paths; this tells crawlers that fetch anyway not to index them (a URL
 * blocked only by robots.txt can still be listed from inbound links). Used on
 * every route showing customer-written content or conversations: transcripts,
 * infraction panels, shared documents, spreadsheets, forms and applications.
 */
export const NO_INDEX: Metadata["robots"] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false },
};
