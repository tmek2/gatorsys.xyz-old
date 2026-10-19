import "server-only";
import { cookies } from "next/headers";
import { dispatchPreview } from "./dispatch";
import { getPreviewState, resetPreviewState } from "./store";
import { PREVIEW_COOKIE } from "./identity";

export async function previewVisitor() {
  const cookieStore = await cookies();
  const visitor = cookieStore.get(PREVIEW_COOKIE)?.value;
  if (!visitor || !/^[a-f\d-]{36}$/i.test(visitor)) throw new Error("Preview session cookie is missing");
  return visitor;
}

export async function previewBotRequest(endpoint: string, params: Record<string, string> = {}, body: Record<string, any> = {}, method = "GET") {
  const visitor = await previewVisitor();
  const result = dispatchPreview(getPreviewState(visitor), { endpoint, params, body, method });
  return Response.json(result.data, { status: result.status || 200, headers: { "Cache-Control": "no-store" } });
}

export async function resetCurrentPreview() {
  resetPreviewState(await previewVisitor());
}
