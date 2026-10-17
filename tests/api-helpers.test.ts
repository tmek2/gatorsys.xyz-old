import assert from "node:assert/strict";
import test from "node:test";

import { fetchWithRetry } from "../src/utils/api-helpers.ts";

test("aborts a stalled request and retries within a bounded time", async () => {
  let attempts = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_url: unknown, init?: RequestInit) => {
    attempts += 1;
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")),
      );
    });
  }) as typeof fetch;

  try {
    const outcome = await Promise.race([
      fetchWithRetry("https://example.test", {}, 2, {
        timeoutMs: 10,
        retryDelayMs: 1,
      }).then(
        () => "resolved",
        () => "rejected",
      ),
      new Promise<string>((resolve) => setTimeout(() => resolve("timed-out"), 100)),
    ]);

    assert.equal(outcome, "rejected");
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
