import { NextResponse } from "next/server";
import { withAuth, makeApiRequest } from "@/utils/api-middleware";
import { hasAdminPanelAccess } from "@/utils/discord-admin";
import { botApiUrl } from "@/server/config";

export const dynamic = "force-dynamic";

// Params are a promise in this version of Next: read synchronously they only
// worked through a compatibility shim that warns and is going away.
export const GET = (request: Request, context: { params: Promise<{ id: string }> }) =>
  withAuth(async (session, { params }) => {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { message: "Server ID is required" },
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
      botApiUrl("infractions", { server: id }).toString(),
      {
        method: "GET" ,
        headers: { "Content-Type": "application/json" }
      }
    );

    return NextResponse.json(data);
  }, context);
