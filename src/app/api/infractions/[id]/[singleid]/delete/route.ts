import { NextResponse } from "next/server";
import { withAuth, makeApiRequest } from "@/utils/api-middleware";
import { hasAdminPanelAccess } from "@/utils/discord-admin";
import { deleteCached } from "@/utils/redis";
import { botApiUrl } from "@/server/config";

interface DeleteInfractionParams {
  id: string;
  singleid: string;
}

export const dynamic = "force-dynamic";

async function handleDelete(
  request: Request,
  context: { params: Promise<DeleteInfractionParams> }
) {
  return withAuth(async (session) => {
    const { id, singleid } = await context.params;
    if (!id || !singleid) {
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
    
    await makeApiRequest(
      botApiUrl("delinfraction", { server: id, id: singleid }).toString(),
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );

    await deleteCached(
      `infraction:${id}:${singleid}`,
      `infractions:${id}`,
    );

    return NextResponse.json({ message: "Infraction deleted successfully" });
  });
}

export const DELETE = handleDelete;
