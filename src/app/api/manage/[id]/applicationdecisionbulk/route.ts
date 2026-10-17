import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import { botDashboardPost, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

/**
 * Approve or deny several submissions with one shared reason. The bot runs each
 * through the normal decision flow (roles, DM, audit, automations) and reports
 * per-submission failures.
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
    const ids = Array.isArray(body.ids)
      ? body.ids.map((value) => String(value)).filter(Boolean)
      : [];
    if (!ids.length) {
      return NextResponse.json(
        { message: "Select at least one response" },
        { status: 400 },
      );
    }
    const decision = String(body.decision || "");
    if (decision !== "approve" && decision !== "deny") {
      return NextResponse.json({ message: "Invalid decision" }, { status: 400 });
    }
    const response = await botDashboardPost(
      "dashboard_application_decision_bulk",
      { server: id },
      {
        user: session.user.id,
        ids,
        decision,
        reason: String(body.reason || "").slice(0, 1000),
      },
    );
    return relayBotResponse(response);
  }, context as never);
