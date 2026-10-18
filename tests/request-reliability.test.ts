import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithRetry } from "../src/utils/api-helpers.ts";

test("permission failures are returned after one attempt", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response("denied", { status: 403 }); };
  try {
    await assert.rejects(fetchWithRetry("https://example.test", {}, 3, { retryDelayMs: 1 }), /status: 403/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("a temporary failure can recover on the next attempt", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1
    ? new Response("unavailable", { status: 503 })
    : Response.json({ ready: true });
  try {
    assert.deepEqual(await fetchWithRetry("https://example.test", {}, 2, { retryDelayMs: 1 }), { ready: true });
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test("an already cancelled request never reaches the network", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({}); };
  try {
    const controller = new AbortController();
    controller.abort(new Error("cancelled by caller"));
    await assert.rejects(fetchWithRetry("https://example.test", { signal: controller.signal }), /cancelled by caller/);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test("the final rate limit response does not start another delay or request", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response(null, { status: 429, headers: { 'Retry-After': '999999' } }); };
  try {
    await assert.rejects(fetchWithRetry("https://example.test", {}, 1), /status: 429/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
