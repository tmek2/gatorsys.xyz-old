import assert from "node:assert/strict";
import test from "node:test";

import {
  cachedJson,
  clearCache,
  invalidateCache,
  isFresh,
  peekCached,
} from "../src/utils/client-cache.ts";

type FakeResponse = { ok: boolean; status: number; json: () => Promise<unknown> };

/** Counts calls so "did this hit the network" is a fact, not an assumption. */
function stubFetch(handler: (url: string) => FakeResponse | Promise<FakeResponse>) {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: unknown) => {
    calls.push(String(url));
    return handler(String(url));
  }) as typeof globalThis.fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const ok = (body: unknown): FakeResponse => ({
  ok: true,
  status: 200,
  json: async () => body,
});

test("a second read inside the TTL does not touch the network", async () => {
  clearCache();
  const stub = stubFetch(() => ok({ config: { a: 1 } }));
  try {
    const first = await cachedJson("/api/manage/1/config");
    const second = await cachedJson("/api/manage/1/config");

    assert.deepEqual(first, { config: { a: 1 } });
    assert.deepEqual(second, first);
    assert.equal(stub.calls.length, 1, "the body should come from the cache");
    assert.equal(isFresh("/api/manage/1/config"), true);
  } finally {
    stub.restore();
  }
});

test("an expired entry is refetched", async () => {
  clearCache();
  const stub = stubFetch(() => ok({ n: 1 }));
  try {
    await cachedJson("/api/x", { ttlMs: 0 });
    await cachedJson("/api/x", { ttlMs: 0 });
    assert.equal(stub.calls.length, 2);
    assert.equal(isFresh("/api/x", 0), false);
  } finally {
    stub.restore();
  }
});

test("concurrent readers of one key share a single request", async () => {
  clearCache();
  let release: (value: FakeResponse) => void = () => {};
  const pending = new Promise<FakeResponse>((resolve) => {
    release = resolve;
  });
  const stub = stubFetch(() => pending);
  try {
    // Several components mounting at once is the normal case in the dashboard,
    // and each one used to fire its own copy of the same GET.
    const all = Promise.all([
      cachedJson("/api/manage/1/meta"),
      cachedJson("/api/manage/1/meta"),
      cachedJson("/api/manage/1/meta"),
    ]);
    release(ok({ name: "guild" }));
    const results = await all;

    assert.equal(stub.calls.length, 1, "one round trip for three callers");
    for (const result of results) assert.deepEqual(result, { name: "guild" });
  } finally {
    stub.restore();
  }
});

test("force bypasses a fresh entry", async () => {
  clearCache();
  let value = 1;
  const stub = stubFetch(() => ok({ value: value++ }));
  try {
    assert.deepEqual(await cachedJson("/api/y"), { value: 1 });
    assert.deepEqual(await cachedJson("/api/y", { force: true }), { value: 2 });
    assert.equal(stub.calls.length, 2);
    // The forced result replaces what was cached.
    assert.deepEqual(peekCached("/api/y"), { value: 2 });
  } finally {
    stub.restore();
  }
});

test("a failure is not remembered", async () => {
  clearCache();
  let fail = true;
  const stub = stubFetch(() =>
    fail
      ? { ok: false, status: 500, json: async () => ({}) }
      : ok({ recovered: true }),
  );
  try {
    // Caching an error for 30 seconds would turn one blip into a dead tab.
    await assert.rejects(() => cachedJson("/api/z"), /Request failed: 500/);
    assert.equal(isFresh("/api/z"), false);
    fail = false;
    assert.deepEqual(await cachedJson("/api/z"), { recovered: true });
    assert.equal(stub.calls.length, 2);
  } finally {
    stub.restore();
  }
});

test("the status code survives so 403 can be told apart from a real failure", async () => {
  clearCache();
  const stub = stubFetch(() => ({ ok: false, status: 403, json: async () => ({}) }));
  try {
    await assert.rejects(
      () => cachedJson("/api/forbidden"),
      (error: Error & { status?: number }) => error.status === 403,
    );
  } finally {
    stub.restore();
  }
});

test("a write invalidates every read under its prefix", async () => {
  clearCache();
  const stub = stubFetch((url) => ok({ url }));
  try {
    await cachedJson("/api/manage/1/config");
    await cachedJson("/api/manage/1/meta");
    await cachedJson("/api/manage/2/config");

    const dropped = invalidateCache("/api/manage/1");

    assert.equal(dropped, 2);
    assert.equal(isFresh("/api/manage/1/config"), false);
    assert.equal(isFresh("/api/manage/1/meta"), false);
    // A different guild is untouched.
    assert.equal(isFresh("/api/manage/2/config"), true);
  } finally {
    stub.restore();
  }
});

test("the cache is bounded", async () => {
  clearCache();
  const stub = stubFetch((url) => ok({ url }));
  try {
    for (let index = 0; index < 260; index += 1) {
      await cachedJson(`/api/bounded/${index}`);
    }
    // The oldest keys are evicted rather than the map growing forever.
    assert.equal(isFresh("/api/bounded/0"), false);
    assert.equal(isFresh("/api/bounded/259"), true);
  } finally {
    stub.restore();
  }
});
