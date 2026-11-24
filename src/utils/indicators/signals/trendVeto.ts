// Post-gate trend veto: multi-timeframe corporate veto, chop-box compression and
// India VIX market regime selection applied after the confluence gates.
import type { CandleData, IndicatorReadings } from '../../../types';
import type { RealOptionMetrics } from '../optionTypes';
import { computeSessionVwap } from '../session';

export interface ApplyTrendVetoParams {
  candles: CandleData[];
  sessionCandles: CandleData[];
  readings: IndicatorReadings;
  currentLtp: number;
  ema9: number;
  ema21: number;
  vwapVal: number;
  adxVal: number;
  adxValue: number;
  rvol: number;
  tf5m: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  tf15m: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  corpScore: number;
  bullishPoints: number;
  bearishPoints: number;
  optionMetrics?: RealOptionMetrics;
}

export interface ApplyTrendVetoResult {
  bullishPoints: number;
  bearishPoints: number;
  isStrongTechUptrend: boolean;
  isStrongTechDowntrend: boolean;
  isCorporateMtfBullBlocked: boolean;
  isCorporateMtfBearBlocked: boolean;
  isSidewaysChopRegime: boolean;
  indiaVixVal: number;
  marketRegimeMode: 'TRENDING_OPTION_BUYING' | 'HIGH_VIX_BREAKOUT' | 'LOW_VIX_RANGE_GUARD';
}

export function applyTrendVeto(p: ApplyTrendVetoParams): ApplyTrendVetoResult {
  const {
    candles,
    sessionCandles,
    readings,
    currentLtp,
    ema9,
    ema21,
    vwapVal,
    adxVal,
    adxValue,
    rvol,
    tf5m,
    tf15m,
    corpScore,
    optionMetrics,
  } = p;
  let { bullishPoints, bearishPoints } = p;

  // Blend session VWAP with a 30-bar rolling VWAP so mid-day reversals are caught
  // without waiting for the stale 09:15 session average.
  const rolling30Slice = sessionCandles.slice(-Math.min(30, sessionCandles.length));
  const rolling30Vwap = computeSessionVwap(rolling30Slice, currentLtp);
  const effectiveTrendVwap = Number((vwapVal * 0.35 + rolling30Vwap * 0.65).toFixed(2));

  const isStrongTechUptrend =
    tf15m === 'BULLISH' &&
    tf5m === 'BULLISH' &&
    readings.supertrend.signal === 'BUY' &&
    currentLtp > effectiveTrendVwap;
  const isStrongTechDowntrend =
    tf15m === 'BEARISH' &&
    tf5m === 'BEARISH' &&
    readings.supertrend.signal === 'SELL' &&
    currentLtp < effectiveTrendVwap;

  const isCorporateMtfBullBlocked =
    tf15m === 'BEARISH' ||
    corpScore <= -45 ||
    (corpScore <= -25 && !isStrongTechUptrend) ||
    (currentLtp < effectiveTrendVwap * 0.9992 &&
      (readings.supertrend.signal === 'SELL' || ema9 < ema21)) ||
    (currentLtp < rolling30Vwap * 0.9994 && tf5m === 'BEARISH' && ema9 < ema21);

  const isCorporateMtfBearBlocked =
    tf15m === 'BULLISH' ||
    corpScore >= 45 ||
    (corpScore >= 25 && !isStrongTechDowntrend) ||
    (currentLtp > effectiveTrendVwap * 1.0008 &&
      (readings.supertrend.signal === 'BUY' || ema9 > ema21)) ||
    (currentLtp > rolling30Vwap * 1.0006 && tf5m === 'BULLISH' && ema9 > ema21);

  if (isCorporateMtfBullBlocked) bullishPoints = Math.min(bullishPoints, 35);
  if (isCorporateMtfBearBlocked) bearishPoints = Math.min(bearishPoints, 35);

  // Narrow sideways consolidation box detection (dead chop where theta eats premium).
  const chopSlice = candles.slice(-Math.min(12, candles.length));
  const chopBoxHigh = Math.max(...chopSlice.map((c) => c.high));
  const chopBoxLow = Math.min(...chopSlice.map((c) => c.low));
  const chopBoxRangePct = currentLtp > 0 ? ((chopBoxHigh - chopBoxLow) / currentLtp) * 100 : 1;
  let emaCrossbacks = 0;
  for (let i = 1; i < chopSlice.length; i++) {
    const prevAbove = chopSlice[i - 1].close >= (chopSlice[i - 1].ema21 ?? chopSlice[i - 1].close);
    const currAbove = chopSlice[i].close >= (chopSlice[i].ema21 ?? chopSlice[i].close);
    if (prevAbove !== currAbove) emaCrossbacks++;
  }
  const isBoxCompressedChop =
    chopSlice.length >= 10 &&
    chopBoxRangePct < 0.14 &&
    adxVal < 20 &&
    (emaCrossbacks >= 2 || rvol < 1.25);
  const isSidewaysChopRegime = (adxVal < 15 && rvol < 0.95) || isBoxCompressedChop;
  if (isSidewaysChopRegime) {
    bullishPoints = Math.min(bullishPoints, 45);
    bearishPoints = Math.min(bearishPoints, 45);
  }

  const indiaVixVal = Number(optionMetrics?.indiaVix || 13.8);
  const marketRegimeMode: ApplyTrendVetoResult['marketRegimeMode'] =
    adxValue < 16 || (indiaVixVal > 0 && indiaVixVal < 11.5)
      ? 'LOW_VIX_RANGE_GUARD'
      : indiaVixVal >= 18
        ? 'HIGH_VIX_BREAKOUT'
        : 'TRENDING_OPTION_BUYING';

  return {
    bullishPoints,
    bearishPoints,
    isStrongTechUptrend,
    isStrongTechDowntrend,
    isCorporateMtfBullBlocked,
    isCorporateMtfBearBlocked,
    isSidewaysChopRegime,
    indiaVixVal,
    marketRegimeMode,
  };
}
