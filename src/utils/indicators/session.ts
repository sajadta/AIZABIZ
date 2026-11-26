// Intraday session helpers: IST session-candle selection and VWAP computation.
import type { CandleData } from '../../types';

const getIstDateKey = (ts: number) =>
  ts > 0 ? new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '';

/**
 * Selects the candles belonging to the latest candle's IST trading session so
 * yesterday's warmup candles never corrupt today's Session Open or Intraday VWAP.
 */
export function selectSessionCandles(candles: CandleData[]): CandleData[] {
  const latestDateKey = getIstDateKey(Number(candles[candles.length - 1]?.timestamp || 0));
  const todaySessionCandles = latestDateKey
    ? candles.filter((c) => getIstDateKey(Number(c.timestamp || 0)) === latestDateKey)
    : [];
  return todaySessionCandles.length >= 3
    ? todaySessionCandles
    : candles.slice(-Math.min(75, candles.length));
}

/**
 * Intraday VWAP. For index spot candles where volume is 0, falls back to a
 * range-weighted typical price across the session candles.
 */
export function computeSessionVwap(sessionCandles: CandleData[], currentLtp: number): number {
  const totalSessionVol = sessionCandles.reduce((acc, c) => acc + Number(c.volume || 0), 0);
  const computedVwap =
    totalSessionVol > 0
      ? sessionCandles.reduce(
          (acc, c) => acc + ((c.high + c.low + c.close) / 3) * Number(c.volume || 0),
          0,
        ) / totalSessionVol
      : sessionCandles.reduce((acc, c) => {
          const tp = (c.high + c.low + c.close) / 3;
          const weight = Math.max(0.05, c.high - c.low);
          return acc + tp * weight;
        }, 0) /
        Math.max(
          0.05,
          sessionCandles.reduce((acc, c) => acc + Math.max(0.05, c.high - c.low), 0),
        );
  return Number((computedVwap > 0 ? computedVwap : currentLtp).toFixed(2));
}
