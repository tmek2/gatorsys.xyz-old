class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`HTTP error! status: ${status}`);
    this.name = "HttpError";
    this.status = status;
  }
}

function pause(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/** Retry reads on network failures, rate limits and server errors.
 * `retries` includes the first request. */
export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  retries = 3,
  retryOptions: { timeoutMs?: number; retryDelayMs?: number } = {},
): Promise<T> {
  const timeoutMs = retryOptions.timeoutMs ?? 8_000;
  const retryDelayMs = retryOptions.retryDelayMs ?? 350;

  const attempts = Math.max(1, Math.floor(retries));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    options.signal?.throwIfAborted();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromCaller = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abortFromCaller, { once: true });
    let delay = retryDelayMs * (attempt + 1);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) {
        if (response.status === 429) {
          const header = response.headers.get("Retry-After");
          const seconds = Number(header);
          const requested = header && Number.isNaN(seconds)
            ? Date.parse(header) - Date.now()
            : (header ? seconds : 1) * 1000;
          // A remote server cannot keep this request asleep indefinitely.
          delay = Number.isFinite(requested) ? Math.max(0, Math.min(requested, timeoutMs)) : delay;
        }
        await response.body?.cancel();
        throw new HttpError(response.status);
      }
      return await response.json();
    } catch (error) {
      options.signal?.throwIfAborted();
      const permanent = error instanceof HttpError && error.status !== 429 && error.status < 500;
      if (permanent || error instanceof SyntaxError || attempt === attempts - 1) throw error;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromCaller);
    }
    await pause(delay, options.signal);
  }
  throw new Error('Max retries reached');
}
