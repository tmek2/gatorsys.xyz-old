import { NextResponse } from "next/server";
import { invalidateManageCache } from "@/utils/manage-cache";
import { quoteLongIntegers } from "./long-ids";

/**
 * Server-side helpers for the guild dashboard. Every call proxies to the bot's
 * authenticated dashboard API, which re-checks that the acting Discord user can
 * manage the guild.
 */

const BOT_API_BASE =
  process.env.PROD_API_URL || "https://fdny-systems-production.up.railway.app";

function botAuth(): string {
  const auth = process.env.API_AUTH?.trim();
  if (!auth || auth.startsWith("#")) {
    throw new Error("API_AUTH is not configured");
  }
  return auth;
}

// Hard ceiling on every bot API call, so a slow, sleeping or restarting bot
// gives a fast, catchable 504 instead of a function that hangs until the
// platform kills it.
//
// It must sit above the worst real read: on a throttled shared database tier a
// large config document (about 1.1MB) takes around 11.5s to read. A timeout
// below that aborts the very read that would warm the bot's cache, so the guild
// fails forever. Above it, the first load is slow once and later loads are
// cached. The bot's own `socketTimeoutMS` (20s) still surfaces a truly hung
// connection as a bot-side error.
const BOT_API_TIMEOUT_MS = 25_000;

async function botFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BOT_API_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    // Normalize aborts/network failures into a 504 the caller can relay
    // cleanly instead of throwing an unhandled error up the request.
    const aborted = (error as Error)?.name === "AbortError";
    console.error(
      `[bot-api] ${aborted ? "timed out" : "request failed"}: ${url.split("?")[0]}`,
      (error as Error)?.message || error,
    );
    return new Response(
      JSON.stringify({
        message: aborted
          ? "The bot API timed out."
          : "Could not reach the bot API.",
      }),
      { status: 504, headers: { "Content-Type": "application/json" } },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function botDashboardGet(
  path: string,
  params: Record<string, string>,
): Promise<Response> {
  const url = new URL(`${BOT_API_BASE}/${path}`);
  url.searchParams.set("auth", botAuth());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return botFetch(url.toString());
}

/**
 * Every write to the bot goes through here, so cache invalidation is attached
 * once and cannot be forgotten by any of the many `/api/manage` routes: one
 * Redis `INCR` per write. A write that changed nothing only costs the next read
 * a trip to the bot.
 */
export async function botDashboardPost(
  path: string,
  params: Record<string, string>,
  body: unknown,
): Promise<Response> {
  const url = new URL(`${BOT_API_BASE}/${path}`);
  url.searchParams.set("auth", botAuth());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await botFetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Bumped whether or not the write succeeded (a failed write may have partly
  // applied). Never allowed to fail the request: a cache outage must not turn a
  // successful save into an error.
  const guildId = params.server || params.guild || params.id;
  if (guildId) {
    try {
      await invalidateManageCache(String(guildId));
    } catch {
      /* cache unavailable; the TTL is the backstop */
    }
  }

  return response;
}

/** Whether a Discord user is a configured bot owner (server-side check). */
export async function isBotOwner(userId: string): Promise<boolean> {
  try {
    const res = await botDashboardGet("dashboard_owner", { user: userId });
    return res.ok;
  } catch {
    return false;
  }
}

/** Pass a bot API response through to the client, preserving errors. With
 *  `idsAsText`, Discord ids the bot sent as numbers arrive as strings (see
 *  `quoteLongIntegers`). */
export async function relayBotResponse(
  response: Response,
  { idsAsText = false }: { idsAsText?: boolean } = {},
) {
  const raw = await response.text();
  let data: unknown;
  try {
    data = raw ? JSON.parse(idsAsText ? quoteLongIntegers(raw) : raw) : {};
  } catch {
    console.error("[bot-api] invalid response", {
      status: response.status,
      url: response.url?.split("?")[0],
      contentType: response.headers.get("content-type"),
      body: raw.slice(0, 500),
    });
    data = {
      message:
        response.status >= 500
          ? "The bot API failed while processing this request. Please try again."
          : "The bot API returned an invalid response.",
    };
  }
  return NextResponse.json(data, { status: response.status });
}
