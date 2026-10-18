import type { DiscordGuild } from "@/types/discord";
import { fetchWithRetry } from "@/utils/api-helpers";
import { getDiscordAccessToken } from "@/utils/discord-session-token";
import { botDashboardGet } from "@/utils/manage-api";

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

export async function hasAdminPanelAccess(
  session: { user?: { id?: string; authError?: unknown } } | null,
  guildId: string,
): Promise<boolean> {
  if (!session?.user?.id || session.user.authError || !guildId) return false;

  try {
    // A server listing can outlive a removed role. Legacy case endpoints do
    // not take an actor, so check the bot's current permissions before each call.
    const response = await botDashboardGet("permissions", {
      server: guildId,
      user: session.user.id,
    });
    if (!response.ok) return false;

    const permissions = await response.json();
    return permissions?.isAdmin === true || permissions?.isStaff === true;
  } catch (error) {
    console.error("Error checking backend permissions:", error);
    return false;
  }
}
