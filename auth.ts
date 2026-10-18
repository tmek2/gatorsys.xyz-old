import NextAuth from "next-auth"
import Discord from "next-auth/providers/discord"
import { refreshDiscordAccessToken } from "./src/utils/discord-token"

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Trust the request host so callbacks resolve against whichever domain Vercel
  // serves (apex or www). Pinning a host fights Vercel's own domain redirect
  // and causes an apex/www loop.
  trustHost: true,
  providers: [Discord({
    clientId: process.env.DISCORD_CLIENT_ID!,
    clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    authorization: "https://discord.com/api/oauth2/authorize?scope=identify+guilds"
  })],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Host-agnostic: resolve against baseUrl (the request's own origin via
      // trustHost), so redirects stay on the host the user is already on.
      try {
        const target = new URL(url, baseUrl);
        if (target.origin === new URL(baseUrl).origin) return target.toString();
      } catch {
        /* fall through */
      }
      return baseUrl;
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.tokenType = account.token_type
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + Number(account.expires_in || 3600) * 1000
        token.id = profile?.id ?? token.sub
        return token
      }

      if (
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires - 60_000
      ) {
        return token
      }

      return refreshDiscordAccessToken(token, {
        clientId: process.env.DISCORD_CLIENT_ID!,
        clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      })
    },
    async session({ session, token }) {
      if (session.user) {
        // Never attach the access or refresh token here: this object is what
        // the browser receives.
        session.user.id = token.id ?? token.sub ?? ""
        session.user.authError = token.error
      }
      return session
    },
  },
})
