import { localRedirectTarget } from "./local-redirect";
/** Installation and sign-in links stay inside the fictional workspace. */
export function getDiscordBotInviteUrl(_options: { guildId?: string; redirectUri?: string; state?: string } = {}) {
  return "/servers";
}
export function getDiscordSignInUrl(callbackUrl?: string) {
  return localRedirectTarget(callbackUrl, "/servers");
}
