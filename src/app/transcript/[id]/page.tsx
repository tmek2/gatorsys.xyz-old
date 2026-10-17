import { auth } from "~/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import DiscordTranscript from "./transcript";
import { SiteNav } from "@/components/site/site-nav";
import { viewerFromSession } from "@/utils/viewer";
import "@/components/site/tokens.css";
import "@/components/site/landing.css";
import "../../panel/panel.css";
import UnauthorizedScreen from "@/components/unauthorised";
import { getSiteUrl } from "@/utils/site-url";
import type { Metadata } from "next";
import { NO_INDEX } from "@/utils/no-index";

/** Customer content — see `NO_INDEX`. */
export const metadata: Metadata = { robots: NO_INDEX };

async function GetTranscript(id: string) {
  const res = await fetch(`${getSiteUrl()}/api/transcript/${id}`, {
    headers: {
      Cookie: (await cookies()).toString(),
    },
  });
  if (!res.ok) {
    return 403;
  }

  const data = await res.json();

  return data;
}

export default async function Transcript({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/");

  let transcript;
  try {
    transcript = await GetTranscript((await params).id);
  } catch (error) {
    console.error(error);
    return <UnauthorizedScreen />;
  }
  if (transcript === 403) return <UnauthorizedScreen />;

  transcript.compact.reverse();

  return (
    <main className="g-root gs-panel">
      <SiteNav leading="back" backHref="/servers" float user={viewerFromSession(session)} />
      <div className="gs-panel-shell">
        <header className="gs-panel-head">
          <h1 className="gs-panel-title">Transcript</h1>
        </header>
        <DiscordTranscript transcript={transcript.compact} />
      </div>
    </main>
  );
}
