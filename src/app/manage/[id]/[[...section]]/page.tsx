import { auth } from "~/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ManageShell } from "@/components/Manage/manage-shell";
import { getDiscordSignInUrl } from "@/utils/discord-links";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
};

export default async function ManagePage({
  params,
}: {
  params: Promise<{ id: string; section?: string[] }>;
}) {
  const { id, section } = await params;
  const session = await auth();

  if (!session || session.user?.authError) {
    redirect(getDiscordSignInUrl(`/manage/${id}/overview`));
  }

  if (!section?.[0]) {
    redirect(`/manage/${id}/overview`);
  }

  /* No surface of its own: the shell paints itself, and its pane is the page's
     main landmark. */
  return <ManageShell guildId={id} initialPath={section.join("/")} />;
}
