/** Preview URLs are identifiers consumed by the local request adapter. Real
 * environment values are deliberately ignored on this branch. */
export function getBotApiConfig() {
  return { baseUrl: "https://preview.invalid", auth: "offline-preview" };
}
export function botApiUrl(path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://preview.invalid/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}
