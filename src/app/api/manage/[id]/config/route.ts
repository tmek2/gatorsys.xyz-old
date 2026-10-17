import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import {
  botDashboardGet,
  botDashboardPost,
  relayBotResponse,
} from "@/utils/manage-api";
import { getCached, setCached } from "@/utils/redis";
import { manageConfigKey, readManageGeneration } from "@/utils/manage-cache";

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
 * The guild's saved configuration, cached. Keyed by user as well as guild,
 * because the bot decides per request whether this user may read the guild (a
 * guild-only key would skip that check). The guild's generation is in the key
 * and every write bumps it, so one person's save retires everyone's copy.
 */
const TTL_SECONDS = 45;

export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    // An explicit refresh has to reach the bot, or a change made in Discord
    // looks unfixable from the UI for the length of the TTL.
    const bypass = new URL(request.url).searchParams.has("refresh");
    const generation = await readManageGeneration(id);
    const cacheKey = manageConfigKey(id, session.user.id, generation);

    if (!bypass) {
      const cached = await getCached<unknown>(cacheKey);
      if (cached) return NextResponse.json(cached);
    }

    const response = await botDashboardGet("dashboard_config", {
      server: id,
      user: session.user.id,
    });

    // Only good answers are cached; a 403 or "bot is restarting" passes
    // through.
    if (response.ok) {
      const raw = await response.text();
      try {
        const parsed = JSON.parse(raw);
        await setCached(cacheKey, parsed, TTL_SECONDS);
        return NextResponse.json(parsed);
      } catch {
        return relayBotResponse(new Response(raw, { status: response.status }));
      }
    }

    return relayBotResponse(response);
  }, context as never);

export const PATCH = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    let body: {
      set?: Record<string, unknown>;
      unset?: string[];
      module?: string;
      summary?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    const response = await botDashboardPost(
      "dashboard_config",
      { server: id },
      {
        user: session.user.id,
        set: body.set || {},
        unset: body.unset || [],
        module: body.module,
        summary: body.summary,
      }
    );

    // The cache is retired by `botDashboardPost`, which every write goes
    // through.
    return relayBotResponse(response);
  }, context as never);
