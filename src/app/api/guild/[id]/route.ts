import { NextResponse } from "next/server";
import { withAuth, makeApiRequest } from "@/utils/api-middleware";
import { getCached, setCached } from "@/utils/redis";
import type { MutualGuildsResponse } from "@/types/discord";
import { botApiUrl } from "@/server/config";

interface GuildParams {
  id: string;
}
export const dynamic = "force-dynamic";

export const GET = (request: Request, context: { params: Promise<GuildParams> }) =>
  withAuth(async (session) => {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { message: "Guild ID is required" },
        { status: 400 }
      );
    }

    const cacheKey = `guild:${id}:${session.user.id}`;
    const cachedData = await getCached<{ mutualGuilds: string[] }>(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const mutualData = (await makeApiRequest(
      botApiUrl("mutual_servers").toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: session.user.id, guilds: [id] }),
      }
    )) as MutualGuildsResponse;

    const response = { mutualGuilds: mutualData.mutual || [] };
    await setCached(cacheKey, response, 900); // Cache for 15 minutes
    return NextResponse.json(response);
  });
