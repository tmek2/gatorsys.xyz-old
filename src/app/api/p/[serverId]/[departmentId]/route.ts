import { botDashboardGet, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

type Params = { serverId: string; departmentId: string };

/** Public department page data — no session required; the bot only answers
 *  for departments that opted in. */
export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const { serverId, departmentId } = await context.params;
  const response = await botDashboardGet("dashboard_departmentpublic", {
    server: serverId,
    department: departmentId,
  });
  return relayBotResponse(response);
}
