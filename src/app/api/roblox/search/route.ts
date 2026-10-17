import { NextResponse } from "next/server";

/**
 * Username autocomplete for the "Roblox user search" question: takes `keyword`
 * and returns up to 8 matching users with headshots. Roblox's `users/search`
 * rate-limits datacenter and serverless IPs (429), so this: 1. caches results
 * in memory per warm instance; 2. spaces outbound calls and retries 429 and 5xx
 * with backoff honouring Retry-After; 3. falls back to the more lenient
 * exact-username lookup when search is throttled.
 */

type RobloxUser = {
  id: number;
  name: string;
  displayName?: string;
  avatarUrl?: string | null;
};

// ── In-memory caches (per warm serverless instance) ──────────────────────────
const RESULT_CACHE = new Map<string, { at: number; users: RobloxUser[] }>();
const POSITIVE_TTL_MS = 5 * 60_000; // real results are stable for a while
const NEGATIVE_TTL_MS = 30_000; // don't hammer Roblox re-checking empties
const CACHE_MAX = 500;

// ── Self-throttle: space outbound calls so Roblox doesn't 429 us ─────────────
let lastCallAt = 0;
const MIN_SPACING_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cacheGet(keyword: string): RobloxUser[] | null {
  const hit = RESULT_CACHE.get(keyword);
  if (!hit) return null;
  const ttl = hit.users.length ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
  if (Date.now() - hit.at > ttl) {
    RESULT_CACHE.delete(keyword);
    return null;
  }
  return hit.users;
}

function cacheSet(keyword: string, users: RobloxUser[]) {
  RESULT_CACHE.set(keyword, { at: Date.now(), users });
  // Bound the map — dicts keep insertion order, so drop the oldest.
  while (RESULT_CACHE.size > CACHE_MAX) {
    const oldest = RESULT_CACHE.keys().next().value;
    if (oldest === undefined) break;
    RESULT_CACHE.delete(oldest);
  }
}

/** Fetch that spaces calls, times out, and retries 429/5xx honouring
 *  Retry-After (capped so we stay inside the request budget). */
async function robloxFetch(
  url: string,
  init: RequestInit = {},
  tries = 2,
): Promise<Response | null> {
  for (let attempt = 0; attempt < tries; attempt++) {
    const since = Date.now() - lastCallAt;
    if (since < MIN_SPACING_MS) await sleep(MIN_SPACING_MS - since);
    lastCallAt = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    try {
      const res = await fetch(url, {
        ...init,
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/json", ...(init.headers || {}) },
      });
      clearTimeout(timeout);
      if (res.status === 429 || res.status >= 500) {
        if (attempt === tries - 1) return res;
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 1500)
          : 400 * (attempt + 1);
        await sleep(backoff);
        continue;
      }
      return res;
    } catch {
      clearTimeout(timeout);
      if (attempt === tries - 1) return null;
      await sleep(300 * (attempt + 1));
    }
  }
  return null;
}

async function searchUsers(keyword: string): Promise<RobloxUser[]> {
  const res = await robloxFetch(
    `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(keyword)}&limit=10`,
  );
  if (!res || !res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const rows: Array<{ id: number; name: string; displayName?: string }> =
    Array.isArray((data as any)?.data) ? (data as any).data.slice(0, 8) : [];
  return rows.map((u) => ({ id: u.id, name: u.name, displayName: u.displayName || u.name }));
}

/** Exact-username resolver — far more lenient than search, so a fully typed
 *  username still resolves when search is throttled. */
async function resolveExact(keyword: string): Promise<RobloxUser[]> {
  const res = await robloxFetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [keyword], excludeBannedUsers: false }),
  });
  if (!res || !res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const rows: Array<{ id: number; name: string; displayName?: string }> =
    Array.isArray((data as any)?.data) ? (data as any).data : [];
  return rows.map((u) => ({ id: u.id, name: u.name, displayName: u.displayName || u.name }));
}

async function attachAvatars(users: RobloxUser[]): Promise<RobloxUser[]> {
  if (!users.length) return users;
  const ids = users.map((u) => u.id).join(",");
  try {
    const res = await robloxFetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ids}&size=48x48&format=Png&isCircular=false`,
      {},
      1, // avatars are best-effort — don't spend retries on them
    );
    if (res && res.ok) {
      const data = await res.json().catch(() => ({}));
      const map = new Map<number, string>();
      for (const entry of (data as any)?.data || []) {
        if (entry?.targetId && entry?.imageUrl) map.set(entry.targetId, entry.imageUrl);
      }
      return users.map((u) => ({ ...u, avatarUrl: map.get(u.id) || null }));
    }
  } catch {
    // fall through
  }
  return users.map((u) => ({ ...u, avatarUrl: null }));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const keyword = (searchParams.get("keyword") || "").trim();
    if (keyword.length < 2) return NextResponse.json({ users: [] });

    const cached = cacheGet(keyword.toLowerCase());
    if (cached) return NextResponse.json({ users: cached });

    // Prefix search first; if it's throttled/empty, resolve the exact username.
    let users = await searchUsers(keyword);
    if (!users.length) users = await resolveExact(keyword);

    users = await attachAvatars(users);
    cacheSet(keyword.toLowerCase(), users);
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ users: [] });
  }
}
