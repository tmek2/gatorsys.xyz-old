import { withAuth } from "@/utils/api-middleware";
import { getDiscordAccessToken } from "@/utils/discord-session-token";
import { fetchMutualServersForSession } from "@/utils/mutual-servers";

export const dynamic = "force-dynamic";

const ADMINISTRATOR = BigInt(1 << 3);
const MANAGE_GUILD = BigInt(1 << 5);

export const GET = (request: Request) =>
  withAuth(async (session) => {
    const accessToken = await getDiscordAccessToken();
    if (!accessToken) {
      return Response.json({ guilds: [] }, { status: 401 });
    }
    const response = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return Response.json({ guilds: [] }, { status: response.status });
    const guilds = (await response.json()) as Array<{ id: string; name: string; icon: string | null; owner?: boolean; permissions?: string }>;
    const forceRefresh = new URL(request.url).searchParams.has("refresh");
    const mutualIds = new Set<string>();
    try {
      const mutual = await fetchMutualServersForSession(session, { forceRefresh });
      for (const guild of mutual.mutual || []) mutualIds.add(String(guild.id));
    } catch (error) {
      console.warn("Could not check Discord bot installation status", error);
    }
    return Response.json({
      guilds: guilds.filter((guild) => {
        const permissions = BigInt(guild.permissions || "0");
        return guild.owner || Boolean(permissions & ADMINISTRATOR) || Boolean(permissions & MANAGE_GUILD);
      }).map((guild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        iconUrl: guild.icon
          ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${guild.icon.startsWith("a_") ? "gif" : "png"}?size=128`
          : null,
        installed: mutualIds.has(guild.id),
      })),
    });
  });
