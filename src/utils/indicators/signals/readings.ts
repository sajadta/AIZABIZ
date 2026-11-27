import type { IndicatorReadings } from '../../../types';

export interface ReadingsInput {
  currentLtp: number;
  ema9: number;
  ema21: number;
  ema50: number;
  rsi: number;
  supertrendDir: 'BUY' | 'SELL';
  supertrendVal: number;
  macdLine?: number;
  macdSignal?: number;
  macdHist: number;
  prevMacdHist: number;
  adxValue: number;
  vwapPrice: number;
}

// Pure mapping from raw indicator values to the typed readings the UI renders.
export const buildIndicatorReadings = ({
  currentLtp,
  ema9,
  ema21,
  ema50,
  rsi,
  supertrendDir,
  supertrendVal,
  macdLine,
  macdSignal,
  macdHist,
  prevMacdHist,
  adxValue,
  vwapPrice,
}: ReadingsInput): IndicatorReadings => ({
  supertrend: {
    signal: supertrendDir,
    value: supertrendVal,
  },
  emaCross: {
    signal:
      ema9 > ema21 && ema21 >= ema50 * 0.999
        ? 'BULLISH'
        : ema9 < ema21 && ema21 <= ema50 * 1.001
          ? 'BEARISH'
          : ema9 > ema21
            ? 'BULLISH'
            : ema9 < ema21
              ? 'BEARISH'
              : 'NEUTRAL',
    ema9,
    ema21,
    ema50,
  },
  rsi: {
    value: rsi,
    condition:
      rsi > 70
        ? 'OVERBOUGHT'
        : rsi < 30
          ? 'OVERSOLD'
          : rsi > 53
            ? 'BULLISH'
            : rsi < 47
              ? 'BEARISH'
              : 'NEUTRAL',
  },
  macd: {
    macd: macdLine ?? 0,
    signal: macdSignal ?? 0,
    hist: macdHist,
    cross:
      macdHist > 0 && prevMacdHist <= 0
        ? 'BULLISH'
        : macdHist < 0 && prevMacdHist >= 0
          ? 'BEARISH'
          : macdHist > 0
            ? 'BULLISH'
            : 'BEARISH',
  },
  vwap: {
    value: vwapPrice,
    position: currentLtp >= vwapPrice ? 'ABOVE' : 'BELOW',
  },
  adx: {
    value: adxValue,
    condition: adxValue >= 24 ? 'STRONG_TREND' : adxValue >= 16 ? 'TRENDING' : 'SIDEWAYS_CHOP',
  },
});
