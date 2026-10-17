import { withAuth } from "@/utils/api-middleware";
import { botDashboardGet, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

/** One roster member's most recent application submission for a department. */
export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    const url = new URL(request.url);
    const department = url.searchParams.get("department") || "";
    const member = url.searchParams.get("member") || "";
    const response = await botDashboardGet("dashboard_membersubmission", {
      server: id,
      user: session.user.id,
      department,
      member,
    });
    return relayBotResponse(response);
  }, context as never);
