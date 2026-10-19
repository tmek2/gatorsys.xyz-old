import "server-only";

/** There is no Discord credential in the offline preview. */
export async function getDiscordAccessToken(): Promise<string | null> {
  return null;
}
