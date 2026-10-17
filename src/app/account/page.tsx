import { redirect } from "next/navigation";
import { auth } from "~/auth";
import { SiteNav } from "@/components/site/site-nav";
import { isLive, viewerFromSession } from "@/utils/viewer";
import { SiteFooter } from "@/components/site/site-footer";
import { Suspense } from "react";
import { AccountOverview } from "@/components/account/account-overview";
import {
  AccountServers,
  AccountServersLoading,
} from "@/components/account/account-servers";
import { DotField } from "@/components/site/dot-field";
import { fetchMutualServersForSession } from "@/utils/mutual-servers";
import "@/components/site/tokens.css";
import "@/components/site/astryx-theme.css";
import "@/components/site/landing.css";
import "./account.css";
import { SITE_NAME } from "@/config/site";

export const dynamic = "force-dynamic";

export const metadata = {
  /* The tab title is just the site name (no page suffixes, per app/layout.tsx);
     the description is this page's own, for search results and link previews. */
  title: SITE_NAME,
  description: "Your account, connected services, and the servers you manage.",
};

/**
 * `/account`: the signed-in Discord identity, the linked Roblox account, and
 * the servers this account can reach, in one place.
 */
export default async function AccountPage() {
  const session = await auth();
  /* Requires a live session: one whose Discord tokens went stale still has an
     id but would show an empty server list. `isLive` is what /manage checks
     too. */
  if (!session?.user?.id || !isLive(session)) {
    redirect(`/auth/discord?callbackUrl=${encodeURIComponent("/account")}`);
  }

  return (
    <main className="g-root account-page" data-astryx-theme="neutral">
      {/* The same pointer-reactive dot field as the landing and the picker. */}
      <DotField className="account-field" />

      {/* The site header, with a back button where the mark sits. */}
      <SiteNav
        leading="back"
        backHref="/"
        float
        user={viewerFromSession(session)}
      />
      <div className="account-shell">
        <AccountOverview
          user={{
            id: String(session.user.id),
            name: session.user.name || "Discord user",
            image: session.user.image || null,
          }}
          /* Only the server list waits on the bot, behind its own Suspense
             boundary. Everything else is already available (name, avatar and id
             from the session; Roblox fetched on the client), so the page draws
             immediately instead of waiting out the bot call's 4 to 6 second
             deadline. */
          serversSlot={
            <Suspense fallback={<AccountServersLoading />}>
              <MyServers session={session} />
            </Suspense>
          }
        />
        <SiteFooter />
      </div>
    </main>
  );
}

/** The servers sheet's data, awaited inside the boundary rather than above it. */
async function MyServers({ session }: { session: any }) {
  const result = await fetchMutualServersForSession(session)
    .then((value) => ({ ...value, failed: false }))
    .catch(() => ({
      failed: true,
      mutual: [] as { id: string; name: string; icon: string | null }[],
    }));
  return (
    <AccountServers
      failed={result.failed}
      servers={result.mutual.map((guild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon ?? null,
      }))}
    />
  );
}
