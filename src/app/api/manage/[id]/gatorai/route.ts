import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import {
  botDashboardGet,
  botDashboardPost,
  relayBotResponse,
} from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

const MIN_GATORAI_COOLDOWN_SECONDS = 30;

/** Assistant's per-server behaviour: the personality and filter dials, where it
 *  is allowed to answer, and the incident banner. */
export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    const response = await botDashboardGet("dashboard_gatorai", {
      server: id,
      user: session.user.id,
    });
    // The bot stores channel and member ids as numbers; as numbers they would
    // be rounded on the way to the page. The bot takes them back as strings.
    return relayBotResponse(response, { idsAsText: true });
  }, context as never);

export const PATCH = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    let body: { settings?: Record<string, unknown> };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    const settings = { ...(body.settings || {}) };
    if ("cooldown_seconds" in settings) {
      const requested = Number(settings.cooldown_seconds);
      settings.cooldown_seconds = Math.min(
        600,
        Math.max(
          MIN_GATORAI_COOLDOWN_SECONDS,
          Number.isFinite(requested) ? Math.trunc(requested) : MIN_GATORAI_COOLDOWN_SECONDS,
        ),
      );
    }
    // The website applies its own floor before forwarding the save. The bot
    // validates it again, so direct calls to either side cannot submit less.
    const response = await botDashboardPost(
      "dashboard_gatorai",
      { server: id },
      { user: session.user.id, settings },
    );
    return relayBotResponse(response, { idsAsText: true });
  }, context as never);
