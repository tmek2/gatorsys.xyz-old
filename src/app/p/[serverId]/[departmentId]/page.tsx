import type { Metadata } from "next";
import { PublicDepartmentClient } from "./public-client";
import { botDashboardGet } from "@/utils/manage-api";
import { auth } from "~/auth";
import { NO_INDEX } from "@/utils/no-index";
import { SITE_NAME } from "@/config/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; departmentId: string }>;
}): Promise<Metadata> {
  const { serverId, departmentId } = await params;
  try {
    const response = await botDashboardGet("dashboard_departmentpublic", {
      server: serverId,
      department: departmentId,
    });
    const data = response.ok ? await response.json() : {};
    const department = data.department || {};
    const title = `${department.name || "Department"} | Gator`;
    const description =
      department.description ||
      `View ${department.name || "this department"}, its ranks, public resources, and application link.`;
    return {
    // Discord's unfurler reads the OG tags and ignores `robots`, so link
    // previews keep working while search engines skip the page. See `NO_INDEX`.
    robots: NO_INDEX,
      title: "Gator",
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
  } catch {
    return {
    // Discord's unfurler reads the OG tags and ignores `robots`, so link
    // previews keep working while search engines skip the page. See `NO_INDEX`.
    robots: NO_INDEX,
      title: SITE_NAME,
      description: "View this department and apply to join through Gator.",
    };
  }
}

/** Opt-in public department page — recruitment-friendly, no sign-in. */
export default async function PublicDepartmentPage({
  params,
}: {
  params: Promise<{ serverId: string; departmentId: string }>;
}) {
  const values = await params;
  const session = await auth();
  return (
    <PublicDepartmentClient
      {...values}
      viewer={session?.user?.id ? {
        id: String(session.user.id),
        name: session.user.name || "Discord user",
        image: session.user.image,
      } : null}
    />
  );
}
