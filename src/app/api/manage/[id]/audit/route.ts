import { withAuth } from "@/utils/api-middleware";
import { botDashboardGet, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    const params = new URL(request.url).searchParams;
    const limit = params.get("limit") || "25";
    const kind = params.get("kind") === "commands" ? "commands" : "dashboard";
    const response = await botDashboardGet("dashboard_audit", {
      server: id,
      user: session.user.id,
      limit,
      kind,
    });
    return relayBotResponse(response);
  }, context as never);
