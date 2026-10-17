import { withAuth } from "@/utils/api-middleware";
import { botDashboardGet, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    const member = new URL(request.url).searchParams.get("member");
    const response = member
      ? await botDashboardGet("dashboard_staffmember", {
          server: id,
          user: session.user.id,
          member,
        })
      : await botDashboardGet("dashboard_staff", {
          server: id,
          user: session.user.id,
        });
    return relayBotResponse(response);
  }, context as never);
