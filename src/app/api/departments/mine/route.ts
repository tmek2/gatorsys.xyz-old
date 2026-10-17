import { withAuth } from "@/utils/api-middleware";
import { botDashboardGet, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

/** Every department the signed-in user belongs to, across all servers. */
export const GET = () =>
  withAuth(async (session) => {
    const response = await botDashboardGet("dashboard_mydepartments", {
      user: String(session.user.id),
    });
    return relayBotResponse(response);
  });
