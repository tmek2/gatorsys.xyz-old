import { withAuth } from "@/utils/api-middleware";
import { botDashboardGet, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

/** Resolve a join code into a department preview for the confirm screen. */
export const GET = (request: Request) =>
  withAuth(async (session) => {
    const code = new URL(request.url).searchParams.get("code") || "";
    const response = await botDashboardGet("dashboard_departmentjoinpreview", {
      code,
      user: String(session.user.id),
    });
    return relayBotResponse(response);
  });
