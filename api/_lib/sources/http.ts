const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 1_000;

export type FetchTextOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export async function fetchText(url: string, options: FetchTextOptions = {}): Promise<string> {
  const response = await fetchWithRetry(url, options);
  return response.text();
}

export async function fetchJson<T>(url: string, options: FetchTextOptions = {}): Promise<T> {
  const response = await fetchWithRetry(url, options);
  return (await response.json()) as T;
}

async function fetchWithRetry(url: string, options: FetchTextOptions): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: options.headers,
        signal: controller.signal,
      });

      if (response.ok) return response;
      if (response.status < 500 || attempt === 1) {
        throw new Error(`GET ${url} failed with ${response.status}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt === 1) break;
    } finally {
      clearTimeout(timeout);
    }

    await sleep(RETRY_DELAY_MS);
  }

  throw lastError instanceof Error ? lastError : new Error(`GET ${url} failed`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
