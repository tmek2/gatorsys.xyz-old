import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const privateNetworks = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
  ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) privateNetworks.addSubnet(address, prefix);
const globalIPv6 = new BlockList();
globalIPv6.addSubnet("2000::", 3, "ipv6");
privateNetworks.addSubnet("2001:db8::", 32, "ipv6");
privateNetworks.addSubnet("2001::", 32, "ipv6");
privateNetworks.addSubnet("2002::", 16, "ipv6");

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (!family) return false;
  if (privateNetworks.check(address, family === 4 ? "ipv4" : "ipv6")) return false;
  return family === 4 || globalIPv6.check(address, "ipv6");
}

export function isRemoteImageUrl(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
    && host !== "localhost" && !host.endsWith(".localhost") && !host.endsWith(".local");
}

function withAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

/** Resolve once, then pin that address to the connection. Checking DNS and
 * fetching separately lets a hostile host switch to a private address. */
async function requestImage(url: URL, signal: AbortSignal) {
  if (!isRemoteImageUrl(url)) throw new Error("Image host is not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await withAbort(lookup(host, { all: true, verbatim: true }), signal);
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("Image host is not allowed");
  }
  const address = addresses[0];
  return new Promise<{ status: number; location?: string; type: string; body: Uint8Array }>((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      signal,
      agent: false,
      family: address.family,
      lookup: (_host, _options, callback) => callback(null, address.address, address.family),
      headers: { Accept: "image/*", "User-Agent": "Dashboard image preview/1.0" },
    }, (response) => {
      const status = response.statusCode ?? 502;
      if (status >= 300 && status < 400) {
        response.destroy();
        resolve({ status, location: response.headers.location, type: "", body: new Uint8Array() });
        return;
      }
      const type = response.headers['content-type'] ?? "";
      if (status < 200 || status >= 300 || !type.toLowerCase().startsWith("image/")) {
        response.destroy();
        reject(new Error("Image could not be loaded"));
        return;
      }
      let bytes = 0;
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_IMAGE_BYTES) {
          response.destroy(new Error("Image is too large"));
          return;
        }
        chunks.push(chunk);
      });
      response.once("error", reject);
      response.once("end", () => resolve({ status, type, body: new Uint8Array(Buffer.concat(chunks)) }));
      response.once("aborted", () => reject(new Error("Image download was interrupted")));
    });
    request.once("error", reject);
    request.end();
  });
}

export async function fetchRemoteImage(url: URL) {
  const signal = AbortSignal.timeout(8_000);
  let current = url;
  for (let redirects = 0; redirects < 4; redirects += 1) {
    const result = await requestImage(current, signal);
    if (result.status < 300 || result.status >= 400) return result;
    if (!result.location) throw new Error("Image could not be loaded");
    current = new URL(result.location, current);
  }
  throw new Error("Image redirected too many times");
}
