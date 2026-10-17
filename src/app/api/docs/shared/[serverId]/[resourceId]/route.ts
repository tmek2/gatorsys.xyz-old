import { withAuth } from "@/utils/api-middleware";
import { botDashboardGet, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

type Params = { serverId: string; resourceId: string };

/**
 * Share-link endpoint for signed-in Discord users. The bot only returns
 * documents shared as "Anyone with the link" or ones the viewer belongs to;
 * passing the user lets spreadsheets and sibling navigation resolve for
 * members.
 */
export const GET = (_request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { serverId, resourceId } = await context.params;
    const response = await botDashboardGet("dashboard_deptdocument", {
      server: serverId,
      resource: resourceId,
      user: session.user.id,
    });
    return relayBotResponse(response);
  }, context as never);
