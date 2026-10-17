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

export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    const response = await botDashboardGet("dashboard_qotd", {
      server: id,
      user: session.user.id,
    });
    return relayBotResponse(response);
  }, context as never);

export const PATCH = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    let body: { set?: Record<string, unknown> };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    const response = await botDashboardPost(
      "dashboard_qotd",
      { server: id },
      { user: session.user.id, set: body.set || {} }
    );
    return relayBotResponse(response);
  }, context as never);
