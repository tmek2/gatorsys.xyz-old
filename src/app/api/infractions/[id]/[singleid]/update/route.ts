import { NextResponse } from "next/server";
import { withAuth, makeApiRequest } from "@/utils/api-middleware";
import { deleteCached } from "@/utils/redis";
import { hasAdminPanelAccess } from "@/utils/discord-admin";


export const dynamic = "force-dynamic";

async function handleUpdate(
  request: Request,
  context: { params: Promise<{ id: string; singleid: string }> }
) {
  return withAuth(async (session, { params }) => {
    const { id, singleid } = await params;
    const body = await request.json();

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
      `${
        process.env.PROD_API_URL || "https://fdny-systems-production.up.railway.app"
      }/UpdateInfraction?auth=${
        process.env.API_AUTH
      }&server=${id}&id=${singleid}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    // Invalidate related caches
    await deleteCached(`infraction:${id}:${singleid}`, `infractions:${id}`);

    return NextResponse.json(data);
  }, context);
}

export const PUT = handleUpdate;
export const HEAD = handleUpdate;
export const OPTIONS = handleUpdate;
