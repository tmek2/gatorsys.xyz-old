import { signIn } from "~/auth";
import { DiscordAuthRedirect } from "./discord-auth-redirect";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type DiscordAuthPageProps = {
  searchParams?: Promise<{ callbackUrl?: string }> | { callbackUrl?: string };
};

/**
 * Only our own paths are returned to: `callbackUrl` comes from the query
 * string, so otherwise it is an open redirect. A leading `//` or `/\` is
 * protocol-relative (a host, not a path), so those are rejected too.
 */
function safeCallbackUrl(value: string | undefined): string {
  const candidate = String(value || "");
  if (!candidate.startsWith("/")) return "/servers";
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return "/servers";
  return candidate;
}

/**
 * The hand-off to Discord: a server action behind a real form, submitted
 * automatically. It works even if the client never hydrates or a webview
 * withholds the CSRF cookie, and the button stays on screen to press if the
 * automatic submit does not happen.
 */
export default async function DiscordAuthPage({ searchParams }: DiscordAuthPageProps) {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    redirect("/setup#discord");
  }
  const params = await Promise.resolve(searchParams);
  const callbackUrl = safeCallbackUrl(params?.callbackUrl);

  async function startDiscordSignIn() {
    "use server";
    await signIn("discord", { redirectTo: callbackUrl });
  }

  return <DiscordAuthRedirect action={startDiscordSignIn} />;
}
