import type { CandleData } from '../../../types';

export type MtfTrend = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

interface AggregatedBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const aggregate = (slice: CandleData[]): AggregatedBar => ({
  open: slice[0].open,
  high: Math.max(...slice.map((c) => c.high)),
  low: Math.min(...slice.map((c) => c.low)),
  close: slice[slice.length - 1].close,
  volume: slice.reduce((a, c) => a + Number(c.volume || 0), 0),
});

// Buckets 1-minute candles into clock-aligned IST bars (:00/:05/:10 and :00/:15/:30/:45)
// so live ticks never shift historical multi-timeframe bars.
const buildBars = (candles: CandleData[], groupSize: number): AggregatedBar[] => {
  const bars: AggregatedBar[] = [];
  const hasTimestamps = candles.every((c) => Number(c.timestamp || 0) > 1_000_000_000_000);

  if (hasTimestamps) {
    const IST_OFFSET_MS = 19_800_000;
    const bucketMs = groupSize * 60_000;
    const buckets = new Map<number, CandleData[]>();
    for (const c of candles) {
      const bKey = Math.floor((Number(c.timestamp) + IST_OFFSET_MS) / bucketMs);
      if (!buckets.has(bKey)) buckets.set(bKey, []);
      buckets.get(bKey)!.push(c);
    }
    const sortedKeys = Array.from(buckets.keys())
      .sort((a, b) => a - b)
      .slice(-10);
    for (const k of sortedKeys) bars.push(aggregate(buckets.get(k)!));
    return bars;
  }

  for (let i = Math.max(0, candles.length - groupSize * 8); i < candles.length; i += groupSize) {
    const slice = candles.slice(i, Math.min(candles.length, i + groupSize));
    if (slice.length > 0) bars.push(aggregate(slice));
  }
  return bars;
};

export function buildMtfTrend(
  candles: CandleData[],
  currentLtp: number,
  groupSize: number,
): MtfTrend {
  if (candles.length < groupSize * 2) return 'NEUTRAL';

  const bars = buildBars(candles, groupSize);
  if (bars.length < 2) return 'NEUTRAL';

  const lastBar = bars[bars.length - 1];
  const prevBar = bars[bars.length - 2];
  const prev2Bar = bars[bars.length - 3] || prevBar;

  const closes = bars.map((c) => c.close);
  const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length;

  const isHigherHigh = lastBar.high > prevBar.high && prevBar.high >= prev2Bar.high;
  const isHigherLow = lastBar.low > prevBar.low && prevBar.low >= prev2Bar.low;
  const isLowerHigh = lastBar.high < prevBar.high && prevBar.high <= prev2Bar.high;
  const isLowerLow = lastBar.low < prevBar.low && prevBar.low <= prev2Bar.low;

  const isLastBarGreen = lastBar.close >= lastBar.open * 0.9997;
  const isLastBarRed = lastBar.close <= lastBar.open * 1.0003;
  const bothPrevRed = lastBar.close < lastBar.open && prevBar.close < prevBar.open;
  const bothPrevGreen = lastBar.close > lastBar.open && prevBar.close > prevBar.open;

  if (
    !bothPrevRed &&
    (isLastBarGreen || currentLtp > prevBar.high) &&
    (isHigherHigh ||
      (isHigherLow && currentLtp > prevBar.close) ||
      currentLtp > Math.max(prevBar.high, prevBar.close)) &&
    currentLtp >= avgClose * 0.9998
  ) {
    return 'BULLISH';
  }
  if (
    !bothPrevGreen &&
    (isLastBarRed || currentLtp < prevBar.low) &&
    (isLowerLow ||
      (isLowerHigh && currentLtp < prevBar.close) ||
      currentLtp < Math.min(prevBar.low, prevBar.close)) &&
    currentLtp <= avgClose * 1.0002
  ) {
    return 'BEARISH';
  }
  return 'NEUTRAL';
}
