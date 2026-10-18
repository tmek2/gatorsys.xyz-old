import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { auth } from "~/auth";

/**
 * Canonical-host guard, only for ephemeral Vercel deployment hosts: a raw
 * deployment host (website-main-*.vercel.app) would strand the browser away
 * from the custom domain where the session cookie lives, so those get a 308 to
 * the canonical host.
 *
 * The apex and www relationship is left to Vercel's domain config: handling it
 * here as well creates a redirect loop (apex → www in the app, www → apex at
 * the edge). localhost and real domain hosts pass through.
 */

function hostGuard(request: NextRequest) {
  const configured = process.env.CANONICAL_URL?.trim();
  if (!configured) return NextResponse.next();
  const host = (request.headers.get("host") || "").toLowerCase();

  // Only intervene for raw Vercel deployment hosts. Every real domain host
  // (apex, www, or any subdomain) is left to Vercel's domain config.
  if (!host.endsWith(".vercel.app")) {
    return NextResponse.next();
  }

  const canonical = new URL(configured);
  if (!['http:', 'https:'].includes(canonical.protocol) || canonical.host === host) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.host = canonical.host;
  url.protocol = canonical.protocol;
  url.port = canonical.port;
  return NextResponse.redirect(url, 308);
}

/**
 * Keeps the session current where it can be written. Discord's refresh token
 * can be used once, and `auth()` in a page cannot set a cookie, so a page
 * refreshing the token would spend it and discard the new one, and the next
 * page would be refused. In middleware the refreshed session is written back
 * onto the response, so every following page reads fresh tokens. NextAuth's own
 * routes are left alone.
 */
const withSession = auth((request) => hostGuard(request));

export function middleware(request: NextRequest, event: NextFetchEvent) {
  if (request.nextUrl.pathname.startsWith("/api/auth")) return hostGuard(request);
  return (withSession as unknown as (req: NextRequest, ev: NextFetchEvent) => Promise<Response>)(request, event);
}

export const config = {
  runtime: "nodejs",
  // Run on everything except Next internals and static assets. Auth routes are
  // intentionally included so login flows are pulled back to the domain too.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)"],
};
