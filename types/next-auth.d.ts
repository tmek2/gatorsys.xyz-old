import NextAuth, { DefaultSession } from "next-auth"

// OAuth tokens intentionally never appear on the Session shape: the session
// object is served to the browser via /api/auth/session, so tokens live only
// inside the encrypted JWT cookie (see src/utils/discord-session-token.ts).
declare module "next-auth" {
  interface Session extends DefaultSession {
    discordUser?: {
      id: string
      username: string
      discriminator: string
      email: string
      image_url: string
      accentColor?: string
    }
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      authError?: "RefreshAccessTokenError"
    }
  }

  interface Profile {
    id: string
    username: string
    discriminator: string
    email: string
    avatar: string | null
    accentColor?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    tokenType?: string
    profile?: {
      id: string
      username: string
      discriminator: string
      email: string
      image_url: string
      accentColor?: string
    }
    userId?: string
    refreshToken?: string
    accessTokenExpires?: number
    error?: "RefreshAccessTokenError"
  }
}
