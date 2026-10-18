/**
 * A small keyed cache for client-side GETs: - a fresh entry (inside its TTL) is
 * returned without a network request; - a request already in flight for the
 * same key is awaited, not duplicated; - writes invalidate by prefix, so saving
 * a panel drops every panel read.
 *
 * Deliberately not a data-fetching library (no revalidation, subscriptions or
 * suspense); it fits the existing `await`-a-JSON-body call sites.
 */

type Entry = {
  /** Resolved body, present once a fetch has succeeded. */
  value?: unknown;
  /** When `value` was stored. */
  storedAt: number;
  /** In-flight request, so concurrent callers share one round trip. */
  inFlight?: Promise<unknown>;
};

const store = new Map<string, Entry>();

/** Long enough that flicking between tabs is free, short enough that a change
 *  made in Discord shows up without a hard reload. */
export const DEFAULT_TTL_MS = 30_000;

/** Bounded so a long session cannot grow the map without limit. */
const MAX_ENTRIES = 200;

function remember(key: string, entry: Entry) {
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    // Oldest insertion first: Map preserves insertion order.
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }
  store.set(key, entry);
}

export type CachedJsonOptions = {
  ttlMs?: number;
  /** Skip the cache and refill it — for an explicit "Refresh". */
  force?: boolean;
  signal?: AbortSignal;
  /** Separate authenticated viewers without changing the request URL. */
  scope?: string;
};

function storageKey(url: string, scope?: string): string {
  return scope === undefined ? url : `${url}\u0000${scope}`;
}

/**
 * GETs `url` as JSON, reusing a fresh cached body. Throws on a non-ok response
 * and caches nothing then.
 */
export async function cachedJson<T = unknown>(
  url: string,
  options: CachedJsonOptions = {},
): Promise<T> {
  const { ttlMs = DEFAULT_TTL_MS, force = false, signal, scope } = options;
  const key = storageKey(url, scope);
  const existing = store.get(key);

  if (!force && existing) {
    if (existing.inFlight) return existing.inFlight as Promise<T>;
    if (existing.value !== undefined && Date.now() - existing.storedAt < ttlMs) {
      return existing.value as T;
    }
  }

  const request = (async () => {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      // Drop the entry so the next caller retries rather than inheriting a
      // failed promise.
      const error = new Error(`Request failed: ${response.status}`) as Error & {
        status?: number;
      };
      error.status = response.status;
      throw error;
    }
    const body = (await response.json()) as T;
    remember(key, { value: body, storedAt: Date.now() });
    return body;
  })();

  remember(key, {
    ...(existing?.value !== undefined
      ? { value: existing.value, storedAt: existing.storedAt }
      : { storedAt: Date.now() }),
    inFlight: request,
  });

  try {
    return await request;
  } catch (error) {
    const current = store.get(key);
    if (current?.inFlight === request) store.delete(key);
    throw error;
  }
}

/** Whether a cached body exists and is still inside `ttlMs`. */
export function isFresh(url: string, ttlMs: number = DEFAULT_TTL_MS, scope?: string): boolean {
  const entry = store.get(storageKey(url, scope));
  return Boolean(
    entry && entry.value !== undefined && Date.now() - entry.storedAt < ttlMs,
  );
}

/** Read a cached body without triggering a request. */
export function peekCached<T = unknown>(url: string, scope?: string): T | undefined {
  return store.get(storageKey(url, scope))?.value as T | undefined;
}

/**
 * Forgets everything whose key starts with `prefix`. Call after a write, or a
 * navigation back would show the old value.
 */
export function invalidateCache(prefix: string): number {
  let dropped = 0;
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      dropped += 1;
    }
  }
  return dropped;
}

/** Test seam. */
export function clearCache(): void {
  store.clear();
}
