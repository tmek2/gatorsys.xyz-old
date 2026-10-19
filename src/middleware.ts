import { NextRequest, NextResponse } from "next/server";
import { PREVIEW_COOKIE } from "./preview/identity";

/** A visitor cookie keeps independent copies of the sample data. Forward it
 * on the first request too, before the browser has received the response. */
export function middleware(request: NextRequest) {
  const existing = request.cookies.get(PREVIEW_COOKIE)?.value;
  const visitor = existing && /^[a-f\d-]{36}$/i.test(existing) ? existing : crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-preview-route", request.nextUrl.pathname);
  const cookie = headers.get("cookie")?.split(";").filter(value => !value.trim().startsWith(`${PREVIEW_COOKIE}=`)).join(";") || "";
  headers.set("cookie", `${cookie}${cookie ? "; " : ""}${PREVIEW_COOKIE}=${visitor}`);
  const destination = request.nextUrl.clone();
  const api = destination.pathname.startsWith("/api/") && destination.pathname !== "/api/preview";
  if (api) {
    destination.searchParams.set("path", destination.pathname);
    destination.pathname = "/api/preview";
  }
  const response = api
    ? NextResponse.rewrite(destination, { request: { headers } })
    : NextResponse.next({ request: { headers } });
  response.cookies.set(PREVIEW_COOKIE, visitor, { httpOnly: true, sameSite: "lax", path: "/", secure: request.nextUrl.protocol === "https:", maxAge: 43_200 });
  // The browser can only send requests to this preview's own server.
  response.headers.set("Content-Security-Policy", "connect-src 'self'");
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)"],
};
