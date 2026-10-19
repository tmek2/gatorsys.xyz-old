import { auth } from "~/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { InfractionTable } from "@/components/Admin/infraction-table";
import UnauthorizedScreen from "@/components/unauthorised";
import { StatusScreen } from "@/components/status-screen";
import { SiteNav } from "@/components/site/site-nav";
import { viewerFromSession } from "@/utils/viewer";
import { previewBotRequest } from "@/preview/server";
import { getDiscordSignInUrl } from "@/utils/discord-links";
import { NO_INDEX } from "@/utils/no-index";
import "@/components/site/tokens.css";
import "@/components/site/landing.css";
import "../panel.css";

/** Customer content: see `NO_INDEX`. */
export const metadata: Metadata = { robots: NO_INDEX };

async function getInfractions(id: string) {
  try {
    const res = await previewBotRequest("infractions", { server: id });
    if (res.status === 401 || res.status === 403) return 403;
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error("Error fetching infractions:", error);
    return null;
  }
}

/* A server's infractions, where the bot's "View all" button lands, on the
   landing's ground with the site header. */
export default async function InfractionManager({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    redirect(getDiscordSignInUrl(`/panel/${id}`));
  }

  const infractions = await getInfractions(id);
  if (infractions === 403) return <UnauthorizedScreen />;

  if (!infractions) {
    return (
      <StatusScreen
        title="This panel didn’t load"
        actions={[
          { label: "Try again", href: `/panel/${id}` },
          { label: "Your servers", href: "/servers" },
        ]}
      >
        <p>The bot didn’t answer. It may be restarting; try again in a minute.</p>
      </StatusScreen>
    );
  }

  const list = Array.isArray(infractions) ? infractions : [];
  const active = list.filter((infraction: { status?: string }) => infraction.status === "active").length;

  return (
    <main className="g-root gs-panel">
      <SiteNav leading="back" backHref="/servers" float user={viewerFromSession(session)} />
      <div className="gs-panel-shell">
        <header className="gs-panel-head">
          <h1 className="gs-panel-title">Infractions</h1>
          <p className="gs-panel-sub">
            {list.length} case{list.length === 1 ? "" : "s"}
            {active ? ` · ${active} active` : ""}
          </p>
        </header>
        <InfractionTable initialInfractions={list} guildId={id} />
      </div>
    </main>
  );
}
