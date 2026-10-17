export const SITE_NAME = "Gator";
export const SITE_DESCRIPTION =
  "Focused moderation and staff tools for Discord communities.";
export const SUPPORT_URL = "https://discord.gg/X87N8qRbzR";
/** The documentation is its own deployment, not a route on this app. */
export const DOCS_URL = "https://docs.gatorsys.xyz";

export const NAV_LINKS = [
  { label: "Features", href: "/#features", external: false },
  { label: "Dashboard", href: "/servers", external: false },
  { label: "Documentation", href: DOCS_URL, external: true },
  { label: "Support", href: SUPPORT_URL, external: true },
] as const;
