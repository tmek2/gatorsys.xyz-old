export type DiscordAuthToken = {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpires?: number;
  tokenType?: string;
  id?: string;
  error?: "RefreshAccessTokenError";
  [key: string]: unknown;
};

type RefreshOptions = {
  clientId: string;
  clientSecret: string;
  fetcher?: typeof fetch;
  now?: () => number;
  logger?: Pick<Console, "error">;
};

export async function refreshDiscordAccessToken<T extends DiscordAuthToken>(
  token: T,
  options: RefreshOptions,
): Promise<T> {
  if (!token.refreshToken) {
    return { ...token, error: "RefreshAccessTokenError" };
  }

  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const logger = options.logger ?? console;

  // Hard timeout: a slow or unreachable Discord token endpoint would otherwise
  // hang `auth()` during SSR and every page that renders the header.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetcher("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: options.clientId,
        client_secret: options.clientSecret,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Discord token refresh failed with status ${response.status}`);
    }

    const refreshed = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type?: string;
    };

    return {
      ...token,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      accessTokenExpires: now() + refreshed.expires_in * 1000,
      tokenType: refreshed.token_type ?? token.tokenType,
      error: undefined,
    };
  } catch (error) {
    logger.error("Unable to refresh Discord access token", error);
    return { ...token, error: "RefreshAccessTokenError" };
  } finally {
    clearTimeout(timeout);
  }
}
