import type { CandleData } from '../../types';
import {
  calculateADX,
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSupertrend,
} from './calculations';

export function enrichCandlesWithIndicators(
  rawCandles: {
    timestamp: number;
    timeStr: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[],
): CandleData[] {
  if (!rawCandles || rawCandles.length === 0) return [];

  const closes = rawCandles.map((c) => c.close);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);
  const rsi = calculateRSI(closes, 14);
  const macdObj = calculateMACD(closes);
  const supertrendObj = calculateSupertrend(rawCandles, 10, 3);
  const adxSeries = calculateADX(rawCandles, 14);
  const bb = calculateBollingerBands(closes, 20, 2);

  return rawCandles.map((c, i) => ({
    ...c,
    ema9: ema9[i],
    ema21: ema21[i],
    ema50: ema50[i],
    supertrend: supertrendObj.supertrend[i],
    supertrendDir: supertrendObj.direction[i],
    rsi: rsi[i],
    macd: macdObj.macd[i],
    macdSignal: macdObj.signal[i],
    macdHist: macdObj.hist[i],
    adx: adxSeries[i],
    upperBand: bb.upper[i],
    lowerBand: bb.lower[i],
    middleBand: bb.middle[i],
  }));
}
