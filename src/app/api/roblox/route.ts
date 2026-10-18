import { NextResponse } from "next/server";
import { fetchWithRetry } from "@/utils/api-helpers";

type RobloxUser = { name?: unknown };
type Headshots = { data?: Array<{ state?: string; imageUrl?: unknown }> };

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("id") || "";
  if (!/^[1-9]\d{0,19}$/.test(userId)) {
    return NextResponse.json({ error: "A numeric Roblox user ID is required" }, { status: 400 });
  }

  try {
    const user = await fetchWithRetry<RobloxUser>(
      `https://users.roblox.com/v1/users/${userId}`,
      { cache: "no-store" }, 1, { timeoutMs: 4000 },
    );
    if (typeof user?.name !== "string" || !user.name.trim()) {
      return NextResponse.json({ error: "Roblox returned an invalid user" }, { status: 502 });
    }

    // A delayed or unavailable headshot must not hide an otherwise valid user.
    let avatarUrl: string | null = null;
    try {
      const avatars = await fetchWithRetry<Headshots>(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=png`,
        { cache: "no-store" }, 1, { timeoutMs: 4000 },
      );
      const image = Array.isArray(avatars?.data) ? avatars.data[0]?.imageUrl : null;
      if (typeof image === "string" && /^https:\/\//i.test(image)) avatarUrl = image;
    } catch {
      // The client renders an initial when no avatar is available.
    }
    return NextResponse.json({ username: user.name, avatarUrl });
  } catch (error) {
    const status = Number((error as { status?: number })?.status);
    if (status === 404) return NextResponse.json({ error: "Roblox user not found" }, { status: 404 });
    const timedOut = (error as Error)?.name === "AbortError";
    return NextResponse.json(
      { error: timedOut ? "Roblox took too long to respond" : "Could not load this Roblox user" },
      { status: timedOut ? 504 : status === 429 ? 503 : 502 },
    );
  }
}
