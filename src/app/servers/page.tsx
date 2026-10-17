import { Suspense } from "react";
import { auth } from "~/auth";
import { redirect } from "next/navigation";
import { IconArrowRight, IconShieldLock } from "@tabler/icons-react";
import { SiteNav } from "@/components/site/site-nav";
import { viewerFromSession } from "@/utils/viewer";
import { DotField } from "@/components/site/dot-field";
import {
  BotAuthenticationError,
  BotUnreachableError,
  DiscordAuthExpiredError,
  fetchMutualServersForSession,
} from "@/utils/mutual-servers";
import { getDiscordSignInUrl } from "@/utils/discord-links";
import { ServersContent } from "@/components/servers-content";
import { ServersLoading } from "@/components/servers/servers-loading";
import { SiteFooter } from "@/components/site/site-footer";
import { OwnerBannerLink } from "@/components/servers/owner-banner-link";
import { getDiscordBotInviteUrl } from "@/utils/discord-links";
import { isBotOwner } from "@/utils/manage-api";
import "@/components/site/tokens.css";
import "@/components/site/astryx-theme.css";
import "@/components/site/landing.css";
import "./servers.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getMutualServers(session: any) {
  try {
    const { mutual, departments } = await fetchMutualServersForSession(session);
    return { servers: mutual, departments: departments || [], error: null };
  } catch (error) {
    console.error("Error fetching servers:", error);
    if (error instanceof DiscordAuthExpiredError) {
      // The Discord login went stale — a fresh sign-in fixes it immediately.
      redirect(getDiscordSignInUrl("/servers"));
    }
    return {
      servers: [],
      departments: [],
      error:
        error instanceof BotAuthenticationError
          ? "Gator's dashboard connection is unavailable right now. Please contact support if this continues."
          : error instanceof BotUnreachableError
          ? "Gator's bot is restarting or unreachable right now, so your servers can't be listed. It usually comes back within a minute. Refresh to try again."
          : "We couldn't load your Discord servers right now. Please try again later or contact support if this keeps happening.",
    };
  }
}

export default async function Servers() {
  const session = await auth();
  const inviteUrl = getDiscordBotInviteUrl();

  if (!session) {
    redirect("/auth/discord");
  }

  if (session.user?.authError) {
    redirect("/auth/discord?callbackUrl=/servers");
  }

  return (
    <main className="g-root servers-page min-h-screen" data-astryx-theme="neutral">
      {/* The site header with a back button where the mark sits. `float`: this
         is the longest scroll on the site, so the bar becomes a pill that
         follows you down. */}
      <SiteNav
        leading="back"
        backHref="/"
        float
        user={viewerFromSession(session)}
      />
      {/* The ground these sheets lie on, and it answers the pointer. Fixed, so
          it stays put while the page scrolls over it. */}
      <DotField className="servers-field" />
      <div className="servers-shell">
        <Suspense fallback={null}>
          <OwnerBanner userId={session.user?.id} />
        </Suspense>
        <Suspense fallback={<ServersLoading user={session.user} />}>
          <ServersData session={session} inviteUrl={inviteUrl} />
        </Suspense>
      </div>
      <SiteFooter />
    </main>
  );
}

async function ServersData({ session, inviteUrl }: { session: any; inviteUrl: string }) {
  const { servers, departments, error } = await getMutualServers(session);
  return (
    <ServersContent
      initialServers={servers}
      initialDepartments={departments}
      initialError={error}
      inviteUrl={inviteUrl}
      user={{
        id: String(session.user?.id || ""),
        image: session.user?.image,
        name: session.user?.name || "User",
      }}
    />
  );
}

/* Owner only: sized to its content, with the one rotating border on the page
   (it is the one thing not everybody has). */
async function OwnerBanner({ userId }: { userId?: string | null }) {
  if (!userId || !(await isBotOwner(userId))) return null;
  return (
    <OwnerBannerLink className="servers-owner-banner">
      <span className="servers-owner-mark">
        <IconShieldLock size={17} />
      </span>
      <span className="servers-owner-say">
        <span className="servers-owner-title">Manage bot</span>
        <span className="servers-owner-copy">
          Owner controls: every server, feature, and action
        </span>
      </span>
      <IconArrowRight size={16} className="servers-owner-go" />
    </OwnerBannerLink>
  );
}
