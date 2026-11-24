// Layers 1-10 of the confluence engine: trend, momentum, volume, volatility and
// candle-anatomy scoring plus the ADX sideways-chop veto.
import type { CandleData, IndicatorReadings } from '../../../types';
import { evaluateVolumeRegime } from './volumeRegime';

export interface CoreScoringParams {
  candles: CandleData[];
  last: CandleData;
  prev: CandleData;
  readings: IndicatorReadings;
  ema9: number;
  ema21: number;
  rsi: number;
  macdHist: number;
  prevMacdHist: number;
  adxValue: number;
  atr14: number;
  currentLtp: number;
}

export interface CoreScoringResult {
  bullishPoints: number;
  bearishPoints: number;
  rvol: number;
  adxVal: number;
  isDeadSidewaysChop: boolean;
  isOpening3mWhipsaw: boolean;
}

export function applyCoreScoring(params: CoreScoringParams): CoreScoringResult {
  const {
    candles,
    last,
    prev,
    readings,
    ema9,
    ema21,
    rsi,
    macdHist,
    prevMacdHist,
    adxValue,
    atr14,
    currentLtp,
  } = params;

  let bullishPoints = 0;
  let bearishPoints = 0;

  // 1. Supertrend (Institutional Trend Direction) - 30 Points
  if (readings.supertrend.signal === 'BUY') bullishPoints += 30;
  else bearishPoints += 30;

  // 2. EMA Cross (Momentum) - 25 Points
  if (readings.emaCross.signal === 'BULLISH' && ema9 >= ema21) bullishPoints += 25;
  else if (readings.emaCross.signal === 'BEARISH' && ema9 <= ema21) bearishPoints += 25;

  // 3. RSI (Strength + Value Pullback Dip Credit) - 20 Points
  if (readings.rsi.value >= 52 && readings.rsi.value <= 75) {
    bullishPoints += 20;
  } else if (
    readings.rsi.value >= 44 &&
    readings.rsi.value < 52 &&
    readings.supertrend.signal === 'BUY'
  ) {
    bullishPoints += 14; // Healthy uptrend dip zone
  }
  if (readings.rsi.value <= 48 && readings.rsi.value >= 25) {
    bearishPoints += 20;
  } else if (
    readings.rsi.value > 48 &&
    readings.rsi.value <= 56 &&
    readings.supertrend.signal === 'SELL'
  ) {
    bearishPoints += 14; // Healthy downtrend pullback zone
  }

  // 4. MACD (Acceleration) - 15 Points
  if (readings.macd.cross === 'BULLISH' || macdHist > 0 || macdHist > prevMacdHist)
    bullishPoints += 15;
  if (readings.macd.cross === 'BEARISH' || macdHist < 0 || macdHist < prevMacdHist)
    bearishPoints += 15;

  // 5. VWAP (Intraday Institutional Average) - 10 Points
  if (readings.vwap.position === 'ABOVE') bullishPoints += 10;
  else bearishPoints += 10;

  // 6. Institutional Smart Money Concepts (SMC) & Liquidity Hunt Detection
  const recentCandles = candles.slice(-5);
  let smcBullishImbalance = false;
  let smcBearishImbalance = false;
  if (recentCandles.length >= 3) {
    const c1 = recentCandles[recentCandles.length - 3];
    const c3 = recentCandles[recentCandles.length - 1];
    if (c3.low > c1.high) smcBullishImbalance = true;
    if (c3.high < c1.low) smcBearishImbalance = true;
  }
  if (smcBullishImbalance) bullishPoints += 15;
  if (smcBearishImbalance) bearishPoints += 15;

  // 7. Liquidity Sweep & Retail Trap Filter
  const lastUpperWick = last.high - Math.max(last.open, last.close);
  const lastLowerWick = Math.min(last.open, last.close) - last.low;
  const candleRange = last.high - last.low || 1;
  const isBullTrapSweep = lastUpperWick / candleRange > 0.62;
  const isBearTrapSweep = lastLowerWick / candleRange > 0.62;

  if (isBullTrapSweep) {
    bullishPoints -= 20;
    bearishPoints += 8;
  }
  if (isBearTrapSweep) {
    bearishPoints -= 20;
    bullishPoints += 8;
  }

  // 8. Theta Decay Shield & Opening Whipsaw Protection (Time-of-day Option Protection)
  const nowIst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hoursIst = nowIst.getHours();
  const minsIst = nowIst.getMinutes();
  const isOpening3mWhipsaw = hoursIst === 9 && minsIst >= 15 && minsIst < 18;
  const isThetaChopZone = hoursIst === 12 && minsIst >= 15 && minsIst <= 45;
  if (isThetaChopZone && Math.abs(macdHist) < 0.35 && adxValue < 16) {
    bullishPoints -= 10;
    bearishPoints -= 10;
  }

  const {
    rvol,
    bullishPoints: volumeBullishPoints,
    bearishPoints: volumeBearishPoints,
  } = evaluateVolumeRegime({ candles, last, prev, currentLtp, rsi });
  bullishPoints += volumeBullishPoints;
  bearishPoints += volumeBearishPoints;

  // 8.5 ADX Trend Strength & Choppy/Sideways Market Veto (Prevents buying options in dead sideways markets where Theta eats premium!)
  const adxVal = Number((readings as any).adx?.value ?? 20);
  const isDeadSidewaysChop = adxVal < 14.5 && rvol < 1.1 && Math.abs(macdHist) < 0.4;
  if (adxVal >= 22) {
    if (readings.supertrend.signal === 'BUY') bullishPoints += 6;
    else bearishPoints += 6;
  } else if (isDeadSidewaysChop) {
    bullishPoints -= 20;
    bearishPoints -= 20;
  }

  // 9. Volatility & Trap Filter (Penalty)
  if (readings.rsi.value > 82) bullishPoints -= 15;
  if (readings.rsi.value < 18) bearishPoints -= 15;

  // 10. Candlestick Anatomy
  const bodySize = Math.abs(last.close - last.open);
  const totalSize = last.high - last.low;
  const isDoji = totalSize > atr14 * 0.5 && bodySize / totalSize < 0.12;
  if (isDoji) {
    bullishPoints -= 6;
    bearishPoints -= 6;
  }
  return {
    bullishPoints,
    bearishPoints,
    rvol,
    adxVal,
    isDeadSidewaysChop,
    isOpening3mWhipsaw,
  };
}
