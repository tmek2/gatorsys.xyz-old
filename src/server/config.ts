/** Server configuration is read when a request needs it, so public pages can
 * still render while an operator is setting up the bot connection. */
export function getBotApiConfig() {
  const value = process.env.PROD_API_URL?.trim();
  const auth = process.env.API_AUTH?.trim();
  if (!value) throw new Error("PROD_API_URL is not configured");
  if (!auth || auth.startsWith("#")) throw new Error("API_AUTH is not configured");

  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("PROD_API_URL must be an HTTP or HTTPS base URL without credentials or query parameters");
  }
  return { baseUrl: url.toString().replace(/\/$/, ""), auth };
}

export function botApiUrl(path: string, params: Record<string, string> = {}) {
  const config = getBotApiConfig();
  const url = new URL(`${config.baseUrl}/${path.replace(/^\/+/, "")}`);
  url.searchParams.set("auth", config.auth);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}
