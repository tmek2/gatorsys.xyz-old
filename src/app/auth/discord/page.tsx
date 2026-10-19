import { redirect } from "next/navigation";
import { localRedirectTarget } from "@/utils/local-redirect";

export const dynamic = "force-dynamic";

type DiscordAuthPageProps = {
  searchParams?: Promise<{ callbackUrl?: string }> | { callbackUrl?: string };
};

/** Old sign-in links remain useful, without starting an OAuth flow. */
export default async function DiscordAuthPage({ searchParams }: DiscordAuthPageProps) {
  const params = await Promise.resolve(searchParams);
  redirect(localRedirectTarget(params?.callbackUrl));
}
