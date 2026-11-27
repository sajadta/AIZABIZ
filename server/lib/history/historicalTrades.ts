// Cached FY-to-date historical trades, paired via the FIFO historical matcher.
import type { NormalizedTradeHistoryEntry } from '../upstoxHistory';
import { getTodayIstDateString, getCurrentIndianFinancialYearStart } from './timeUtils';
import { pairHistoricalUpstoxTrades } from './pairHistorical';

let cachedHistoricalSummary: {
  token: string;
  fetchedAt: number;
  trades: NormalizedTradeHistoryEntry[];
} = { token: '', fetchedAt: 0, trades: [] };

async function fetchPaginatedHistoricalSegment(
  token: string,
  segment: 'FO' | 'EQ',
  startDate: string,
  endDate: string,
): Promise<any[]> {
  const all: any[] = [];
  const pageSize = 500;
  for (let page = 1; page <= 10; page++) {
    const url = `https://api.upstox.com/v2/charges/historical-trades?segment=${segment}&start_date=${startDate}&end_date=${endDate}&page_number=${page}&page_size=${pageSize}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Api-Version': '2.0',
      },
    });
    if (!res.ok) break;
    const json: any = await res.json().catch(() => null);
    const list = Array.isArray(json?.data) ? json.data : [];
    if (list.length === 0) break;
    all.push(...list);
    if (list.length < pageSize) break;
  }
  return all;
}

export async function getCachedHistoricalUpstoxTrades(
  token: string,
  forceRefresh = false,
): Promise<NormalizedTradeHistoryEntry[]> {
  if (!token) return [];
  const isFresh =
    !forceRefresh &&
    cachedHistoricalSummary.token === token &&
    Date.now() - cachedHistoricalSummary.fetchedAt < 5 * 60 * 1000 &&
    cachedHistoricalSummary.trades.length > 0;
  if (isFresh) {
    return cachedHistoricalSummary.trades;
  }

  const todayIst = getTodayIstDateString();
  const startDate = getCurrentIndianFinancialYearStart(todayIst);

  try {
    const [foTrades, eqTrades] = await Promise.all([
      fetchPaginatedHistoricalSegment(token, 'FO', startDate, todayIst).catch(() => []),
      fetchPaginatedHistoricalSegment(token, 'EQ', startDate, todayIst).catch(() => []),
    ]);
    const paired = pairHistoricalUpstoxTrades(foTrades, eqTrades, todayIst);
    if (paired.length > 0 || foTrades.length > 0 || eqTrades.length > 0) {
      cachedHistoricalSummary = {
        token,
        fetchedAt: Date.now(),
        trades: paired,
      };
    }
    return cachedHistoricalSummary.trades;
  } catch {
    return cachedHistoricalSummary.token === token ? cachedHistoricalSummary.trades : [];
  }
}
