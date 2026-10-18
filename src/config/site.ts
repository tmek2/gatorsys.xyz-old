export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "Community Dashboard";
export const SITE_DESCRIPTION =
  "Focused moderation and staff tools for Discord communities.";
// These are public links. Empty values use the local setup guide rather than
// sending a new installation to somebody else's community.
function publicLink(value: string | undefined, fallback: string) {
  if (!value?.trim()) return fallback;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

export const SUPPORT_URL = publicLink(process.env.NEXT_PUBLIC_SUPPORT_URL, "/setup#support");
export const DOCS_URL = publicLink(process.env.NEXT_PUBLIC_DOCS_URL, "/setup");
export const BOT_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID?.trim() || "";

export const NAV_LINKS = [
  { label: "Features", href: "/#features", external: false },
  { label: "Dashboard", href: "/servers", external: false },
  { label: "Documentation", href: DOCS_URL, external: DOCS_URL.startsWith("http") },
  { label: "Support", href: SUPPORT_URL, external: SUPPORT_URL.startsWith("http") },
] as const;
