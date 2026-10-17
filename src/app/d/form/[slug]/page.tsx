import { redirect, notFound } from "next/navigation";
import { decodeShortId } from "@/utils/short-links";
import type { Metadata } from "next";
import { NO_INDEX } from "@/utils/no-index";

/** Customer content — see `NO_INDEX`. */
export const metadata: Metadata = { robots: NO_INDEX };

export const dynamic = "force-dynamic";

/** `/d/form/<slug>` — a department application. */
export default async function ShortDepartmentFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const parts = decodeShortId(slug, 3);
  if (!parts) notFound();
  const [guildId, departmentId, appId] = parts;
  redirect(
    `/departments/${guildId}/${encodeURIComponent(departmentId)}/application/${encodeURIComponent(appId)}`,
  );
}
