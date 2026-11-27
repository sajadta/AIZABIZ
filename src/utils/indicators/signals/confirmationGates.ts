// Anti-fakeout confirmation gates: session trend veto, multi-candle confirmation,
// pullback-dip setups and over-extension protection.
import type { CandleData, IndicatorReadings } from '../../../types';

export interface ConfirmationGateParams {
  readings: IndicatorReadings;
  sessionCandles: CandleData[];
  last: CandleData;
  prev: CandleData;
  prev2: CandleData;
  currentLtp: number;
  ema9: number;
  ema21: number;
  ema50: number;
  atr14: number;
  move1m: number;
  move2m: number;
  move3m: number;
  move5m: number;
  tf15m: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  corpScore: number;
  macroAlign: 'BULLISH' | 'BEARISH' | 'MIXED';
  isBlockedByResistanceWall: boolean;
  isBlockedBySupportWall: boolean;
  isDeadSidewaysChop: boolean;
  isOpening3mWhipsaw: boolean;
  isClosedBullishEngulfing: boolean;
  isClosedBearishEngulfing: boolean;
  isClosedHammerSupport: boolean;
  isClosedShootingStarResistance: boolean;
  detectedPatternEn: string;
  detectedPatternMl: string;
  bullishPoints: number;
  bearishPoints: number;
}

export interface ConfirmationGateResult {
  bullishPoints: number;
  bearishPoints: number;
  detectedPatternEn: string;
  detectedPatternMl: string;
  vwapVal: number;
}

export function applyConfirmationGates(params: ConfirmationGateParams): ConfirmationGateResult {
  const {
    readings,
    sessionCandles,
    last,
    prev,
    prev2,
    currentLtp,
    ema9,
    ema21,
    ema50,
    atr14,
    move1m,
    move2m,
    move3m,
    move5m,
    tf15m,
    corpScore,
    macroAlign,
    isBlockedByResistanceWall,
    isBlockedBySupportWall,
    isDeadSidewaysChop,
    isOpening3mWhipsaw,
    isClosedBullishEngulfing,
    isClosedBearishEngulfing,
    isClosedHammerSupport,
    isClosedShootingStarResistance,
    bullishPoints: initialBullishPoints,
    bearishPoints: initialBearishPoints,
  } = params;

  let bullishPoints = initialBullishPoints;
  let bearishPoints = initialBearishPoints;
  let detectedPatternEn = params.detectedPatternEn;
  let detectedPatternMl = params.detectedPatternMl;

  // E. Anti-Fakeout, Session Macro Trend Veto & Multi-Candle Confirmation Gate
  // 1. Intraday Session Trend & VWAP Regime Filter using TODAY'S 9:15 AM IST Open (sessionCandles[0].open)
  const sessionOpen = Number(sessionCandles[0]?.open || currentLtp);
  const sessionChangePct = sessionOpen > 0 ? ((currentLtp - sessionOpen) / sessionOpen) * 100 : 0;
  const vwapVal = readings.vwap.value || currentLtp;
  // Only block counter-trend trades if the index is in a massive one-way runaway session AND SuperTrend has NOT flipped to confirm the reversal!
  const isStrongBullishSessionDay =
    sessionChangePct >= 0.65 &&
    currentLtp > vwapVal &&
    currentLtp > ema50 &&
    readings.supertrend.signal === 'BUY';
  const isStrongBearishSessionDay =
    sessionChangePct <= -0.65 &&
    currentLtp < vwapVal &&
    currentLtp < ema50 &&
    readings.supertrend.signal === 'SELL';

  const isMacroAndHeavyweightVetoBull =
    corpScore <= -45 && macroAlign === 'BEARISH' && readings.supertrend.signal === 'SELL';
  const isMacroAndHeavyweightVetoBear =
    corpScore >= 45 && macroAlign === 'BULLISH' && readings.supertrend.signal === 'BUY';

  const recent3High = Math.max(last.high, prev.high, prev2.high);
  const recent3Low = Math.min(last.low, prev.low, prev2.low);

  const currentRange = Math.max(0.01, last.high - last.low);
  const prevCandleRange = Math.max(0.01, prev.high - prev.low);
  const bullCloseStrength = (currentLtp - last.low) / currentRange;
  const bearCloseStrength = (last.high - currentLtp) / currentRange;
  const prevBullCloseStrength = (prev.close - prev.low) / prevCandleRange;
  const prevBearCloseStrength = (prev.high - prev.close) / prevCandleRange;
  const pullbackFrom3mHigh = recent3High - currentLtp;
  const bounceFrom3mLow = currentLtp - recent3Low;

  // Institutional Trend Alignment Gate: Never buy Calls against a Bearish SuperTrend below EMA21, or Puts against a Bullish SuperTrend above EMA21
  const isTrendAlignedBull =
    readings.supertrend.signal === 'BUY' ||
    (currentLtp > ema21 && ema9 >= ema21 && currentLtp > vwapVal);
  const isTrendAlignedBear =
    readings.supertrend.signal === 'SELL' ||
    (currentLtp < ema21 && ema9 <= ema21 && currentLtp < vwapVal);

  const isMultiCandleBullConfirmed =
    isTrendAlignedBull &&
    ((currentLtp >= last.open && move1m >= 0) ||
      (prev.close > prev.open && currentLtp >= prev.close * 0.9997) ||
      (move2m > 0 && move3m > 0 && currentLtp >= prev.close * 0.9995)) &&
    (move2m > 0 || move3m > 0 || move5m > 0) &&
    (currentLtp >= ema9 * 0.9995 || (currentLtp > prev.high && move1m > 0)) &&
    (ema9 >= ema21 * 0.999 ||
      (readings.supertrend.signal === 'BUY' && currentLtp >= ema21 * 0.9995)) &&
    (bullCloseStrength >= 0.35 ||
      (prev.close > prev.open &&
        prevBullCloseStrength >= 0.55 &&
        currentLtp >= prev.close * 0.9996)) &&
    !isClosedShootingStarResistance &&
    !isClosedBearishEngulfing &&
    !isBlockedByResistanceWall &&
    !isStrongBearishSessionDay &&
    !isDeadSidewaysChop &&
    !isOpening3mWhipsaw &&
    !isMacroAndHeavyweightVetoBull &&
    pullbackFrom3mHigh <= Math.max(atr14 * 1.4, currentLtp * 0.002);

  const isMultiCandleBearConfirmed =
    isTrendAlignedBear &&
    ((currentLtp <= last.open && move1m <= 0) ||
      (prev.close < prev.open && currentLtp <= prev.close * 1.0003) ||
      (move2m < 0 && move3m < 0 && currentLtp <= prev.close * 1.0005)) &&
    (move2m < 0 || move3m < 0 || move5m < 0) &&
    (currentLtp <= ema9 * 1.0005 || (currentLtp < prev.low && move1m < 0)) &&
    (ema9 <= ema21 * 1.001 ||
      (readings.supertrend.signal === 'SELL' && currentLtp <= ema21 * 1.0005)) &&
    (bearCloseStrength >= 0.35 ||
      (prev.close < prev.open &&
        prevBearCloseStrength >= 0.55 &&
        currentLtp <= prev.close * 1.0004)) &&
    !isClosedHammerSupport &&
    !isClosedBullishEngulfing &&
    !isBlockedBySupportWall &&
    !isStrongBullishSessionDay &&
    !isDeadSidewaysChop &&
    !isOpening3mWhipsaw &&
    !isMacroAndHeavyweightVetoBear &&
    bounceFrom3mLow <= Math.max(atr14 * 1.4, currentLtp * 0.002);

  // Anti-Climax / Over-Extension Guard: Block buying Calls at RSI > 73 or buying Puts at RSI < 27 (wait for EMA9 pullback before next impulse)
  const distFromEma9 = Math.abs(currentLtp - ema9);
  const isOverExtendedBull =
    readings.rsi.value > 73 ||
    (atr14 > 0 && distFromEma9 > atr14 * 2.8 && currentLtp > ema9) ||
    (atr14 > 0 && Math.abs(move3m) > atr14 * 4.2);
  const isOverExtendedBear =
    readings.rsi.value < 27 ||
    (atr14 > 0 && distFromEma9 > atr14 * 2.8 && currentLtp < ema9) ||
    (atr14 > 0 && Math.abs(move3m) > atr14 * 4.2);

  const isPullbackDipBounceBull =
    tf15m === 'BULLISH' &&
    readings.supertrend.signal === 'BUY' &&
    currentLtp >= vwapVal * 0.999 &&
    currentLtp >= ema21 * 0.9985 &&
    ema9 >= ema21 * 0.999 &&
    corpScore >= 10 &&
    (currentLtp >= last.open * 0.9992 || bullCloseStrength >= 0.42) &&
    !isClosedShootingStarResistance &&
    !isClosedBearishEngulfing &&
    !isStrongBearishSessionDay &&
    !isDeadSidewaysChop &&
    !isOpening3mWhipsaw &&
    !isMacroAndHeavyweightVetoBull &&
    pullbackFrom3mHigh <= Math.max(atr14 * 1.8, currentLtp * 0.0025);

  const isPullbackDipBounceBear =
    tf15m === 'BEARISH' &&
    readings.supertrend.signal === 'SELL' &&
    currentLtp <= vwapVal * 1.001 &&
    currentLtp <= ema21 * 1.0015 &&
    ema9 <= ema21 * 1.001 &&
    corpScore <= -10 &&
    (currentLtp <= last.open * 1.0008 || bearCloseStrength >= 0.42) &&
    !isClosedHammerSupport &&
    !isClosedBullishEngulfing &&
    !isStrongBullishSessionDay &&
    !isDeadSidewaysChop &&
    !isOpening3mWhipsaw &&
    !isMacroAndHeavyweightVetoBear &&
    bounceFrom3mLow <= Math.max(atr14 * 1.8, currentLtp * 0.0025);

  if (isMultiCandleBullConfirmed && !isOverExtendedBull) {
    bullishPoints += 18;
    bearishPoints = Math.min(bearishPoints, 25);
  } else if (isPullbackDipBounceBull && !isOverExtendedBull) {
    bullishPoints += 14;
    bearishPoints = Math.min(bearishPoints, 30);
    if (detectedPatternEn === 'Multi-Candle Structure Follow-Through') {
      detectedPatternEn = 'Uptrend Value Dip Bounce Setup';
      detectedPatternMl = 'അപ്‌ട്രെൻഡിലെ വിലക്കുറവ് (Dip Buy) ബൗൺസ്';
    }
  } else {
    bullishPoints = Math.min(bullishPoints, corpScore <= -35 ? 48 : 64);
  }

  if (isMultiCandleBearConfirmed && !isOverExtendedBear) {
    bearishPoints += 18;
    bullishPoints = Math.min(bullishPoints, 25);
  } else if (isPullbackDipBounceBear && !isOverExtendedBear) {
    bearishPoints += 14;
    bullishPoints = Math.min(bullishPoints, 30);
    if (detectedPatternEn === 'Multi-Candle Structure Follow-Through') {
      detectedPatternEn = 'Downtrend Pullback Reversal Setup';
      detectedPatternMl = 'ഡൗൺട്രെൻഡിലെ പുൾബാക്ക് റിവേഴ്സൽ';
    }
  } else {
    bearishPoints = Math.min(bearishPoints, corpScore >= 35 ? 48 : 64);
  }
  return {
    bullishPoints,
    bearishPoints,
    detectedPatternEn,
    detectedPatternMl,
    vwapVal,
  };
}
