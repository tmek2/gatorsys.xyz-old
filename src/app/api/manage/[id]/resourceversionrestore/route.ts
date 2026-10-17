import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import { botDashboardPost, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

/**
 * Rolls a document or spreadsheet back to an earlier save. The bot snapshots
 * the current state first (so a restore can be undone) and only content moves;
 * sharing and permissions are unchanged.
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
    const resource = String(body.resource || "");
    const version = String(body.version || "");
    if (!resource || !version) {
      return NextResponse.json(
        { message: "Missing resource or version" },
        { status: 400 },
      );
    }
    const response = await botDashboardPost(
      "dashboard_resource_version_restore",
      { server: id },
      { user: session.user.id, resource, version },
    );
    return relayBotResponse(response);
  }, context as never);
