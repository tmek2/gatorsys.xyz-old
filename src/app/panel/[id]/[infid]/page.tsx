import { auth } from "~/auth";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { InfractionDetail } from "./infraction-detail";
import UnauthorizedScreen from "@/components/unauthorised";
import { SiteNav } from "@/components/site/site-nav";
import { viewerFromSession } from "@/utils/viewer";
import { previewBotRequest } from "@/preview/server";
import { getDiscordSignInUrl } from "@/utils/discord-links";
import { NO_INDEX } from "@/utils/no-index";
import "@/components/site/tokens.css";
import "@/components/site/landing.css";
import "../../panel.css";

/** Customer content: see `NO_INDEX`. */
export const metadata: Metadata = { robots: NO_INDEX };

async function getInfraction(guildId: string, infractionId: string) {
  const res = await previewBotRequest("infraction", { server: guildId, id: infractionId });
  if (!res.ok) {
    if (res.status === 403) return 403;
    if (res.status === 404) return notFound();
    throw new Error("This case couldn’t be loaded.");
  }
  return res.json();
}

export default async function InfractionPage({
  params,
}: {
  params: Promise<{ id: string; infid: string }>;
}) {
  const { id, infid } = await params;
  const session = await auth();
  if (!session) {
    redirect(getDiscordSignInUrl(`/panel/${id}/${infid}`));
  }

  const infraction = await getInfraction(id, infid);
  if (infraction === 403) return <UnauthorizedScreen />;
  if (!infraction) return notFound();

  return (
    <main className="g-root gs-panel">
      <SiteNav leading="back" backHref={`/panel/${id}`} float user={viewerFromSession(session)} />
      <InfractionDetail infraction={infraction} guildId={id} infractionId={infid} />
    </main>
  );
}
