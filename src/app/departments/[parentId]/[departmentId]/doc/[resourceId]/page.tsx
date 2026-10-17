import { auth } from "~/auth";
import { redirect } from "next/navigation";
import { getDiscordSignInUrl } from "@/utils/discord-links";
import { DocumentViewerClient } from "./viewer-client";
import type { Metadata } from "next";
import { NO_INDEX } from "@/utils/no-index";

/** Customer content — see `NO_INDEX`. */
export const metadata: Metadata = { robots: NO_INDEX };

export const dynamic = "force-dynamic";

export default async function DepartmentDocumentPage({
  params,
}: {
  params: Promise<{
    parentId: string;
    departmentId: string;
    resourceId: string;
  }>;
}) {
  const values = await params;
  const session = await auth();
  if (!session || session.user?.authError) {
    redirect(
      getDiscordSignInUrl(
        `/departments/${values.parentId}/${values.departmentId}/doc/${values.resourceId}`,
      ),
    );
  }
  return <DocumentViewerClient {...values} />;
}
