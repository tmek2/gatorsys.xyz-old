/**
 * Discord avatar URLs with animated hashes served as GIFs. A hash starting `a_`
 * is animated, and the CDN only serves it as .gif (a .png request returns
 * nothing). Normalises whatever it is given; a no-op on correct URLs.
 */
export function discordAvatarUrl(
  url: string | null | undefined,
  size = 128,
): string | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (!raw.includes("cdn.discordapp.com")) return raw;
  try {
    const parsed = new URL(raw);
    // .../avatars/<user>/<hash>.<ext> — the hash is the last path segment.
    const file = parsed.pathname.split("/").pop() || "";
    const [hash, extension] = [
      file.replace(/\.[a-z0-9]+$/i, ""),
      (file.match(/\.([a-z0-9]+)$/i) || [])[1] || "",
    ];
    const animated = hash.startsWith("a_");
    if (animated && extension.toLowerCase() !== "gif") {
      // Also handles URLs that arrive with no extension at all.
      parsed.pathname = extension
        ? parsed.pathname.replace(/\.[a-z0-9]+$/i, ".gif")
        : `${parsed.pathname}.gif`;
    }
    // Animated avatars must be requested without a `size` parameter: with one,
    // Discord's CDN serves only the static first frame (discord.py's
    // `display_avatar.url` adds `?size=1024`). Static avatars keep their size.
    if (animated) {
      parsed.searchParams.delete("size");
    } else if (!parsed.searchParams.has("size")) {
      parsed.searchParams.set("size", String(size));
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}
