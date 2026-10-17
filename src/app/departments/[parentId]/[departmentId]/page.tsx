import { auth } from "~/auth";
import { redirect } from "next/navigation";
import { getDiscordSignInUrl } from "@/utils/discord-links";
import { DepartmentMemberWorkspace } from "@/components/department-member-workspace";
import type { Metadata } from "next";
import { NO_INDEX } from "@/utils/no-index";

/** Customer content — see `NO_INDEX`. */
export const metadata: Metadata = { robots: NO_INDEX };

export const dynamic = "force-dynamic";

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ parentId: string; departmentId: string }>;
}) {
  const values = await params;
  const session = await auth();
  if (!session || session.user?.authError) {
    redirect(
      getDiscordSignInUrl(
        `/departments/${values.parentId}/${values.departmentId}`,
      ),
    );
  }
  return <DepartmentMemberWorkspace {...values} />;
}
