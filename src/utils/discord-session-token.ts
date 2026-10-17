import "server-only";
import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";

/**
 * Server-only access to the signed-in user's Discord access token, decoded from
 * the encrypted NextAuth JWT cookie per request. It is never copied onto the
 * session object, so /api/auth/session and `useSession` never see it.
 */
export async function getDiscordAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  // Auth.js prefixes the cookie on HTTPS deployments; check both so the
  // helper works in production and local development alike.
  const cookieName = cookieStore.has("__Secure-authjs.session-token")
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
  const token = await getToken({
    req: { headers: { cookie: cookieStore.toString() } },
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    cookieName,
  });
  const accessToken = token?.accessToken;
  if (!accessToken || token?.error) return null;
  return String(accessToken);
}
