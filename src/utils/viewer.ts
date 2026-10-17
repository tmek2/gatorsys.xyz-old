import type { Session } from "next-auth";

/**
 * Who the header may say you are. A session can outlive its Discord tokens (the
 * cookie still has a name and avatar, but `jwt()` stamped `authError` after a
 * failed refresh); pages that need Discord already send you to sign in then.
 * The header asks this function, the same check the guards use, so it never
 * shows a face for a session that will bounce.
 */
export interface Viewer {
  id: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
}

/** True when the session can still speak to Discord on this person's behalf. */
export function isLive(
  session: { user?: { authError?: unknown } | null } | null | undefined,
): boolean {
  return Boolean(session?.user && !session.user.authError);
}

/** The viewer for the header, or null when there is nobody the site can serve. */
export function viewerFromSession(session: Session | null | undefined): Viewer | null {
  if (!isLive(session) || !session?.user) return null;
  return {
    id: session.user.id ? String(session.user.id) : null,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
  };
}
