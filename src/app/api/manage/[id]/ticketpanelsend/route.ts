import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import { botDashboardPost, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

/**
 * Posts a ticket panel into a channel. The bot builds the same view as in
 * Discord, so the posted button is the persistent one the ticket flow matches.
 */
export const POST = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    if (!body.name || !body.channel) {
      return NextResponse.json(
        { message: "Pick a panel and a channel" },
        { status: 400 },
      );
    }
    const response = await botDashboardPost(
      "dashboard_ticketpanelsend",
      { server: id },
      { user: session.user.id, ...body },
    );
    return relayBotResponse(response);
  }, context as never);
