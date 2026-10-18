import { auth } from "~/auth";
import { redirect } from "next/navigation";
import { ApplicationEditorPage } from "@/components/Manage/application-editor";
import { getDiscordSignInUrl } from "@/utils/discord-links";
import type { Metadata } from "next";
import { NO_INDEX } from "@/utils/no-index";

/** Customer content — see `NO_INDEX`. */
export const metadata: Metadata = { robots: NO_INDEX };

export const dynamic = "force-dynamic";

/**
 * Member-portal home of the application editor: the same editor as the
 * dashboard, saving through department-permission-gated endpoints so department
 * resource managers do not need Manage Server.
 */
export default async function PortalApplicationEditor({
  params,
}: {
  params: Promise<{ parentId: string; departmentId: string; appId: string }>;
}) {
  const { parentId, departmentId, appId } = await params;
  const session = await auth();

  if (!session?.user?.id || session.user.authError) {
    redirect(
      getDiscordSignInUrl(
        `/departments/${parentId}/${departmentId}/application/${appId}`,
      ),
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <ApplicationEditorPage
        guildId={parentId}
        viewerId={session.user.id}
        appId={appId}
        portalDepartmentId={departmentId}
      />
    </main>
  );
}
