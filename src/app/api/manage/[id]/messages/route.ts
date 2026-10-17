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
    const type = new URL(request.url).searchParams.get("type");
    if (!type) {
      return NextResponse.json({ message: "Missing type" }, { status: 400 });
    }
    const response = await botDashboardGet("dashboard_messages", {
      server: id,
      user: session.user.id,
      type,
    });
    return relayBotResponse(response);
  }, context as never);

export const PUT = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    let body: { type?: string; data?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    if (!body.type) {
      return NextResponse.json({ message: "Missing type" }, { status: 400 });
    }
    const response = await botDashboardPost(
      "dashboard_messages",
      { server: id },
      { user: session.user.id, type: body.type, data: body.data ?? null }
    );
    return relayBotResponse(response);
  }, context as never);
