import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import {
  botDashboardGet,
  botDashboardPost,
  relayBotResponse,
} from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

/** Open AI knowledge gaps for this server. */
export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    const response = await botDashboardGet("dashboard_aigaps", {
      server: id,
      user: session.user.id,
    });
    return relayBotResponse(response);
  }, context as never);

/** Answer or dismiss a gap. */
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
      "dashboard_aigaps",
      { server: id },
      { user: session.user.id, ...body },
    );
    return relayBotResponse(response);
  }, context as never);
