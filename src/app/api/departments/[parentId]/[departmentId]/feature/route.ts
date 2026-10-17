import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import { botDashboardPost, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

type Params = { parentId: string; departmentId: string };

/** Member-portal save for department settings. The bot authorizes each key
 *  against the acting member's department rank permissions. */
export const POST = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { parentId, departmentId } = await context.params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    const response = await botDashboardPost(
      "dashboard_departmentfeature",
      { server: parentId },
      { ...body, department_id: departmentId, user: session.user.id },
    );
    return relayBotResponse(response);
  }, context as never);
