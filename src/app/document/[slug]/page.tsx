import { auth } from "~/auth";
import { redirect, notFound } from "next/navigation";
import { getDiscordSignInUrl } from "@/utils/discord-links";
import { decodeShortId } from "@/utils/short-links";
import { SharedDocumentClient } from "../../docs/shared/[serverId]/[resourceId]/shared-client";
import type { Metadata } from "next";
import { NO_INDEX } from "@/utils/no-index";

/** Customer content — see `NO_INDEX`. */
export const metadata: Metadata = { robots: NO_INDEX };

export const dynamic = "force-dynamic";

/**
 * `/document/<slug>`: a shared document at a short link. The slug carries the
 * guild and resource, so it resolves with no database lookup. The old
 * `/docs/shared/<guild>/<resource>` shape redirects here.
 */
export default async function ShortDocumentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const parts = decodeShortId(slug, 2);
  if (!parts) notFound();
  const [serverId, resourceId] = parts;
  const session = await auth();
  if (!session || session.user?.authError) {
    redirect(getDiscordSignInUrl(`/document/${slug}`));
  }
  return <SharedDocumentClient serverId={serverId} resourceId={resourceId} />;
}
