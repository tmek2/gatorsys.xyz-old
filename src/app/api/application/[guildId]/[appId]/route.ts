import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import {
  botDashboardGet,
  botDashboardPost,
  relayBotResponse,
} from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  guildId: string;
  appId: string;
}

export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { guildId, appId } = await context.params;
    const response = await botDashboardGet("dashboard_application_public", {
      server: guildId,
      user: session.user.id,
      application: appId,
    });
    return relayBotResponse(response);
  }, context as never);

export const POST = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { guildId, appId } = await context.params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    const response = await botDashboardPost(
      "dashboard_application_submit",
      { server: guildId },
      {
        user: session.user.id,
        application: appId,
        answers: body.answers,
        // The form's authorship signals and the appeal's case id, forwarded to
        // the bot.
        integrity: body.integrity,
        caseId: body.caseId,
      },
    );
    if (!response.ok) {
      console.error("[application-submit] bot rejected submission", {
        guildId,
        appId,
        userId: session.user.id,
        status: response.status,
        detail: (await response.clone().text()).slice(0, 500),
      });
    }
    return relayBotResponse(response);
  }, context as never);
