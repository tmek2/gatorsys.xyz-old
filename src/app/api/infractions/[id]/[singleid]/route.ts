import { NextResponse } from "next/server";
import { withAuth, makeApiRequest } from "@/utils/api-middleware";
import { getCached, setCached } from "@/utils/redis";
import type { InfractionResponse } from "@/types/discord";
import { hasAdminPanelAccess } from "@/utils/discord-admin";
import { botApiUrl } from "@/server/config";

interface SingleInfractionParams {
  id: string;
  singleid: string;
}

export const dynamic = "force-dynamic";

export const GET = (
  request: Request,
  context: { params: Promise<SingleInfractionParams> }
) =>
  withAuth(async (session) => {
    const { id, singleid } = await context.params;
    if (!id || !singleid) {
      return NextResponse.json(
        { message: "Missing required parameters" },
        { status: 400 }
      );
    }

    if (!(await hasAdminPanelAccess(session, id))) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    // The payload is shared by authorized staff; access is checked before cache.
    const cacheKey = `infraction:${id}:${singleid}`;
    const cachedData = await getCached<InfractionResponse>(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }
    const data = (await makeApiRequest(
      botApiUrl("infraction", { server: id, id: singleid }).toString(),
    )) as InfractionResponse;

    await setCached(cacheKey, data, 300);
    return NextResponse.json(data);
  });
