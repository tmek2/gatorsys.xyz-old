import { withAuth } from "@/utils/api-middleware";
import { botDashboardPost, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

type Params = { parentId: string; departmentId: string };

/**
 * Approve or deny a department application submission from the member portal:
 * the same decision flow as the server endpoint (roles, DM, audit, approval
 * finalisation), gated on the department's own permissions instead of Manage
 * Server.
 */
export const POST = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { parentId, departmentId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const response = await botDashboardPost(
      "dashboard_departmentappdecision",
      { server: parentId },
      {
        user: session.user.id,
        department: departmentId,
        id: body?.id,
        decision: body?.decision,
        reason: body?.reason,
      },
    );
    return relayBotResponse(response);
  }, context as never);
