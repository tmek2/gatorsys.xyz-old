import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import { botDashboardPost, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

/**
 * Runs one submission's answers through the authorship detector, only when a
 * reviewer asks. The bot stores the per-question result on the submission, so
 * reopening it shows the same flags without rescanning.
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
      "dashboard_application_ai_scan",
      { server: id },
      { ...body, user: session.user.id },
    );
    return relayBotResponse(response);
  }, context as never);
