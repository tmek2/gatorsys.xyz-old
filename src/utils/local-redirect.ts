/** Return links stay on this site, including when browsers normalize slashes. */
export function localRedirectTarget(value: string | null | undefined, fallback = "/servers"): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return fallback;
  try {
    const base = "https://dashboard.example";
    const target = new URL(value, base);
    return target.origin === base ? `${target.pathname}${target.search}${target.hash}` : fallback;
  } catch {
    return fallback;
  }
}
