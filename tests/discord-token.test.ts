import assert from "node:assert/strict";
import test from "node:test";

test("refreshes an expired Discord access token", async () => {
  const tokenModule = await import("../src/utils/discord-token.ts").catch(() => null);
  assert.ok(tokenModule, "Discord token refresh support must exist");

  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const refreshed = await tokenModule.refreshDiscordAccessToken(
    {
      accessToken: "expired-access-token",
      refreshToken: "valid-refresh-token",
      accessTokenExpires: 1,
      tokenType: "Bearer",
      id: "123",
    },
    {
      clientId: "client-id",
      clientSecret: "client-secret",
      fetcher: async (url: string, init?: RequestInit) => {
        requests.push({ url, init });
        return new Response(
          JSON.stringify({
            access_token: "fresh-access-token",
            refresh_token: "fresh-refresh-token",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
      now: () => 10_000,
    },
  );

  assert.equal(refreshed.accessToken, "fresh-access-token");
  assert.equal(refreshed.refreshToken, "fresh-refresh-token");
  assert.equal(refreshed.accessTokenExpires, 3_610_000);
  assert.equal(refreshed.error, undefined);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://discord.com/api/oauth2/token");
  assert.match(String(requests[0].init?.body), /grant_type=refresh_token/);
});

test("marks the session for reauthorization when refresh fails", async () => {
  const tokenModule = await import("../src/utils/discord-token.ts").catch(() => null);
  assert.ok(tokenModule, "Discord token refresh support must exist");

  const refreshed = await tokenModule.refreshDiscordAccessToken(
    { accessToken: "expired", refreshToken: "invalid", accessTokenExpires: 1 },
    {
      clientId: "client-id",
      clientSecret: "client-secret",
      fetcher: async () => new Response("invalid grant", { status: 400 }),
      now: () => 10_000,
      logger: { error: () => undefined },
    },
  );

  assert.equal(refreshed.error, "RefreshAccessTokenError");
});
