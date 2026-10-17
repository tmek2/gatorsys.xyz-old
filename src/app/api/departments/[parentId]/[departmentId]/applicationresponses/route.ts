import { withAuth } from "@/utils/api-middleware";
import { botDashboardGet, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

type Params = { parentId: string; departmentId: string };

/** Submissions for one department application, readable by department
 *  resource managers from the member portal (no Manage Server needed). */
export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { parentId, departmentId } = await context.params;
    const application =
      new URL(request.url).searchParams.get("application") || "";
    const response = await botDashboardGet("dashboard_departmentappresponses", {
      server: parentId,
      user: session.user.id,
      department: departmentId,
      application,
    });
    return relayBotResponse(response);
  }, context as never);
