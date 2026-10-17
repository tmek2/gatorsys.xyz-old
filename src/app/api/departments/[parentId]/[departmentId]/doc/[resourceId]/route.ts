import { withAuth } from "@/utils/api-middleware";
import { botDashboardGet, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

type Params = { parentId: string; departmentId: string; resourceId: string };

/** Department document for the signed-in viewer (members and admins; also
 *  honours "anyone with the link" sharing). */
export const GET = (_request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { parentId, resourceId } = await context.params;
    const response = await botDashboardGet("dashboard_deptdocument", {
      server: parentId,
      resource: resourceId,
      user: session.user.id,
    });
    return relayBotResponse(response);
  }, context as never);
