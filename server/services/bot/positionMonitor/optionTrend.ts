// 1-minute option premium structure: ATR proxy from recent bar ranges, higher-low
// trend integrity, structural breakdown and climax upper-wick rejection.

export interface OptionTrendInput {
  candles: any[];
  ltp: number;
  buyPrice: number;
  forecastedMaxPrice: number;
}

export interface OptionTrendResult {
  avgOptionAtr: number;
  isTrendIntact: boolean;
  isBreakingDown: boolean;
  isClimaxReversal: boolean;
}

const DEFAULT_ATR_PCT = 0.025;
const MIN_ATR = 0.35;

export const evaluateOptionTrend = ({
  candles,
  ltp,
  buyPrice,
  forecastedMaxPrice,
}: OptionTrendInput): OptionTrendResult => {
  const result: OptionTrendResult = {
    avgOptionAtr: Math.max(MIN_ATR, buyPrice * DEFAULT_ATR_PCT),
    isTrendIntact: true,
    isBreakingDown: false,
    isClimaxReversal: false,
  };
  if (candles.length < 3) return result;

  const recentRanges = candles
    .slice(0, 5)
    .map((c: any) => Math.max(0.05, Number(c[2] || 0) - Number(c[3] || 0)));
  result.avgOptionAtr = Number(
    (
      recentRanges.reduce((a: number, b: number) => a + b, 0) / Math.max(1, recentRanges.length)
    ).toFixed(2),
  );

  const c0 = candles[0]; // current 1m candle
  const c1 = candles[1]; // previous closed 1m candle
  const c2 = candles[2]; // 2m ago closed candle
  const prev1mCandleLow = Number(c1[3] || 0);
  const prev2mCandleLow = Number(c2[3] || 0);
  const c1Open = Number(c1[1] || ltp);
  const c1Close = Number(c1[4] || ltp);
  const c0High = Math.max(Number(c0[2] || ltp), ltp);
  const c0Low = Math.min(Number(c0[3] || ltp), ltp);
  const c0Open = Number(c0[1] || ltp);
  const c0UpperWick = c0High - Math.max(c0Open, ltp);
  const c0Range = Math.max(0.05, c0High - c0Low);

  // Trend stays intact while price holds the previous closed bar's low (higher-low structure).
  if (prev1mCandleLow > 0 && ltp < prev1mCandleLow && ltp < c0Open) {
    result.isTrendIntact = false;
  }
  if (
    prev1mCandleLow > 0 &&
    prev2mCandleLow > 0 &&
    ltp < Math.min(prev1mCandleLow, prev2mCandleLow)
  ) {
    result.isTrendIntact = false;
  }

  if (
    ltp < buyPrice * 0.988 &&
    c1Close < c1Open &&
    ltp < c0Open &&
    prev1mCandleLow > 0 &&
    prev2mCandleLow > 0 &&
    ltp < Math.min(prev1mCandleLow, prev2mCandleLow)
  ) {
    result.isBreakingDown = true;
  }

  const isShootingStarPattern =
    c0Range >= 0.2 &&
    c0UpperWick / c0Range >= 0.35 &&
    (ltp < c0Open || ltp <= c0High - c0UpperWick * 0.4);

  if (
    (ltp >= buyPrice * 1.035 || (forecastedMaxPrice > 0 && ltp >= forecastedMaxPrice * 0.93)) &&
    isShootingStarPattern
  ) {
    result.isClimaxReversal = true;
  }

  return result;
};
