import { withAuth } from "@/utils/api-middleware";
import { botDashboardGet, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    const url = new URL(request.url);
    const department = url.searchParams.get("department");
    const include = url.searchParams.get("include");
    const response = await botDashboardGet("dashboard_departments", {
      server: id,
      user: session.user.id,
      ...(department ? { department } : {}),
      ...(include ? { include } : {}),
    });
    return relayBotResponse(response);
  }, context as never);
