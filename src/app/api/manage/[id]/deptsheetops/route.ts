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
    const response = await botDashboardGet("dashboard_deptsheetops", {
      server: id,
      user: session.user.id,
      resource: url.searchParams.get("resource") || "",
      since: url.searchParams.get("since") || "0",
      client: url.searchParams.get("client") || "",
      name: url.searchParams.get("name") || "",
    });
    return relayBotResponse(response);
  }, context as never);
