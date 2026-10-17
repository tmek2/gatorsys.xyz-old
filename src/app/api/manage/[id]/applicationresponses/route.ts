import { withAuth } from "@/utils/api-middleware";
import { botDashboardGet, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    const application = new URL(request.url).searchParams.get("application") || "";
    const response = await botDashboardGet("dashboard_application_responses", {
      server: id,
      user: session.user.id,
      application,
    });
    return relayBotResponse(response);
  }, context as never);
