import { redirect } from "next/navigation";
import { PREVIEW_SESSION as previewSession } from "./src/preview/identity";
import { localRedirectTarget } from "./src/utils/local-redirect";

/** This branch always uses its fictional account. No OAuth provider is loaded. */
export async function auth() {
  return structuredClone(previewSession);
}

async function handleAuth(request: Request) {
  const path = new URL(request.url).pathname;
  if (path.endsWith("/session")) return Response.json(await auth());
  if (path.endsWith("/csrf")) return Response.json({ csrfToken: "offline-preview" });
  if (path.endsWith("/providers")) return Response.json({});
  let callback: string | null = null;
  if (request.method === "POST") {
    try { callback = String((await request.formData()).get("callbackUrl") || ""); } catch { /* optional local callback */ }
  }
  return Response.json({ url: localRedirectTarget(callback, "/") });
}

export const handlers = { GET: handleAuth, POST: handleAuth };

export async function signIn(_provider?: string, options: { redirectTo?: string; redirect?: boolean } = {}) {
  const target = localRedirectTarget(options.redirectTo);
  if (options.redirect === false) return target;
  redirect(target);
}

export async function signOut(options: { redirectTo?: string; redirect?: boolean } = {}) {
  const target = localRedirectTarget(options.redirectTo, "/");
  if (options.redirect === false) return target;
  redirect(target);
}
