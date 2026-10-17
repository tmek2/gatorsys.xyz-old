import { withAuth } from "@/utils/api-middleware";
import { botDashboardGet, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

/** Save history for one document or spreadsheet, newest first. Metadata only —
 *  the content of a version is only read when it is restored. */
export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    const resource = new URL(request.url).searchParams.get("resource") || "";
    const response = await botDashboardGet("dashboard_resource_versions", {
      server: id,
      user: session.user.id,
      resource,
    });
    return relayBotResponse(response);
  }, context as never);
