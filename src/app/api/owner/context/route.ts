import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import {
  botDashboardGet,
  botDashboardPost,
  relayBotResponse,
} from "@/utils/manage-api";

export const dynamic = "force-dynamic";

/**
 * Global service notices. Owner only (the bot enforces it; this relays). While
 * a notice is live, every server's GatorAI leads with it.
 */
export const GET = (request: Request, context: unknown) =>
  withAuth(async (session) => {
    const response = await botDashboardGet("dashboard_globalcontext", {
      user: session.user.id,
    });
    return relayBotResponse(response);
  }, context as never);

export const POST = (request: Request, context: unknown) =>
  withAuth(async (session) => {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    const response = await botDashboardPost(
      "dashboard_globalcontext",
      {},
      { user: session.user.id, ...body },
    );
    return relayBotResponse(response);
  }, context as never);
