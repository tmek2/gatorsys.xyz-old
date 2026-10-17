import { redirect } from "next/navigation";
import { resourceLink } from "@/utils/short-links";
import type { Metadata } from "next";
import { NO_INDEX } from "@/utils/no-index";

/** Customer content — see `NO_INDEX`. */
export const metadata: Metadata = { robots: NO_INDEX };

export const dynamic = "force-dynamic";

/**
 * The old shared-document link: existing ones redirect to `/document/<slug>`.
 * Temporary (307), because a cached 308 cannot be corrected.
 */
export default async function LegacySharedDocumentPage({
  params,
}: {
  params: Promise<{ serverId: string; resourceId: string }>;
}) {
  const { serverId, resourceId } = await params;
  redirect(resourceLink("document", serverId, resourceId));
}
