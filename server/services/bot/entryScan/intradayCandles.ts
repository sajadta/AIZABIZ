// Intraday 1-minute candle loader for bot entry scans: Upstox intraday cache,
// prior-session warmup candles, and a Yahoo Finance fallback when the token is dead.
import { intradayCandleCache } from '../../../state';
import { resilientFetchJson } from '../../../lib/http';
import { YAHOO_NSE_MAP } from '../../../data/yahooMap';

interface CandleSource {
  key: string;
  symbol: string;
}

const yahooCandles = (json: any): any[] => {
  const resObj = json?.chart?.result?.[0];
  const timestamps: number[] = resObj?.timestamp || [];
  const quote = resObj?.indicators?.quote?.[0] || {};
  const candles: any[] = [];
  for (let i = timestamps.length - 1; i >= 0 && candles.length < 180; i--) {
    const close = quote.close?.[i];
    if (typeof close !== 'number' || close <= 0) continue;
    const open = quote.open?.[i] ?? close;
    const high = quote.high?.[i] ?? close;
    const low = quote.low?.[i] ?? close;
    candles.push([
      new Date(timestamps[i] * 1000).toISOString(),
      Number(open.toFixed(2)),
      Number(high.toFixed(2)),
      Number(low.toFixed(2)),
      Number(close.toFixed(2)),
      Number(quote.volume?.[i] || 0),
    ]);
  }
  return candles;
};

export async function loadIntradayCandles(idx: CandleSource, token: string | null): Promise<any> {
  const today = new Date();
  const toDate = today.toISOString().split('T')[0];
  const intradayUrl = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(idx.key)}/1minute`;
  const cachedIntraday = intradayCandleCache[idx.key];
  let cData: any = null;

  if (cachedIntraday && Date.now() - cachedIntraday.timestamp < 8000) {
    cData = { status: 'success', data: { candles: cachedIntraday.raw } };
  } else if (token) {
    try {
      cData = await resilientFetchJson(
        intradayUrl,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Api-Version': '2.0',
          },
        },
        2,
        6000,
      );
    } catch {
      cData = null;
    }
    if (
      cData?.status === 'success' &&
      Array.isArray(cData?.data?.candles) &&
      cData.data.candles.length > 0
    ) {
      intradayCandleCache[idx.key] = { timestamp: Date.now(), raw: cData.data.candles };
    } else if (cachedIntraday?.raw?.length > 0) {
      cData = { status: 'success', data: { candles: cachedIntraday.raw } };
    }
  }

  // Early in the session (or after hours) intraday returns too few candles for EMA21/EMA50,
  // SuperTrend, RSI and MACD warmup, so prepend the previous session's 1-minute candles.
  if (!cData?.data?.candles || cData.data.candles.length < 45) {
    const fromDate = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const histUrl = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(idx.key)}/1minute/${toDate}/${fromDate}`;

    if (token) {
      try {
        const histData: any = await resilientFetchJson(
          histUrl,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
              'Api-Version': '2.0',
            },
          },
          1,
          6000,
        );
        if (histData?.status === 'success' && histData?.data?.candles?.length > 0) {
          const existingIntraday = Array.isArray(cData?.data?.candles) ? cData.data.candles : [];
          const oldestIntradayTs =
            existingIntraday.length > 0
              ? new Date(existingIntraday[existingIntraday.length - 1][0]).getTime()
              : Infinity;
          const priorWarmupCandles = histData.data.candles
            .filter((hc: any) => new Date(hc[0]).getTime() < oldestIntradayTs)
            .slice(0, 90);
          const mergedCandles =
            existingIntraday.length > 0
              ? [...existingIntraday, ...priorWarmupCandles]
              : histData.data.candles.slice(0, 180);
          cData = { status: 'success', data: { candles: mergedCandles } };
          intradayCandleCache[idx.key] = { timestamp: Date.now(), raw: mergedCandles };
        }
      } catch {
        // Ignored: fall through to the Yahoo fallback below
      }
    }

    if (!cData?.data?.candles || cData.data.candles.length === 0) {
      const mapped = YAHOO_NSE_MAP.find(
        (m) => m.instrumentKey === idx.key || m.symbol.toUpperCase() === idx.symbol.toUpperCase(),
      );
      if (mapped) {
        try {
          const yRes = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(mapped.yahooTicker)}?interval=1m&range=5d`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                Accept: 'application/json',
              },
            },
          );
          if (yRes.ok) {
            const candles = yahooCandles(await yRes.json());
            if (candles.length > 0) {
              cData = { status: 'success', data: { candles } };
              intradayCandleCache[idx.key] = { timestamp: Date.now(), raw: candles };
            }
          }
        } catch {
          // Ignored
        }
      }
    }
  }

  return cData;
}
