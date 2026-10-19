import { PREVIEW_SESSION } from "@/preview/identity";
import { mapPreviewRoute, projectPreviewReply } from "@/preview/routes";
import { dispatchPreview } from "@/preview/dispatch";
import { previewVisitor, resetCurrentPreview } from "@/preview/server";
import { getPreviewState } from "@/preview/store";
import { localRedirectTarget } from "@/utils/local-redirect";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
const MAX_BODY_BYTES = 12 * 1024 * 1024;

async function readBody(request: Request): Promise<Record<string, any>> {
  if (!request.body || ["GET", "HEAD", "OPTIONS"].includes(request.method)) return {};
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new Error("This preview request is too large."); }
    chunks.push(chunk.value);
  }
  if (!size) return {};
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const text = new TextDecoder().decode(bytes);
  if (request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(text));
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A JSON object is required.");
  return value as Record<string, any>;
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const path = request.headers.get("x-preview-route") || url.searchParams.get("path") || "/api/preview";
  url.searchParams.delete("path");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const method = request.method === "HEAD" ? "GET" : request.method;
  try {
    const body = await readBody(request);
    if (path === "/api/preview/reset") {
      if (method !== "POST") return json({ message: "Use the Reset preview button to start again." }, 405);
      await resetCurrentPreview();
      return json({ ok: true, preview: true });
    }
    if (path.startsWith("/api/auth/")) {
      if (path.endsWith("/session")) return json(PREVIEW_SESSION);
      if (path.endsWith("/csrf")) return json({ csrfToken: "offline-preview" });
      if (path.endsWith("/providers")) return json({});
      return json({ url: localRedirectTarget(String(body.callbackUrl || ""), "/servers") });
    }
    if (path === "/api/health") return json({ ok: true, preview: true });
    if (path === "/api/image-preview") return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#28232a"/><text x="320" y="180" fill="#f7a8c4" font-size="28" text-anchor="middle">Preview image</text></svg>', { headers: { ...headers, "Content-Type": "image/svg+xml" } });
    const mapped = mapPreviewRoute(path, method, url.searchParams, body);
    if (!mapped) return json({ message: "This route is not available in the preview." }, 404);
    const reply = dispatchPreview(getPreviewState(await previewVisitor()), mapped.request);
    return json((reply.status || 200) < 400 ? projectPreviewReply(mapped.project, reply.data) : reply.data, reply.status || 200);
  } catch (error) {
    return json({ message: error instanceof SyntaxError ? "The request contains invalid JSON." : error instanceof Error ? error.message : "Invalid preview request." }, 400);
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as OPTIONS, handle as HEAD };
