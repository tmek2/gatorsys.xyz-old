import { redirect } from "next/navigation";
import { auth } from "~/auth";
import { SiteNav } from "@/components/site/site-nav";
import { isLive, viewerFromSession } from "@/utils/viewer";
import { SiteFooter } from "@/components/site/site-footer";
import { RobloxAccountCard } from "@/components/roblox-account-card";
import { TidyUrl } from "@/components/tidy-url";
import { DotField } from "@/components/site/dot-field";
import "@/components/site/tokens.css";
import "@/components/site/astryx-theme.css";
import "@/components/site/landing.css";
import "../account.css";

export const dynamic = "force-dynamic";

export default async function RobloxAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl?.startsWith("/")
    ? params.callbackUrl
    : "/servers";
  if (!session?.user?.id || !isLive(session))
    redirect(
      `/auth/discord?callbackUrl=${encodeURIComponent(`/account/roblox?callbackUrl=${callbackUrl}`)}`,
    );
  return (
    <main
      className="g-root account-page min-h-screen text-[var(--g-ink)]"
      data-astryx-theme="neutral"
    >
      {/* Clears `?callbackUrl=…` from the address bar (it was read on the server
         already). */}
      <TidyUrl to="/account/roblox" />
      <DotField className="account-field" />
      {/* Same nav as /account, which this page is a sub-page of. */}
      <SiteNav
        leading="back"
        backHref="/account"
        className="g-nav-solid"
        user={viewerFromSession(session)}
      />
      <div className="account-shell">
        <div className="roblox-account-stack">
          <header className="roblox-page-head">
            <span>Account</span>
            <h1>Roblox</h1>
          </header>
          <RobloxAccountCard callbackUrl={callbackUrl} />
        </div>
        <SiteFooter />
      </div>
    </main>
  );
}
