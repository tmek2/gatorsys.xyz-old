import { BOT_CLIENT_ID } from "@/config/site";
const BOT_PERMISSIONS = "429765553360";

export function getDiscordBotInviteUrl(options: {
  guildId?: string;
  redirectUri?: string;
  state?: string;
} = {}) {
  if (!BOT_CLIENT_ID) return "/setup#discord";
  const params = new URLSearchParams({
    client_id: BOT_CLIENT_ID,
    permissions: BOT_PERMISSIONS,
    scope: "bot applications.commands",
  });

  if (options.guildId) {
    params.set("guild_id", options.guildId);
    params.set("disable_guild_select", "true");
    params.set("integration_type", "0");
  }
  /* Discord validates `redirect_uri` against the redirects registered for this
     client id and rejects the whole authorize call otherwise, so only pass one
     that is registered exactly (scheme and path included). Opt-in per caller
     for that reason. */
  if (options.redirectUri) {
    params.set("redirect_uri", options.redirectUri);
    params.set("response_type", "code");
  }
  if (options.state) params.set("state", options.state);

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

export function getDiscordSignInUrl(callbackUrl?: string) {
  const params = new URLSearchParams();

  if (callbackUrl) {
    params.set("callbackUrl", callbackUrl);
  }

  const suffix = params.toString();
  return `/auth/discord${suffix ? `?${suffix}` : ""}`;
}
