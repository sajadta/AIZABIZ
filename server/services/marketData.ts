// Central market-data service: Upstox quote polling, normalization, and
// the Yahoo/NSE fallback used when Upstox is rate-limited or unauthenticated.
import { upstoxConfig, invalidTokens, paperPositions, subscribedKeys, getLastQuotesCache, setLastQuotesCache } from "../state";
import { globalLiveQuotes } from "../state";
import { getInstrumentKey } from "../lib/instruments";
import { resilientFetchJson } from "../lib/http";
import { YAHOO_NSE_MAP } from "../data/yahooMap";

let isFetchingCentralQuotes = false;
let lastYahooFallbackQuotes: { timestamp: number; quotes: any[] } = {
  timestamp: 0,
  quotes: [],
};

export function formatUpstoxQuotesToStandardList(upstoxData: any) {
  const list: any[] = [];
  for (const [key, val] of Object.entries(upstoxData || {})) {
    const v = val as any;
    if (!v) continue;
    const parts = key.split(/[:|]/);
    let symbolDisplay = (
      v.symbol && v.symbol !== "NA" ? v.symbol : parts.length > 1 ? parts[1] : key
    ).toUpperCase();
    const canonicalInstrumentKey = getInstrumentKey(
      v.instrument_token || key || symbolDisplay,
    );
    // Standardize index display names so NIFTY 50, BANKNIFTY, FINNIFTY, SENSEX, BANKEX match watchlist & charts seamlessly
    if (canonicalInstrumentKey === "NSE_INDEX|Nifty 50") symbolDisplay = "NIFTY 50";
    else if (canonicalInstrumentKey === "NSE_INDEX|Nifty Bank") symbolDisplay = "BANKNIFTY";
    else if (canonicalInstrumentKey === "NSE_INDEX|Nifty Fin Service") symbolDisplay = "FINNIFTY";
    else if (canonicalInstrumentKey === "BSE_INDEX|SENSEX") symbolDisplay = "SENSEX";
    else if (canonicalInstrumentKey === "BSE_INDEX|BANKEX") symbolDisplay = "BANKEX";
    else if (canonicalInstrumentKey === "NSE_INDEX|NIFTY MID SELECT") symbolDisplay = "MIDCPNIFTY";

    const segment = key.includes("INDEX")
      ? "INDEX"
      : key.includes("FO")
        ? "OPTIONS"
        : "EQUITY";
    const ltp = Number(v.last_price || 0);
    const netChange =
      v.net_change !== undefined && v.net_change !== null
        ? Number(v.net_change)
        : v.ohlc?.close && v.ohlc.close !== ltp
          ? Number((ltp - Number(v.ohlc.close)).toFixed(2))
          : 0;
    const prevClose =
      netChange !== 0
        ? Number((ltp - netChange).toFixed(2))
        : Number(v.ohlc?.close || v.close || ltp);
    const changePercent =
      prevClose > 0
        ? Number(((netChange / prevClose) * 100).toFixed(2))
        : 0;

    if (ltp > 0) {
      globalLiveQuotes[canonicalInstrumentKey] = {
        last_price: ltp,
        net_change: netChange,
        changePercent,
        instrument_token: v.instrument_token || canonicalInstrumentKey,
      };
      globalLiveQuotes[key] = {
        last_price: ltp,
        net_change: netChange,
        changePercent,
        instrument_token: v.instrument_token || canonicalInstrumentKey,
      };
      if (v.instrument_token) {
        globalLiveQuotes[v.instrument_token] = {
          last_price: ltp,
          net_change: netChange,
          changePercent,
          instrument_token: v.instrument_token,
        };
      }
      globalLiveQuotes["last_update"] = new Date().toISOString();
    }
    list.push({
      symbol: symbolDisplay,
      name: symbolDisplay,
      exchange: key.startsWith("BSE") ? "BSE" : "NSE",
      segment,
      instrumentKey: canonicalInstrumentKey,
      ltp,
      change: Number(netChange.toFixed(2)),
      changePercent,
      volume: Number(v.volume || 0),
      open: Number(v.ohlc?.open || v.open || ltp),
      high: Number(v.ohlc?.high || v.high || ltp),
      low: Number(v.ohlc?.low || v.low || ltp),
      close: prevClose,
    });
  }
  // Update paperPositions in-memory on every tick so P&L and P&L% are always live!
  if (paperPositions.length > 0) {
    paperPositions.forEach((pos: any) => {
      const match = list.find(
        (q) => q.instrumentKey === pos.instrumentKey || q.symbol === pos.symbol,
      );
      if (match && match.ltp > 0) {
        if (!(pos.isOption && match.ltp > pos.buyPrice * 50)) {
          pos.currentLTP = match.ltp;
          pos.pnl = Number(((match.ltp - pos.buyPrice) * (pos.quantity || 1)).toFixed(2));
          pos.pnlPercent =
            pos.buyPrice > 0
              ? Number((((match.ltp - pos.buyPrice) / pos.buyPrice) * 100).toFixed(2))
              : 0;
        }
      }
    });
  }
  // Deduplicate list by canonical instrumentKey or symbol to prevent duplicate React keys
  const uniqueMap = new Map<string, any>();
  for (const item of list) {
    const k = item.instrumentKey || item.symbol;
    if (k && !uniqueMap.has(k)) {
      uniqueMap.set(k, item);
    }
  }
  return Array.from(uniqueMap.values());
}

export async function refreshCentralUpstoxQuotes(tokenOverride?: string, customSymbols?: string) {
  const token = tokenOverride || upstoxConfig.accessToken;
  if (!token || invalidTokens.has(token)) return getLastQuotesCache();

  if (!customSymbols && isFetchingCentralQuotes && getLastQuotesCache().quotes.length > 0) {
    return getLastQuotesCache();
  }

  const keysArray = Array.from(subscribedKeys);
  const defaultKeys = [
    "NSE_INDEX|Nifty 50",
    "NSE_INDEX|Nifty Bank",
    "BSE_INDEX|SENSEX",
    "BSE_INDEX|BANKEX",
    "NSE_INDEX|Nifty Fin Service",
    "NSE_EQ|INE002A01018", // RELIANCE
    "NSE_EQ|INE040A01034", // HDFCBANK
    "NSE_EQ|INE467B01029", // TCS
    "NSE_EQ|INE009A01021", // INFY
    "NSE_EQ|INE090A01021", // ICICIBANK
    "NSE_EQ|INE062A01020", // SBI
    "NSE_EQ|INE238A01034", // AXISBANK
    "NSE_EQ|INE030A01027", // HINDUNILVR
    "NSE_EQ|INE154A01025", // ITC
    "NSE_EQ|INE018A01030", // LT
    "NSE_EQ|INE397D01024", // BHARTIARTL
    "NSE_EQ|INE296A01024", // BAJFINANCE
    "NSE_EQ|INE860A01027", // HCLTECH
    "NSE_EQ|INE021A01026", // ASIANPAINT
  ];
  defaultKeys.forEach((k) => {
    if (!keysArray.includes(k)) keysArray.push(k);
  });
  paperPositions.forEach((p: any) => {
    if (p.instrumentKey && !keysArray.includes(p.instrumentKey)) {
      keysArray.push(p.instrumentKey);
    }
  });

  const symbols = customSymbols || keysArray.join(",");
  if (!customSymbols) isFetchingCentralQuotes = true;

  try {
    const response = await fetch(
      `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(symbols)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Api-Version": "2.0",
        },
      },
    );
    if (response.ok) {
      const data = await response.json();
      if (data?.status === "success" && data?.data) {
        const formattedQuotes = formatUpstoxQuotesToStandardList(data.data);
        if (formattedQuotes.length > 0 && !customSymbols) {
          const fallbackQuotes = await fetchRealNseQuotesFallback();
          const mergedMap = new Map<string, any>();
          formattedQuotes.forEach((q: any) => {
            if (q && (q.instrumentKey || q.symbol)) {
              mergedMap.set(q.instrumentKey || q.symbol, q);
            }
          });
          fallbackQuotes.forEach((fb: any) => {
            if (fb && (fb.instrumentKey || fb.symbol)) {
              const key = fb.instrumentKey || fb.symbol;
              if (!mergedMap.has(key) || (mergedMap.get(key)?.ltp || 0) <= 0) {
                mergedMap.set(key, fb);
              }
            }
          });
          const combinedQuotes = Array.from(mergedMap.values());
          setLastQuotesCache({
            timestamp: Date.now(),
            data: data.data,
            quotes: combinedQuotes,
          });
          return { timestamp: Date.now(), data: data.data, quotes: combinedQuotes };
        }
        return { timestamp: Date.now(), data: data.data, quotes: formattedQuotes };
      }
    }
  } catch (e) {
    // Return cached quotes on network/rate-limit hiccup
  } finally {
    if (!customSymbols) isFetchingCentralQuotes = false;
  }
  return getLastQuotesCache();
}



export async function fetchRealNseQuotesFallback(): Promise<any[]> {
  if (lastYahooFallbackQuotes.quotes.length > 0 && Date.now() - lastYahooFallbackQuotes.timestamp < 8000) {
    return lastYahooFallbackQuotes.quotes;
  }
  try {
    const results = await Promise.allSettled(
      YAHOO_NSE_MAP.map(async (item) => {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.yahooTicker)}?interval=5m&range=1d`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
              Accept: "application/json",
            },
          },
        );
        if (!res.ok) return null;
        const json = await res.json();
        const meta = json?.chart?.result?.[0]?.meta;
        const quote = json?.chart?.result?.[0]?.indicators?.quote?.[0];
        if (!meta || !meta.regularMarketPrice) return null;
        const ltp = Number(meta.regularMarketPrice.toFixed(2));
        const prevClose = Number((meta.chartPreviousClose || meta.previousClose || ltp).toFixed(2));
        const change = Number((ltp - prevClose).toFixed(2));
        const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;
        const highs = (quote?.high || []).filter((x: any) => typeof x === "number" && x > 0);
        const lows = (quote?.low || []).filter((x: any) => typeof x === "number" && x > 0);
        const opens = (quote?.open || []).filter((x: any) => typeof x === "number" && x > 0);
        const vols = (quote?.volume || []).filter((x: any) => typeof x === "number" && x >= 0);
        const totalVol = vols.reduce((a: number, b: number) => a + b, 0);

        globalLiveQuotes[item.instrumentKey] = {
          last_price: ltp,
          net_change: change,
          changePercent,
          instrument_token: item.instrumentKey,
        };

        return {
          symbol: item.symbol,
          name: item.name,
          exchange: item.exchange,
          segment: item.segment,
          instrumentKey: item.instrumentKey,
          ltp,
          change,
          changePercent,
          volume: Number(meta.regularMarketVolume || totalVol || 0),
          open: Number((meta.regularMarketOpen || opens[0] || ltp).toFixed(2)),
          high: Number((meta.regularMarketDayHigh || (highs.length ? Math.max(...highs) : ltp)).toFixed(2)),
          low: Number((meta.regularMarketDayLow || (lows.length ? Math.min(...lows) : ltp)).toFixed(2)),
          close: prevClose,
        };
      }),
    );

    const validQuotes = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value !== null)
      .map((r) => r.value);

    // Deduplicate by instrumentKey so clients never receive duplicate keys
    const uniqueQuotesMap = new Map<string, any>();
    for (const q of validQuotes) {
      if (q && q.instrumentKey && !uniqueQuotesMap.has(q.instrumentKey)) {
        uniqueQuotesMap.set(q.instrumentKey, q);
      }
    }
    const deduplicatedQuotes = Array.from(uniqueQuotesMap.values());

    if (deduplicatedQuotes.length > 0) {
      lastYahooFallbackQuotes = {
        timestamp: Date.now(),
        quotes: deduplicatedQuotes,
      };
      if (getLastQuotesCache().quotes.length === 0) {
        setLastQuotesCache({
          timestamp: Date.now(),
          data: {},
          quotes: deduplicatedQuotes,
        });
      }
    }
    return deduplicatedQuotes;
  } catch {
    return lastYahooFallbackQuotes.quotes;
  }
}
