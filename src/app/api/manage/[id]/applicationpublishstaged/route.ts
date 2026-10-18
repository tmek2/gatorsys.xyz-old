import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import { botDashboardPost, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

/**
 * Releases every staged decision for one application. Staging records a verdict
 * without acting (no DM, no roles); this replays each through the bot's normal
 * decision path.
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
    const response = await botDashboardPost(
      "dashboard_application_publish_staged",
      { server: id },
      { ...body, user: session.user.id }
    );
    return relayBotResponse(response);
  }, context as never);
