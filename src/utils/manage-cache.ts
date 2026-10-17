import { bumpGeneration, readGeneration } from "@/utils/redis";

/**
 * Cache keys for the dashboard's two hot reads, `meta` and `config`. Per user,
 * because the bot decides per request whether this user may read the guild.
 * Both share one generation per guild, bumped by any write, so everyone's copy
 * is retired at once (meta carries module on/off state from the config, so a
 * config write makes both stale).
 */
const generationKey = (guildId: string) => `manage:gen:${guildId}`;

export function readManageGeneration(guildId: string): Promise<number> {
  return readGeneration(generationKey(guildId));
}

/** Call after any write to a guild's configuration. */
export function invalidateManageCache(guildId: string): Promise<void> {
  return bumpGeneration(generationKey(guildId));
}

export const manageMetaKey = (
  guildId: string,
  userId: string,
  generation: number,
  /**
   * Whether the response includes the member list: part of the key, or a people
   * picker would get the cached memberless copy.
   */
  withMembers = false,
) =>
  `manage:meta:v2:${guildId}:${generation}:${userId}${withMembers ? ":members" : ""}`;

export const manageConfigKey = (guildId: string, userId: string, generation: number) =>
  `manage:config:v2:${guildId}:${generation}:${userId}`;
