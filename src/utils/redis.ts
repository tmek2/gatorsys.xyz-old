import { createClient, type RedisClientType } from 'redis';

/**
 * Redis cache helper, hardened for serverless: 1. An unhandled `error` event
 * from node-redis would throw at the process level, so an error handler logs
 * dropped connections instead. 2. A Redis that accepts the socket but stops
 * answering would hang the request until the platform kills it, so every
 * operation races a short timeout, and any failure degrades to "no cache".
 */

let redisClient: RedisClientType | null = null;
let redisConnection: Promise<RedisClientType | null> | null = null;

const OP_TIMEOUT_MS = 1500;

async function getRedisClient() {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (!redisConnection) {
    const client = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 3000,
        // Bounded reconnect: give up after a few tries instead of looping and
        // holding requests. A null return means "cache off" for this instance.
        reconnectStrategy: (retries) => (retries > 3 ? false : Math.min(retries * 200, 800)),
      },
    });
    // MUST have an error listener — without it node-redis throws 'error'
    // events as uncaught exceptions.
    client.on("error", (error) => {
      console.error("[redis] client error:", (error as Error)?.message || error);
    });
    redisClient = client as RedisClientType;
    redisConnection = client
      .connect()
      .then(() => redisClient)
      .catch((error) => {
        console.error("Redis connection failed:", error);
        redisClient = null;
        redisConnection = null;
        return null;
      });
  }

  return redisConnection;
}

/** Race a Redis op against a timeout so a stalled server can never hang the
 *  request. Any failure resolves to the fallback. */
async function withTimeout<T>(op: Promise<T>, fallback: T): Promise<T> {
  try {
    return await Promise.race([
      op,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), OP_TIMEOUT_MS)),
    ]);
  } catch (error) {
    console.error("[redis] op failed:", (error as Error)?.message || error);
    return fallback;
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  const client = await getRedisClient().catch(() => null);
  if (!client) {
    return null;
  }
  const data = await withTimeout(client.get(key), null);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function setCached(key: string, data: any, expirationSeconds = 3600) {
  const client = await getRedisClient().catch(() => null);
  if (!client) {
    return;
  }
  await withTimeout(client.set(key, JSON.stringify(data), { EX: expirationSeconds }), undefined);
}

export async function deleteCached(...keys: string[]) {
  const client = await getRedisClient().catch(() => null);
  if (!client || keys.length === 0) {
    return;
  }
  await withTimeout(client.del(keys), undefined);
}

/**
 * A generation counter that makes every key built from it stale at once. Used
 * for per-user cache keys (needed where authorization is decided per request):
 * bumping the generation on write changes the key for everyone, and orphaned
 * entries expire on their own. If Redis is unreachable this returns 0, which is
 * fine since there is no cache to serve from then.
 */
export async function readGeneration(key: string): Promise<number> {
  const client = await getRedisClient().catch(() => null);
  if (!client) return 0;
  const raw = await withTimeout(client.get(key), null);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Bump a generation. INCR so two saves landing together cannot lose one. */
export async function bumpGeneration(key: string, expirationSeconds = 86_400) {
  const client = await getRedisClient().catch(() => null);
  if (!client) return;
  const next = await withTimeout(client.incr(key), null);
  // Kept alive only as long as anything could still be keyed off it. Without
  // an expiry these accumulate one per guild forever.
  if (next !== null) await withTimeout(client.expire(key, expirationSeconds), undefined);
}
