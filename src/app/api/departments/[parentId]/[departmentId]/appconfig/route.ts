import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import { botDashboardGet, botDashboardPost } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

type Params = { parentId: string; departmentId: string };

/**
 * Member-portal endpoint for the application editor: the same shapes as
 * /api/manage/[id]/meta and /config, scoped to one department and authorised by
 * its `manage_resources` rank permission instead of Manage Server.
 */
export const GET = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { parentId, departmentId } = await context.params;
    const scope = new URL(request.url).searchParams.get("scope");
    const response = await botDashboardGet("dashboard_departmentappconfig", {
      server: parentId,
      user: session.user.id,
      department: departmentId,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(body, { status: response.status });
    }
    // ManageProvider fetches meta and config as two requests; both come from
    // the same bot payload here.
    if (scope === "meta") return NextResponse.json(body.meta || {});
    return NextResponse.json({ config: body.config || {} });
  }, context as never);

export const PATCH = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { parentId, departmentId } = await context.params;
    let body: { set?: Record<string, unknown>; unset?: string[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    const set = body.set || {};
    let applications = set["Applications.applications"];
    if (!Array.isArray(applications)) {
      // The staged edit didn't touch the list itself (e.g. a lone module
      // toggle) — carry the current list through unchanged.
      const current = await botDashboardGet("dashboard_departmentappconfig", {
        server: parentId,
        user: session.user.id,
        department: departmentId,
      });
      const json = await current.json().catch(() => ({}));
      if (!current.ok) return NextResponse.json(json, { status: current.status });
      applications = json.config?.Applications?.applications || [];
    }
    const response = await botDashboardPost(
      "dashboard_departmentappconfig",
      { server: parentId },
      {
        user: session.user.id,
        department: departmentId,
        applications,
        profiles: set["Department.profiles"],
      },
    );
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json(json, { status: response.status });
    return NextResponse.json({ config: json.config || {} });
  }, context as never);
