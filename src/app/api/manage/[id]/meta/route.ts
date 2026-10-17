import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import { botDashboardGet, relayBotResponse } from "@/utils/manage-api";
import { getCached, setCached } from "@/utils/redis";
import { manageMetaKey, readManageGeneration } from "@/utils/manage-cache";

export const dynamic = "force-dynamic";
/**
 * Longer than `BOT_API_TIMEOUT_MS` on purpose: if the platform kills the
 * function first there is no log and no catchable error. Our own abort must
 * fire first, logging "[bot-api] timed out" with the URL.
 */
export const maxDuration = 30;


interface Params {
  id: string;
}

/**
 * Guild metadata (roles, channels, emoji, and what this user may do): the most
 * requested read in the dashboard, cached here. Keyed by user as well as guild,
 * because the permission flags are per user. The guild's generation is in the
 * key, and every config write bumps it, so module on/off state (from the
 * config) is never stale for anyone.
 */
const TTL_SECONDS = 60;

export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    // An explicit refresh has to be able to skip the cache, or a role added in
    // Discord looks unfixable from the UI for the length of the TTL.
    const bypass = new URL(request.url).searchParams.has("refresh");
    // The member list is opt-in: only the pickers that show people ask for it,
    // keeping it off /manage's critical path.
    const withMembers = new URL(request.url).searchParams.has("members");
    const cacheKey = manageMetaKey(
      id,
      session.user.id,
      await readManageGeneration(id),
      withMembers,
    );

    if (!bypass) {
      const cached = await getCached<unknown>(cacheKey);
      if (cached) return NextResponse.json(cached);
    }

    const response = await botDashboardGet("dashboard_meta", {
      server: id,
      user: session.user.id,
      ...(withMembers ? { members: "1" } : {}),
    });

    // Only good answers are cached; a 403 or "bot is restarting" passes through
    // uncached.
    if (response.ok) {
      const raw = await response.text();
      try {
        const parsed = JSON.parse(raw);
        await setCached(cacheKey, parsed, TTL_SECONDS);
        return NextResponse.json(parsed);
      } catch {
        // Not JSON: hand it to the relay, which knows how to report that.
        return relayBotResponse(new Response(raw, { status: response.status }));
      }
    }

    return relayBotResponse(response);
  }, context as never);
