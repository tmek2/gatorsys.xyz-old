import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import { botDashboardPost, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

/** Delete an application submission (any status) from the Responses tab.
 *  App managers only — the bot enforces the same guard as the decision flow. */
export const POST = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    const response = await botDashboardPost(
      "dashboard_application_response_delete",
      { server: id },
      { user: session.user.id, ...body }
    );
    return relayBotResponse(response);
  }, context as never);
