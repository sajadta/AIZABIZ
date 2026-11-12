// Shared HTTP helpers with retry/backoff used by the market data and brokerage layers.

export async function resilientFetch(
  url: string,
  options: RequestInit = {},
  retries = 2,
  timeoutMs = 8000
): Promise<globalThis.Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const curTimeout = attempt > 0 ? 5000 : timeoutMs;
    const timer = setTimeout(() => {
      try {
        controller.abort(new Error(`Request timeout after ${curTimeout}ms`));
      } catch {
        // Ignored
      }
    }, curTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response.ok) {
        return response;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (err: any) {
      clearTimeout(timer);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      if (process.env.DEBUG_UPSTOX_FETCH) {
        if (err.name === "AbortError") {
          console.debug(`[resilientFetch] Request to ${url} timed out after ${curTimeout}ms`);
        } else {
          console.debug(`[resilientFetch] Failed to fetch ${url}:`, err.message);
        }
      }
      break;
    }
  }
  return null;
}

export async function resilientFetchJson<T = any>(
  url: string,
  options: RequestInit = {},
  retries = 1,
  timeoutMs = 6000
): Promise<T | null> {
  try {
    const res = await resilientFetch(url, options, retries, timeoutMs);
    if (!res) return null;
    return (await res.json().catch(() => null)) as T | null;
  } catch {
    return null;
  }
}
