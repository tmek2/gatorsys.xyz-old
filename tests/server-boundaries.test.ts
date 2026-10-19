import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function load(file: string, mocks: Record<string, unknown>) {
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} as Record<string, any> };
  new Function("require", "module", "exports", source)(
    (name: string) => name in mocks ? mocks[name] : require(name), module, module.exports,
  );
  return module.exports;
}

test("malformed successful bot responses become a recoverable error", async () => {
  const { relayBotResponse } = load("src/utils/manage-api.ts", {
    "@/preview/server": {}, "./long-ids": {},
  });
  const original = console.error;
  console.error = () => {};
  try {
    const result = await relayBotResponse(new Response("<html>upstream failed</html>"));
    assert.equal(result.status, 502);
    assert.match((await result.json()).message, /invalid response/);
    for (const status of [204, 205, 304]) {
      const empty = await relayBotResponse(new Response(null, { status }));
      assert.equal(empty.status, status);
      assert.equal(await empty.text(), "");
    }
  } finally { console.error = original; }
});

test("preview dashboard reads and writes use the local dispatcher without a network fallback", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Preview attempted an external request"); };
  const calls: unknown[][] = [];
  try {
    const { botDashboardGet, botDashboardPost } = load("src/utils/manage-api.ts", {
      "./long-ids": {},
      "@/preview/server": { previewBotRequest: async (...args: unknown[]) => { calls.push(args); return Response.json({ preview: true }); } },
    });
    assert.equal((await botDashboardGet("dashboard_meta", { server: "test-server" })).status, 200);
    assert.equal((await botDashboardPost("dashboard_config", { server: "test-server" }, { set: { enabled: false } })).status, 200);
    assert.deepEqual(calls, [["dashboard_meta", { server: "test-server" }], ["dashboard_config", { server: "test-server" }, { set: { enabled: false } }, "POST"]]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("preview cache reads and writes never open Redis even with a configured live URL", async () => {
  const originalUrl = process.env.REDIS_URL;
  process.env.REDIS_URL = "redis://cache.example.test";
  let connections = 0;
  try {
    const cache = load("src/utils/redis.ts", {
      redis: { createClient: () => ({ on() {}, connect: () => { connections += 1; throw new Error("Preview must not connect to Redis"); } }) },
    });
    assert.equal(await cache.getCached("test"), null);
    assert.equal(await cache.setCached("test", {}), undefined);
    assert.equal(await cache.deleteCached("test"), undefined);
    assert.equal(await cache.readGeneration("test"), 0);
    assert.equal(await cache.bumpGeneration("test"), undefined);
    assert.equal(connections, 0);
  } finally {
    if (originalUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalUrl;
  }
});

type ImageReply = { status?: number; location?: string; chunks?: Buffer[]; type?: string };

function imageTransport(replies: ImageReply[], address = "93.184.215.14") {
  const calls: { url: URL; options: any }[] = [];
  const request = (url: URL, options: any, callback: (response: any) => void) => {
    calls.push({ url, options });
    const pending = new EventEmitter() as EventEmitter & { end(): void };
    pending.end = () => queueMicrotask(() => {
      const reply = replies.shift();
      assert.ok(reply, "an unexpected request reached the network adapter");
      const response = new EventEmitter() as any;
      response.statusCode = reply.status ?? 200;
      response.headers = { "content-type": reply.type ?? "image/png", location: reply.location };
      let closed = false;
      response.destroy = (error?: Error) => {
        closed = true;
        if (error) response.emit("error", error);
      };
      callback(response);
      for (const chunk of reply.chunks ?? [Buffer.from("test image")]) {
        if (!closed) response.emit("data", chunk);
      }
      if (!closed) response.emit("end");
    });
    return pending;
  };
  const api = load("src/server/remote-image.ts", {
    "node:dns/promises": { lookup: async () => [{ address, family: 4 }] },
    "node:http": { request }, "node:https": { request },
  });
  return { api, calls };
}

test("image download connects to the same public address that was checked", async () => {
  const { api, calls } = imageTransport([{}]);
  assert.equal(Buffer.from((await api.fetchRemoteImage(new URL("https://images.example/picture"))).body).toString(), "test image");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.agent, false);
  calls[0].options.lookup("changed.example", {}, (error: unknown, address: string, family: number) => {
    assert.equal(error, null);
    assert.equal(address, "93.184.215.14");
    assert.equal(family, 4);
  });
});

test("a redirect into a private network is rejected before another connection", async () => {
  const { api, calls } = imageTransport([{ status: 302, location: "http://127.0.0.1/private" }]);
  await assert.rejects(api.fetchRemoteImage(new URL("https://images.example/picture")), /not allowed/);
  assert.equal(calls.length, 1);
});

test("private DNS answers are never connected to", async () => {
  const { api, calls } = imageTransport([], "10.0.0.4");
  await assert.rejects(api.fetchRemoteImage(new URL("https://images.example/picture")), /not allowed/);
  assert.equal(calls.length, 0);
});

test("download byte limits apply even without a content length", async () => {
  const { api } = imageTransport([{ chunks: [Buffer.alloc(6 * 1024 * 1024), Buffer.alloc(5 * 1024 * 1024)] }]);
  await assert.rejects(api.fetchRemoteImage(new URL("https://images.example/picture")), /too large/);
});

test("image proxy rejects a non-image response", async () => {
  const { api } = imageTransport([{ type: "text/html" }]);
  await assert.rejects(api.fetchRemoteImage(new URL("https://images.example/picture")), /could not be loaded/);
});
