import { NextResponse } from "next/server";
import { withAuth } from "@/utils/api-middleware";
import { botDashboardPost, relayBotResponse } from "@/utils/manage-api";

export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

/* A picture from a message editor, stored by the bot and returned as a link
   Discord can fetch. The editor shrinks it below this host's 4.5MB request
   limit; the bot re-checks type and size. */
export const POST = (request: Request, context: { params: Promise<Params> }) =>
  withAuth<Params>(async (session) => {
    const { id } = await context.params;
    let body: { image?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    if (typeof body.image !== "string" || !body.image.startsWith("data:image/")) {
      return NextResponse.json({ message: "Send a picture" }, { status: 400 });
    }
    const response = await botDashboardPost(
      "dashboard_media",
      { server: id },
      { user: session.user.id, image: body.image },
    );
    return relayBotResponse(response);
  }, context as never);
