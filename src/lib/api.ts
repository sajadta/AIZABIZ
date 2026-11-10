export type ApiRequestConfig = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

export async function requestJson<T>(url: string, config: ApiRequestConfig = {}): Promise<T> {
  const response = await fetch(url, {
    method: config.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
    body: config.body !== undefined ? JSON.stringify(config.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
