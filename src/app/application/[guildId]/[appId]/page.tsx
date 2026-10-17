import { redirect } from "next/navigation";
import { formLink } from "@/utils/short-links";
import type { Metadata } from "next";
import { NO_INDEX } from "@/utils/no-index";

/** Customer content — see `NO_INDEX`. */
export const metadata: Metadata = { robots: NO_INDEX };

export const dynamic = "force-dynamic";

/**
 * The old application link, kept working: its last segment came from the
 * application's name, so it went stale on rename. No new ones are made;
 * existing ones redirect to the short link. A temporary (307) redirect, because
 * browsers cache a 308 indefinitely and a mistake in the target could not be
 * corrected.
 */
export default async function LegacyApplicationPage({
  params,
}: {
  params: Promise<{ guildId: string; appId: string }>;
}) {
  // `params` arrives already percent-decoded, so it is used as it is. Decoding
  // it a second time corrupted any id carrying a literal `%` or `+`.
  const { guildId, appId } = await params;
  redirect(formLink(guildId, appId));
}
