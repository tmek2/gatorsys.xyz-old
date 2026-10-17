export const dynamic = 'force-dynamic'

import { withAuth } from '@/utils/api-middleware';
import {
  BotUnreachableError,
  DiscordAuthExpiredError,
  fetchMutualServersForSession,
} from '@/utils/mutual-servers';

export const GET = (request: Request) =>
  withAuth(async (session) => {
    try {
      const forceRefresh = new URL(request.url).searchParams.has('refresh');
      const mutualGuilds = await fetchMutualServersForSession(session, { forceRefresh });
      return Response.json(mutualGuilds);
    } catch (error: any) {
      console.error("Detailed error in mutual route:", {
        errorMessage: error.message,
        errorName: error.name,
        sessionInfo: {
          hasUser: !!session?.user,
        },
      });

      if (error instanceof DiscordAuthExpiredError) {
        return Response.json(
          { error: 'Your Discord login expired. Sign in again.' },
          { status: 401 }
        );
      }
      return Response.json(
        {
          error:
            error instanceof BotUnreachableError
              ? "Gator's bot is restarting or unreachable right now. Try again in a minute."
              : 'Failed to fetch mutual servers',
          details: error.message,
        },
        { status: error instanceof BotUnreachableError ? 503 : 500 }
      );
    }
  });
