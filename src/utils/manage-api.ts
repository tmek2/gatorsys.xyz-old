import { NextResponse } from "next/server";
import { invalidateManageCache } from "@/utils/manage-cache";
import { quoteLongIntegers } from "./long-ids";
import { botApiUrl } from "@/server/config";

/**
 * Server-side helpers for the guild dashboard. Every call proxies to the bot's
 * authenticated dashboard API, which re-checks that the acting Discord user can
 * manage the guild.
 */

// Leave room for cold bot reads while returning a recoverable error before the
// hosting platform's request limit. Keep this above the bot's database timeout.
const BOT_API_TIMEOUT_MS = 25_000;

async function botFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BOT_API_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    // The deadline includes the body, not only the arrival of response headers.
    const body = [204, 205, 304].includes(response.status) ? null : await response.arrayBuffer();
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    return new Response(body, { status: response.status, statusText: response.statusText, headers });
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
  const url = botApiUrl(path, params);
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
  const url = botApiUrl(path, params);
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
  let status = response.status;
  let data: unknown;
  try {
    data = raw ? JSON.parse(idsAsText ? quoteLongIntegers(raw) : raw) : {};
  } catch {
    console.error("[bot-api] invalid response", {
      status: response.status,
      url: response.url?.split("?")[0],
      contentType: response.headers.get("content-type"),
    });
    data = {
      message:
        response.status >= 500
          ? "The bot API failed while processing this request. Please try again."
          : "The bot API returned an invalid response.",
    };
    if (response.ok) status = 502;
  }
  if ([204, 205, 304].includes(response.status)) {
    return new Response(null, { status: response.status });
  }
  return NextResponse.json(data, { status });
}
