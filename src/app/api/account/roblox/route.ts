import { withAuth } from "@/utils/api-middleware";
import { botDashboardGet, botDashboardPost } from "@/utils/manage-api";
import { deleteCached, getCached, setCached } from "@/utils/redis";

export const dynamic = "force-dynamic";

type RobloxIdentityResponse = {
  status?: string;
  roblox?: {
    linked: boolean;
    id?: string;
    username?: string;
    displayName?: string;
    profileUrl?: string;
    /**
     * Headshot URL: the bot's when it resolved one, otherwise filled in here
     * (the bot's lookup has a short timeout).
     */
    avatar?: string | null;
  };
  sid?: string;
  verifyUrl?: string;
  detail?: string;
  message?: string;
  retryAfter?: number;
};

/**
 * Resolves the player's headshot here too (one cached request), so a missing
 * picture really means the account has no avatar rather than a slow lookup.
 */
async function resolveHeadshot(id: string): Promise<string | null> {
  if (!/^\d+$/.test(id)) return null;
  const key = `account:roblox:avatar:${id}`;
  const cached = await getCached<{ url: string | null }>(key);
  if (cached) return cached.url;
  try {
    const response = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}` +
        "&size=150x150&format=Png&isCircular=false",
      { cache: "no-store", signal: AbortSignal.timeout(4000) },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      data?: { targetId?: number; imageUrl?: string; state?: string }[];
    };
    const entry = (payload.data || [])[0];
    const url = entry?.state === "Completed" ? entry.imageUrl || null : null;
    // Cached for a day: an avatar changes rarely and a miss is cheap to refresh.
    await setCached(key, { url }, 86400);
    return url;
  } catch {
    return null;
  }
}

async function parseBotResponse(
  response: Response,
): Promise<RobloxIdentityResponse> {
  try {
    return (await response.json()) as RobloxIdentityResponse;
  } catch {
    console.error("[roblox-identity] bot returned a non-JSON response", {
      status: response.status,
    });
    return {
      message: "Roblox verification service returned an invalid response",
    };
  }
}

export const GET = (request: Request) =>
  withAuth(async (session) => {
    const userId = String(session.user.id);
    const key = `account:roblox:${userId}`;
    const refresh = new URL(request.url).searchParams.has("refresh");
    if (!refresh) {
      const cached = await getCached<RobloxIdentityResponse>(key);
      if (cached) return Response.json(cached);
    }
    const response = await botDashboardGet("dashboard_roblox_identity", {
      user: userId,
    });
    const data = await parseBotResponse(response);
    if (data.roblox?.linked && data.roblox.id && !data.roblox.avatar) {
      data.roblox.avatar = await resolveHeadshot(String(data.roblox.id));
    }
    if (response.ok) await setCached(key, data, data.roblox?.linked ? 300 : 30);
    return Response.json(data, { status: response.status });
  });

export const POST = (request: Request) =>
  withAuth(async (session) => {
    let body: { action?: string; sid?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ message: "Invalid JSON" }, { status: 400 });
    }
    const userId = String(session.user.id);
    const key = `account:roblox:${userId}`;
    const cooldownKey = `account:roblox:cooldown:${userId}`;
    const cooldown = await getCached<{ retryAfter: number }>(cooldownKey);
    if (cooldown) {
      return Response.json(
        {
          detail:
            "Roblox verification is cooling down. Please wait before trying again.",
          retryAfter: cooldown.retryAfter,
        },
        {
          status: 429,
          headers: { "Retry-After": String(cooldown.retryAfter) },
        },
      );
    }
    const response = await botDashboardPost(
      "dashboard_roblox_identity",
      {},
      { user: userId, action: body.action, sid: body.sid },
    );
    const data = await parseBotResponse(response);
    if (response.status === 429) {
      const retryAfter = Math.max(
        1,
        Number(response.headers.get("retry-after") || data.retryAfter || 60),
      );
      data.retryAfter = retryAfter;
      await setCached(cooldownKey, { retryAfter }, retryAfter);
    } else if (response.ok && data.status === "verified") {
      await setCached(key, data, 300);
      await deleteCached(cooldownKey);
    } else if (body.action === "start" || body.action === "relink") {
      /* A relink is about to change which account this is, so the cached
         identity is wrong from here until the flow finishes. */
      await deleteCached(key);
    }
    return Response.json(data, {
      status: response.status,
      headers:
        response.status === 429 && data.retryAfter
          ? { "Retry-After": String(data.retryAfter) }
          : undefined,
    });
  });
