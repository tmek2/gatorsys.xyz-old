import { withAuth } from "@/utils/api-middleware";
import { botDashboardGet, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

type Params = { parentId: string; departmentId: string };

export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { parentId, departmentId } = await context.params;
    const include = new URL(request.url).searchParams.get("include") || "";
    const response = await botDashboardGet("dashboard_departments", {
      server: parentId,
      user: session.user.id,
      department: departmentId,
      include,
    });
    return relayBotResponse(response);
  }, context as never);
