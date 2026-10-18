import { NextResponse } from "next/server";
import { fetchRemoteImage } from "@/server/remote-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("url")?.trim();
  if (!source || source.length > 2048) {
    return NextResponse.json({ message: "Invalid image URL" }, { status: 400 });
  }
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return NextResponse.json({ message: "Invalid image URL" }, { status: 400 });
  }
  try {
    const image = await fetchRemoteImage(url);
    return new Response(new Uint8Array(image.body), {
      headers: {
        "Content-Type": image.type,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image could not be loaded";
    const status = message === "Image host is not allowed" ? 400 : message === "Image is too large" ? 413 : 422;
    return NextResponse.json({ message: status === 422 ? "Image could not be loaded" : message }, { status });
  }
}
