import type {
  DiscordGuild,
  MutualGuild,
  MutualGuildsResponse,
} from "@/types/discord";
import { fetchWithRetry } from "@/utils/api-helpers";
import { getDiscordAccessToken } from "@/utils/discord-session-token";
import { deleteCached, getCached, setCached } from "@/utils/redis";
import { getBotApiConfig } from "@/server/config";

/** The signed-in user's Discord token is missing or expired — the fix is a
 *  fresh sign-in, not "try again later". */
export class DiscordAuthExpiredError extends Error {
  constructor() {
    super("Discord authorization expired");
    this.name = "DiscordAuthExpiredError";
  }
}

/** Discord answered but the bot API did not. */
export class BotUnreachableError extends Error {
  constructor(cause?: unknown) {
    super("Bot API unreachable");
    this.name = "BotUnreachableError";
    this.cause = cause;
  }
}

/** The website and bot disagree about the private dashboard credential. */
export class BotAuthenticationError extends Error {
  constructor() {
    super("Bot API authentication failed");
    this.name = "BotAuthenticationError";
  }
}

function mutualServerCacheKeys(userId: string) {
  // v5 includes the banner and splash used by server cards. Keep read and
  // invalidation keys together so a cache version change cannot split them.
  const fresh = `discord:servers_and_mutuals:v5:${userId}`;
  return { fresh, stale: `${fresh}:stale` };
}

export async function invalidateMutualServers(userId: string): Promise<void> {
  const { fresh, stale } = mutualServerCacheKeys(userId);
  await deleteCached(fresh, stale);
}

export async function fetchMutualServersForSession(
  session: any,
  options: { forceRefresh?: boolean } = {},
): Promise<MutualGuildsResponse> {
  return withDeadline(fetchMutualServers(session, options), 9_000);
}

async function withDeadline<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new BotUnreachableError(new Error("mutual server request timed out"))),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchMutualServers(
  session: any,
  options: { forceRefresh?: boolean },
): Promise<MutualGuildsResponse> {
  if (!session?.user?.id) {
    throw new DiscordAuthExpiredError();
  }
  const accessToken = await getDiscordAccessToken();
  if (!accessToken) {
    throw new DiscordAuthExpiredError();
  }

  const { fresh: cacheKey, stale: staleKey } = mutualServerCacheKeys(session.user.id);
  // A longer-lived "last known good" copy: after the 20-minute fresh cache
  // expires, the stale copy is served instantly and refreshed in the
  // background, so navigation never blocks on the Discord and bot round trip.

  // Does the actual Discord + bot fetch and writes both cache tiers.
  const runFetch = async (): Promise<MutualGuildsResponse> => {
    let userGuilds: DiscordGuild[];
    try {
      userGuilds = await fetchWithRetry<DiscordGuild[]>(
        "https://discord.com/api/users/@me/guilds",
        { headers: { Authorization: `Bearer ${accessToken}` } },
        2,
        { timeoutMs: 4_000, retryDelayMs: 250 },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/status: 40[13]/.test(message)) throw new DiscordAuthExpiredError();
      throw error;
    }

    const { baseUrl: apiUrl, auth: apiAuth } = getBotApiConfig();
    let mutualGuilds: MutualGuildsResponse;
    try {
      mutualGuilds = await fetchWithRetry<MutualGuildsResponse>(
        `${apiUrl}/mutual_servers?auth=${encodeURIComponent(apiAuth)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user: session.user.id,
            guilds: userGuilds.map((guild) => ({
              id: guild.id,
              owner: Boolean(guild.owner),
              permissions: String(guild.permissions || "0"),
            })),
          }),
        },
        1,
        { timeoutMs: 6_000 },
      );
    } catch (error) {
      if (error instanceof Error && /status: 40[13]/.test(error.message)) {
        throw new BotAuthenticationError();
      }
      throw new BotUnreachableError(error);
    }

    const response = {
      mutual: normalizeMutualGuilds(mutualGuilds?.mutual),
      departments: Array.isArray(mutualGuilds?.departments)
        ? mutualGuilds.departments
        : [],
    };
    await Promise.all([
      setCached(cacheKey, response, 1200),
      setCached(staleKey, response, 86_400),
    ]);
    return response;
  };

  if (!options.forceRefresh) {
    const fresh = await getCached<MutualGuildsResponse>(cacheKey);
    if (fresh) return fresh;

    const stale = await getCached<MutualGuildsResponse>(staleKey);
    if (stale) {
      // Serve the last known good result immediately and refresh behind it so
      // the next visit is fresh — the page never blocks on the slow path.
      void runFetch().catch(() => undefined);
      return stale;
    }
  }

  // First-ever load (or a forced refresh): this one has to wait.
  return runFetch();
}

/** A count the card can print, or undefined so the card omits the stat rather
 *  than showing a confident "0 members". */
function countOf(value: unknown): number | undefined {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }
  return Math.round(parsed);
}

/** Roles and channels arrive as arrays; the card only wants how many. */
function lengthOf(value: unknown): number | undefined {
  return Array.isArray(value) ? value.length : undefined;
}

function normalizeMutualGuilds(guilds: unknown): MutualGuild[] {
  if (!Array.isArray(guilds)) {
    return [];
  }

  return guilds
    .map((guild): MutualGuild | null => {
      if (typeof guild === "string") {
        return { id: guild, name: guild, icon: null };
      }

      if (!guild || typeof guild !== "object") {
        return null;
      }

      const partialGuild = guild as Partial<MutualGuild> & {
        membercount?: unknown;
        modulecount?: unknown;
        roles?: unknown;
        channels?: unknown;
        isAdmin?: unknown;
        isManager?: unknown;
      };
      if (!partialGuild.id) {
        return null;
      }

      return {
        id: String(partialGuild.id),
        name: partialGuild.name
          ? String(partialGuild.name)
          : String(partialGuild.id),
        icon: partialGuild.icon ?? null,
        banner: partialGuild.banner ?? null,
        splash: partialGuild.splash ?? null,
        memberCount: countOf(partialGuild.membercount ?? partialGuild.memberCount),
        moduleCount: countOf(partialGuild.modulecount ?? partialGuild.moduleCount),
        channelCount: lengthOf(partialGuild.channels),
        roleCount: lengthOf(partialGuild.roles),
        isAdmin: Boolean(partialGuild.isAdmin),
        isManager: Boolean(partialGuild.isManager),
      };
    })
    .filter((guild): guild is MutualGuild => Boolean(guild));
}
