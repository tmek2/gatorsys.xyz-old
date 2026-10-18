import { NextResponse } from "next/server";
import { withAuth, makeApiRequest } from "@/utils/api-middleware";
import { deleteCached } from "@/utils/redis";
import { hasAdminPanelAccess } from "@/utils/discord-admin";
import { botApiUrl } from "@/server/config";


export const dynamic = "force-dynamic";

async function handleUpdate(
  request: Request,
  context: { params: Promise<{ id: string; singleid: string }> }
) {
  return withAuth(async (session) => {
    const { id, singleid } = await context.params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }

    if (!id || !singleid || !body) {
      return NextResponse.json(
        { message: "Missing required parameters" },
        { status: 400 }
      );
    }

    const canAccessPanel = await hasAdminPanelAccess(session, id);
    if (!canAccessPanel) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 403 }
      );
    }

    const data = await makeApiRequest(
      botApiUrl("UpdateInfraction", { server: id, id: singleid }).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    // Invalidate related caches
    await deleteCached(
      `infraction:${id}:${singleid}`,
      `infractions:${id}`,
    );

    return NextResponse.json(data);
  });
}

export const PUT = handleUpdate;
