import { withAuth } from "@/utils/api-middleware";
import { hasAdminPanelAccess } from "@/utils/discord-admin";
import { botApiUrl } from "@/server/config";

export const dynamic = "force-dynamic";

interface TranscriptParams {
  id: string;
}

export const GET = (
  _request: Request,
  context: { params: Promise<TranscriptParams> },
) =>
  withAuth(async (session) => {
    const { id } = await context.params;
    if (!id || typeof id !== "string") {
      return Response.json({ error: "Invalid or missing id parameter" }, { status: 400 });
    }

    try {
      const response = await fetch(botApiUrl("transcript", { id }), {
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) {
        return Response.json(
          { error: "Failed to fetch transcript" },
          { status: response.status === 404 ? 404 : 502 },
        );
      }

      const data = await response.json();
      if (!Array.isArray(data?.transcript)) {
        return Response.json({ error: "Invalid transcript response" }, { status: 502 });
      }
      if (data.transcript.length === 0) {
        return Response.json({ error: "Transcript not found" }, { status: 404 });
      }

      const compact = data.transcript[0]?.compact;
      const GuildID = data.GuildID;
      if (!Array.isArray(compact) || !GuildID) {
        return Response.json({ error: "Invalid transcript response" }, { status: 502 });
      }

      if (!(await hasAdminPanelAccess(session, String(GuildID)))) {
        return Response.json({ message: "Unauthorized" }, { status: 403 });
      }

      return Response.json({ data, compact, GuildID });
    } catch {
      return Response.json({ error: "Failed to fetch transcript" }, { status: 502 });
    }
  });
