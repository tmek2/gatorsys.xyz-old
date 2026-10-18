import { auth } from "~/auth";
import { redirect } from "next/navigation";
import { getDiscordSignInUrl } from "@/utils/discord-links";
import { botDashboardGet } from "@/utils/manage-api";
import type { Metadata } from "next";
import { NO_INDEX } from "@/utils/no-index";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  // The link embed shows the department itself — name, logo, description —
  // not a generic Bot card.
  try {
    const response = await botDashboardGet("dashboard_departmentjoinpreview", {
      code,
      user: "0",
    });
    const data = response.ok ? await response.json() : {};
    const department = data.department || {};
    if (department.name) {
      const title = `Join ${department.name} | Bot`;
      const memberCount = Number(department.memberCount || 0);
      const description =
        department.description ||
        `${department.name}${department.serverName ? ` on ${department.serverName}` : ""} · ${memberCount} member${memberCount === 1 ? "" : "s"}. Confirm to join.`;
      return {
      // Discord's unfurler reads the OG tags and ignores `robots`, so link
      // previews keep working while search engines skip the page. See
      // `NO_INDEX`.
      robots: NO_INDEX,
        title: "Bot",
        description,
        openGraph: {
          title,
          description,
          type: "website",
          images: department.logo_url ? [department.logo_url] : undefined,
        },
        twitter: {
          card: "summary",
          title,
          description,
          images: department.logo_url ? [department.logo_url] : undefined,
        },
      };
    }
  } catch {
    /* fall through to the generic embed */
  }
  const title = "Join a department | Bot";
  const description = `Open this Bot department invitation and confirm where you are joining. Invite code: ${code.toUpperCase()}.`;
  return {
    title: "Bot",
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

/**
 * Join-link deep link (/departments/join/CODE): signed-in members land on the
 * dashboard, where the join confirmation opens over their servers.
 */
export default async function JoinWithCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await auth();
  if (!session || session.user?.authError) {
    redirect(getDiscordSignInUrl(`/departments/join/${code}`));
  }
  redirect(`/servers?join=${encodeURIComponent(code)}`);
}
