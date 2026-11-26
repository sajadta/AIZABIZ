// Chart candle series preparation: validates bars and merges the live quote into
// the newest bucket, appending a fresh bar when a new interval has started.
import type { CandleData, StockQuote } from '../../types';

export function buildDisplayCandles(
  candles: CandleData[],
  quote: StockQuote | undefined,
  interval: string,
): CandleData[] {
  if (candles.length === 0) return [];
  const currentCandles = candles
    .filter((c) => c && c.close > 0 && c.high > 0 && c.low > 0 && c.open > 0)
    .map((c) => ({ ...c }));
  if (currentCandles.length === 0) return [];
  const lastCandleIndex = currentCandles.length - 1;

  if (quote && quote.ltp && quote.ltp > 0) {
    const lastCandle = { ...currentCandles[lastCandleIndex] };
    // Only merge live quote if it belongs to the same price scale (<15% difference)
    const diffRatio = Math.abs(quote.ltp - lastCandle.close) / lastCandle.close;
    if (diffRatio <= 0.15) {
      const intervalMinutesMap: Record<string, number> = {
        '1m': 1,
        '3m': 3,
        '5m': 5,
        '15m': 15,
        '1h': 60,
      };
      const intervalMins = intervalMinutesMap[interval] || 0;
      const intervalMs = intervalMins * 60 * 1000;
      const IST_MARKET_OPEN_OFFSET_MS = (3 * 60 + 45) * 60 * 1000;
      const nowMs = Date.now();
      const currentBucketStart =
        intervalMs > 0
          ? Math.floor((nowMs - IST_MARKET_OPEN_OFFSET_MS) / intervalMs) * intervalMs +
            IST_MARKET_OPEN_OFFSET_MS
          : lastCandle.timestamp;

      if (
        intervalMs > 0 &&
        currentBucketStart > lastCandle.timestamp &&
        currentBucketStart - lastCandle.timestamp <= intervalMs * 4
      ) {
        // A new minute/5m bar has started: append the new live bar immediately so the chart never waits for historical API lag!
        currentCandles.push({
          ...lastCandle,
          timestamp: currentBucketStart,
          open: lastCandle.close,
          high: Math.max(lastCandle.close, quote.ltp),
          low: Math.min(lastCandle.close, quote.ltp),
          close: quote.ltp,
          volume: 0,
        });
      } else {
        lastCandle.close = quote.ltp;
        if (quote.ltp > lastCandle.high) lastCandle.high = quote.ltp;
        if (quote.ltp < lastCandle.low) lastCandle.low = quote.ltp;
        currentCandles[lastCandleIndex] = lastCandle;
      }
    }
  }
  return currentCandles;
}
