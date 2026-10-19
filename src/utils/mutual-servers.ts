import type { MutualGuildsResponse } from "@/types/discord";
import { previewBotRequest } from "@/preview/server";
import { PREVIEW_SESSION as previewSession } from "@/preview/identity";

// Kept for the existing page error boundaries; preview reads never need OAuth.
export class DiscordAuthExpiredError extends Error {}
export class BotUnreachableError extends Error {}
export class BotAuthenticationError extends Error {}

export async function invalidateMutualServers(_userId: string): Promise<void> {}

export async function fetchMutualServersForSession(
  _session: unknown,
  _options: { forceRefresh?: boolean } = {},
): Promise<MutualGuildsResponse> {
  const response = await previewBotRequest("mutual_servers", { user: previewSession.user.id });
  if (!response.ok) throw new BotUnreachableError("Could not load preview communities");
  return response.json();
}
