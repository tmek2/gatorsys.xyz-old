import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80:")) return true;
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return false;
  const [, aRaw, bRaw] = match;
  const a = Number(aRaw);
  const b = Number(bRaw);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

async function isPublicRemoteUrl(url: URL): Promise<boolean> {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) return false;
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  return Boolean(addresses.length) && addresses.every(({ address }) => !isPrivateAddress(address));
}

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
    let currentUrl = url;
    let response: Response | null = null;
    for (let redirectCount = 0; redirectCount < 4; redirectCount += 1) {
      if (!(await isPublicRemoteUrl(currentUrl))) {
        return NextResponse.json({ message: "Image host is not allowed" }, { status: 400 });
      }
      response = await fetch(currentUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.5",
          "User-Agent": "Gator image preview/1.0",
        },
      });
      if (response.status < 300 || response.status >= 400) break;
      const location = response.headers.get("location");
      if (!location) break;
      currentUrl = new URL(location, currentUrl);
      response = null;
    }
    if (!response) {
      return NextResponse.json({ message: "Image redirected too many times" }, { status: 422 });
    }
    const contentType = response.headers.get("content-type") || "";
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (!response.ok || !contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ message: "Image could not be loaded" }, { status: 422 });
    }
    if (contentLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ message: "Image is too large" }, { status: 413 });
    }
    return new Response(response.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ message: "Image could not be loaded" }, { status: 422 });
  }
}
