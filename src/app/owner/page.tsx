import { redirect } from "next/navigation";
import { auth } from "~/auth";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { DotField } from "@/components/site/dot-field";
import { OwnerPanel } from "@/components/owner-panel";
import { isLive, viewerFromSession } from "@/utils/viewer";
import "@/components/site/tokens.css";
import "@/components/site/landing.css";
import "./owner.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OwnerPage() {
  const session = await auth();
  // Requires a live session (one with stale Discord tokens still has an id),
  // like every other gated route.
  if (!session || !isLive(session)) redirect("/auth/discord?callbackUrl=/owner");

  return (
    <main className="g-root owner-page" data-astryx-theme="neutral">
      {/* The same pointer-reactive dot field as the other pages. */}
      <DotField className="owner-field" />
      <SiteNav
        leading="back"
        backHref="/servers"
        float
        user={viewerFromSession(session)}
      />
      <div className="owner-shell">
        <OwnerPanel />
        <SiteFooter />
      </div>
    </main>
  );
}
