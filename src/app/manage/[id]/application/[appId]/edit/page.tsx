import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Deep link to an application in the dashboard's Forms & Applications section.
 */
export default async function ApplicationEditRedirect({
  params,
}: {
  params: Promise<{ id: string; appId: string }>;
}) {
  const { id, appId } = await params;
  redirect(`/manage/${id}/resources?app=${encodeURIComponent(appId)}`);
}
