import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { localRedirectTarget } from "../src/utils/local-redirect.ts";

function load(path: string, dependencies: Record<string, unknown>, fetcher?: typeof fetch, timeouts?: number[]) {
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} as Record<string, any> };
  new Function("require", "module", "exports", "fetch", "setTimeout", "clearTimeout", code)(
    (name: string) => { assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name]; },
    module, module.exports, fetcher,
    (callback: () => void, ms: number) => { timeouts?.push(ms); return setTimeout(callback, timeouts ? 5 : ms); },
    clearTimeout,
  );
  return module.exports;
}

function roblox(fetcher: typeof fetch, timeouts?: number[]) {
  const api = load("src/utils/api-helpers.ts", {}, fetcher, timeouts);
  return load("src/app/api/roblox/route.ts", {
    "next/server": { NextResponse: { json: Response.json } },
    "@/utils/api-helpers": api,
  }).GET as (request: Request) => Promise<Response>;
}

const request = (id: string) => new Request(`https://website.example/api/roblox?id=${encodeURIComponent(id)}`);

test("Roblox lookup rejects missing, nonnumeric and path-like IDs before making a request", async () => {
  let calls = 0;
  const get = roblox(async () => { calls += 1; throw new Error("Unexpected network"); });
  for (const id of ["", "0", "-1", "1.5", "123/../users", "1&userIds=2", "1e4", "123456789012345678901"]) {
    assert.equal((await get(request(id))).status, 400, id);
  }
  assert.equal(calls, 0);
});

test("Roblox lookup returns a user's name even if their headshot is missing or unavailable", async () => {
  for (const avatar of [{ data: [] }, {}, { data: [{ imageUrl: "javascript:bad()" }] }, null]) {
    const get = roblox(async (url) => String(url).includes("thumbnails.")
      ? avatar === null ? Response.json({}, { status: 503 }) : Response.json(avatar)
      : Response.json({ name: "PreviewPlayer" }));
    const response = await get(request("12345"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { username: "PreviewPlayer", avatarUrl: null });
  }
  const get = roblox(async (url) => Response.json(String(url).includes("thumbnails.")
    ? { data: [{ imageUrl: "https://images.example/avatar.png" }] } : { name: "PreviewPlayer" }));
  assert.deepEqual(await (await get(request("12345"))).json(), { username: "PreviewPlayer", avatarUrl: "https://images.example/avatar.png" });
});

test("Roblox lookup preserves not-found status and turns failures or malformed users into recoverable errors", async () => {
  for (const [upstream, expected] of [[404, 404], [429, 503], [500, 502]] as const) {
    let calls = 0;
    const get = roblox(async () => { calls += 1; return Response.json({ errors: ["private upstream diagnostic"] }, { status: upstream }); });
    const response = await get(request("12345"));
    assert.equal(response.status, expected);
    assert.equal(calls, 1);
    assert.doesNotMatch(await response.text(), /private upstream diagnostic/);
  }
  for (const body of [{}, { name: null }, { name: "" }]) {
    const get = roblox(async () => Response.json(body));
    assert.equal((await get(request("12345"))).status, 502);
  }
});

test("Roblox deadlines include both stalled response headers and a stalled JSON body", async () => {
  for (const stalled of ["headers", "body"]) {
    const deadlines: number[] = [];
    let signal: AbortSignal;
    const get = roblox(async (_url, init) => {
      signal = init!.signal!;
      if (stalled === "headers") return new Promise<Response>((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
      return new Response(new ReadableStream({
        start(stream) { signal.addEventListener("abort", () => stream.error(signal.reason), { once: true }); },
      }), { headers: { "Content-Type": "application/json" } });
    }, deadlines);
    const response = await get(request("12345"));
    assert.equal(response.status, 504, stalled);
    assert.equal(signal!.aborted, true);
    assert.deepEqual(deadlines, [4000]);
  }
});

test("account return targets reject external and browser-normalized cross-origin URLs", () => {
  for (const value of [undefined, "", "//outside.example/path", "/\\outside.example/path", "https://outside.example", "javascript:bad()", "/\n/outside.example", "/\t/outside.example"]) {
    assert.equal(localRedirectTarget(value), "/servers", String(value));
  }
  assert.equal(localRedirectTarget("/account"), "/account");
  assert.equal(localRedirectTarget("/manage/123/resources?tab=documents#notes"), "/manage/123/resources?tab=documents#notes");
});
