import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "~/auth";
import { getDiscordSignInUrl } from "@/utils/discord-links";
import { ServerResourceClient } from "./server-resource-client";
import { SITE_NAME } from "@/config/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  /* The tab title is just the site name (no page suffixes, per app/layout.tsx). */
  title: SITE_NAME,
};

export default async function ServerResourcePage({
  params,
}: {
  params: Promise<{ id: string; resourceId: string }>;
}) {
  const { id, resourceId } = await params;
  const session = await auth();

  if (!session || session.user?.authError) {
    redirect(
      getDiscordSignInUrl(`/manage/${id}/resources/${resourceId}`),
    );
  }

  // Same token as the rest of /manage — see the section page.
  return (
    <main className="min-h-screen bg-[var(--gator-canvas)] text-white">
      <ServerResourceClient
        guildId={id}
        resourceId={resourceId}
        viewer={{
          id: session.user?.id,
          name: session.user?.name,
        }}
      />
    </main>
  );
}
