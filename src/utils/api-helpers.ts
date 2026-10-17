export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  retries = 3,
  retryOptions: { timeoutMs?: number; retryDelayMs?: number } = {},
): Promise<T> {
  const timeoutMs = retryOptions.timeoutMs ?? 8_000;
  const retryDelayMs = retryOptions.retryDelayMs ?? 350;

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromCaller = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abortFromCaller, { once: true });

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (response.status === 429) {
        const delay = parseInt(response.headers.get("Retry-After") || "1", 10) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        if (response.status < 500 || i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * (i + 1)));
        continue;
      }
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, retryDelayMs * (i + 1)));
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromCaller);
    }
  }
  throw new Error('Max retries reached');
}
