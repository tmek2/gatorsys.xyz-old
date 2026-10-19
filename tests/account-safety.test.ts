import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { localRedirectTarget } from "../src/utils/local-redirect.ts";

function load(path: string, dependencies: Record<string, unknown>, fetcher?: typeof fetch) {
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} as Record<string, any> };
  new Function("require", "module", "exports", "fetch", code)(
    (name: string) => { assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name]; },
    module, module.exports, fetcher,
  );
  return module.exports;
}

test("preview Roblox adapters use the local fixture service for both lookup and search", async () => {
  const calls: unknown[][] = [];
  const transport = { previewBotRequest: async (...args: unknown[]) => { calls.push(args); return Response.json({ username: "PreviewPlayer", avatarUrl: "/icon.svg" }); } };
  const unexpectedFetch = async () => { throw new Error("Preview Roblox must not contact a real service"); };
  const lookup = load("src/app/api/roblox/route.ts", { "@/preview/server": transport }, unexpectedFetch).GET;
  const search = load("src/app/api/roblox/search/route.ts", { "@/preview/server": transport }, unexpectedFetch).GET;
  const response = await lookup(new Request("https://website.example/api/roblox?id=1001001"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { username: "PreviewPlayer", avatarUrl: "/icon.svg" });
  await search(new Request("https://website.example/api/roblox/search?keyword=Preview%20Builder"));
  assert.deepEqual(calls, [["preview_roblox_user", { id: "1001001" }], ["preview_roblox_search", { keyword: "Preview Builder" }]]);
});

test("unknown preview Roblox identities fail locally without an external fallback", async () => {
  let calls = 0;
  const get = load("src/app/api/roblox/route.ts", {
    "@/preview/server": { previewBotRequest: async () => { calls += 1; return Response.json({ message: "Preview Roblox user not found" }, { status: 404 }); } },
  }, async () => { throw new Error("Unexpected network request"); }).GET;
  for (const id of ["", "123/../users", "1&userIds=2", "unknown"]) {
    const response = await get(new Request(`https://website.example/api/roblox?id=${encodeURIComponent(id)}`));
    assert.equal(response.status, 404);
    assert.match((await response.json()).message, /not found/);
  }
  assert.equal(calls, 4);
});

test("account return targets reject external and browser-normalized cross-origin URLs", () => {
  for (const value of [undefined, "", "//outside.example/path", "/\\outside.example/path", "https://outside.example", "javascript:bad()", "/\n/outside.example", "/\t/outside.example"]) {
    assert.equal(localRedirectTarget(value), "/servers", String(value));
  }
  assert.equal(localRedirectTarget("/account"), "/account");
  assert.equal(localRedirectTarget("/manage/123/resources?tab=documents#notes"), "/manage/123/resources?tab=documents#notes");
});
