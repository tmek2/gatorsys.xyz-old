import { redirect, notFound } from "next/navigation";
import { decodeShortId } from "@/utils/short-links";
import type { Metadata } from "next";
import { NO_INDEX } from "@/utils/no-index";

/** Customer content — see `NO_INDEX`. */
export const metadata: Metadata = { robots: NO_INDEX };

export const dynamic = "force-dynamic";

/**
 * `/d/document/<slug>`: a department document. Same scheme as the server links,
 * under `/d/` because it carries the department id too.
 */
export default async function ShortDepartmentDocumentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const parts = decodeShortId(slug, 3);
  if (!parts) notFound();
  const [guildId, departmentId, resourceId] = parts;
  redirect(
    `/departments/${guildId}/${encodeURIComponent(departmentId)}/doc/${encodeURIComponent(resourceId)}`,
  );
}
