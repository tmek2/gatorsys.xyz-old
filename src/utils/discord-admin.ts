import type { DiscordGuild } from "@/types/discord";
import { fetchWithRetry } from "@/utils/api-helpers";
import { getDiscordAccessToken } from "@/utils/discord-session-token";
import { fetchMutualServersForSession } from "@/utils/mutual-servers";

const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);

export async function hasDiscordGuildAdminAccess(
  session: any,
  guildId: string
) {
  if (!session?.user?.id || !guildId) {
    return false;
  }
  const accessToken = await getDiscordAccessToken();
  if (!accessToken) {
    return false;
  }

  try {
    const guilds = await fetchWithRetry<DiscordGuild[]>(
      "https://discord.com/api/users/@me/guilds",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const guild = guilds.find((candidate) => candidate.id === guildId);
    if (!guild) {
      return false;
    }

    if (guild.owner) {
      return true;
    }

    const permissions = BigInt(guild.permissions || "0");
    return Boolean(permissions & (ADMINISTRATOR | MANAGE_GUILD));
  } catch (error) {
    console.error("Error checking Discord guild permissions:", error);
    return false;
  }
}

export async function hasAdminPanelAccess(session: any, guildId: string) {
  try {
    const { mutual } = await fetchMutualServersForSession(session);
    if (mutual.some((guild) => guild.id === guildId)) {
      return true;
    }
  } catch (error) {
    console.error("Error checking mutual server access:", error);
  }

  if (await hasDiscordGuildAdminAccess(session, guildId)) {
    return true;
  }

  try {
    const response = await fetch(
      `${process.env.PROD_API_URL || "https://fdny-systems-production.up.railway.app"}/permissions?auth=${encodeURIComponent(
        process.env.API_AUTH || ""
      )}&server=${encodeURIComponent(guildId)}&user=${encodeURIComponent(
        session.user.id
      )}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      return false;
    }

    const permissions = await response.json();
    // Staff count, not only admins. Who may add the bot is Discord's call (its
    // invite lists only guilds where you have Manage Server); who may open the
    // dashboard of a server the bot is already in is ours, and the bot applies
    // the same rule on every request behind this page.
    return permissions?.isAdmin === true || permissions?.isStaff === true;
  } catch (error) {
    console.error("Error checking backend permissions:", error);
    return false;
  }
}
