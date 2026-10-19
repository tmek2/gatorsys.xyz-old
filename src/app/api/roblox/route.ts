import { previewBotRequest } from "@/preview/server";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  return previewBotRequest("preview_roblox_user", { id });
}
