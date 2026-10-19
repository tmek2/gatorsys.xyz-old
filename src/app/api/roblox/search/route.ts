import { previewBotRequest } from "@/preview/server";

export async function GET(request: Request) {
  const keyword = new URL(request.url).searchParams.get("keyword") || "";
  return previewBotRequest("preview_roblox_search", { keyword });
}
