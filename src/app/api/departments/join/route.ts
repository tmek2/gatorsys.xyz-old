import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import { botDashboardPost, relayBotResponse } from "@/utils/manage-api";
import { invalidateMutualServers } from "@/utils/mutual-servers";

export const dynamic = "force-dynamic";

export const POST = (request: Request) =>
  withAuth(async (session) => {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    const response = await botDashboardPost(
      "dashboard_departmentjoin",
      { server: "0" },
      { ...body, user: session.user.id },
    );
    if (response.ok) {
      await invalidateMutualServers(session.user.id);
    }
    return relayBotResponse(response);
  });
