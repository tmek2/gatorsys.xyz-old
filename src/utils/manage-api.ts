import { NextResponse } from "next/server";
import { quoteLongIntegers } from "./long-ids";
import { previewBotRequest } from "@/preview/server";

/** Preview reads and writes use only the visitor's sample data. */
export function botDashboardGet(path: string, params: Record<string, string>): Promise<Response> {
  return previewBotRequest(path, params);
}
export function botDashboardPost(path: string, params: Record<string, string>, body: unknown): Promise<Response> {
  return previewBotRequest(path, params, body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {}, "POST");
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
