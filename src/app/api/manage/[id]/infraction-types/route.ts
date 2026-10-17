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

/**
 * What each infraction type does (whether issuing it demotes, and to where), as
 * opposed to its name in `Infraction.types`. These automations previously lived
 * only behind the bot's /config.
 */
export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    const response = await botDashboardGet("dashboard_infractiontypes", {
      server: id,
      user: session.user.id,
    });
    return relayBotResponse(response);
  }, context as never);

export const POST = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    let body: { types?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    if (!Array.isArray(body.types)) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }
    // Only the fields the bot reads are forwarded. A type name not yet in
    // `Infraction.types` is still sent (the bot ignores unknown names; dropping
    // it could lose a save made while another tab adds the type).
    const idList = (value: unknown) =>
      (Array.isArray(value) ? value : [])
        .map((entry) => String(entry ?? "").trim())
        .filter((entry) => /^\d+$/.test(entry))
        .slice(0, 25);

    const types = body.types
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      .map((entry) => ({
        name: String(entry.name ?? "").slice(0, 100),
        given_roles: idList(entry.given_roles),
        removed_roles: idList(entry.removed_roles),
        change_group_role: Boolean(entry.change_group_role),
        group_role: String(entry.group_role ?? "").slice(0, 200),
        staff_database_removal: Boolean(entry.staff_database_removal),
        channel: String(entry.channel ?? "").trim(),
        demote: Boolean(entry.demote),
        demote_department: String(entry.demote_department ?? "").slice(0, 100),
        demote_skip_to: String(entry.demote_skip_to ?? ""),
      }))
      .filter((entry) => entry.name);

    const response = await botDashboardPost(
      "dashboard_infractiontypes",
      { server: id },
      { user: session.user.id, types },
    );
    return relayBotResponse(response);
  }, context as never);
