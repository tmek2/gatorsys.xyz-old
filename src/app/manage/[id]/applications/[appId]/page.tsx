import { auth } from "~/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ApplicationEditorPage } from "@/components/Manage/application-editor";
import { getDiscordSignInUrl } from "@/utils/discord-links";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
};

export default async function ApplicationEditor({
  params,
}: {
  params: Promise<{ id: string; appId: string }>;
}) {
  const { id, appId } = await params;
  const session = await auth();

  if (!session || session.user?.authError) {
    redirect(getDiscordSignInUrl(`/manage/${id}/applications/${appId}`));
  }

  return (
    // `manage-root` declares the `--manage-*` tokens, so the page follows the
    // light theme.
    <main className="manage-root min-h-screen">
      <ApplicationEditorPage guildId={id} appId={appId} />
    </main>
  );
}
