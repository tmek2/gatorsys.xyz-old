import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import { botDashboardPost, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

/** Approve or deny an application submission from the Responses tab. Relays to
 *  the bot, which runs the same decision flow as the Discord review buttons. */
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
      "dashboard_application_decision",
      { server: id },
      { user: session.user.id, ...body }
    );
    return relayBotResponse(response);
  }, context as never);
