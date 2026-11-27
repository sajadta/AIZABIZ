// Short-lived cache for today's Upstox order book (used by live position marks).
let cachedLiveOrders: { token: string; fetchedAt: number; orders: any[] } = {
  token: '',
  fetchedAt: 0,
  orders: [],
};

export function invalidateCachedLiveDayOrders() {
  cachedLiveOrders.fetchedAt = 0;
}

export async function getCachedLiveDayOrders(token: string, maxAgeMs = 2500): Promise<any[]> {
  if (!token) return [];
  if (cachedLiveOrders.token === token && Date.now() - cachedLiveOrders.fetchedAt < maxAgeMs) {
    return cachedLiveOrders.orders;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://api.upstox.com/v2/order/retrieve-all', {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Api-Version': '2.0',
      },
    });
    clearTimeout(timer);
    if (res.ok) {
      const json: any = await res.json().catch(() => null);
      if (json?.status === 'success' && Array.isArray(json?.data)) {
        cachedLiveOrders = {
          token,
          fetchedAt: Date.now(),
          orders: json.data,
        };
        return json.data;
      }
    }
  } catch {
    // Retain last cached day orders on transient network hiccup
  }
  return cachedLiveOrders.token === token ? cachedLiveOrders.orders : [];
}
