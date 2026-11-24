// Core confluence scoring engine: 11 layered checks that convert indicator
// readings into bullish/bearish points, trend gates and the market regime mode.
import type { CandleData, IndicatorReadings } from '../../../types';
import type { RealOptionMetrics } from '../optionTypes';
import { computeSessionVwap } from '../session';
import { buildMtfTrend } from './mtfTrend';
import { detectCandlePattern } from './candlePatterns';
import { evaluateVolumeRegime } from './volumeRegime';
import { applyOptionLayer } from './optionLayer';

export interface ConfluenceEngineParams {
  candles: CandleData[];
  last: CandleData;
  prev: CandleData;
  readings: IndicatorReadings;
  ema9: number;
  ema21: number;
  ema50: number;
  rsi: number;
  macdHist: number;
  prevMacdHist: number;
  adxValue: number;
  atr14: number;
  sessionCandles: CandleData[];
  vwapPrice: number;
  currentLtp: number;
  optionMetrics?: RealOptionMetrics;
}

export interface ConfluenceEngineResult {
  bullishPoints: number;
  bearishPoints: number;
  rvol: number;
  tf5m: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  tf15m: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  detectedPatternEn: string;
  detectedPatternMl: string;
  chartStructureEn: string;
  chartStructureMl: string;
  nearestSupport: number;
  nearestResistance: number;
  corpScore: number;
  corpSummary: string;
  macroAlign: 'BULLISH' | 'BEARISH' | 'MIXED';
  fiveYrSummaryEn: string;
  fiveYrSummaryMl: string;
  multiYrSup: number;
  multiYrRes: number;
  histWinProb: number;
  isStrongTechUptrend: boolean;
  isStrongTechDowntrend: boolean;
  isCorporateMtfBullBlocked: boolean;
  isCorporateMtfBearBlocked: boolean;
  isSidewaysChopRegime: boolean;
  adxVal: number;
  vwapVal: number;
  indiaVixVal: number;
  marketRegimeMode: 'TRENDING_OPTION_BUYING' | 'HIGH_VIX_BREAKOUT' | 'LOW_VIX_RANGE_GUARD';
  oiBuildupDesc: string;
  effectiveOptDir: string;
}

export function runConfluenceEngine(params: ConfluenceEngineParams): ConfluenceEngineResult {
  const {
    candles,
    last,
    prev,
    readings,
    ema9,
    ema21,
    ema50,
    rsi,
    macdHist,
    prevMacdHist,
    adxValue,
    atr14,
    sessionCandles,
    vwapPrice,
    currentLtp,
    optionMetrics,
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
    isDarkPoolBullishBlock,
    isDarkPoolBearishBlock,
    neuralQuantConfidenceWeight,
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

  // 10.5 MULTI-CANDLE PATTERN RECOGNITION, CHART HISTORY STRUCTURE (HH/HL, DOUBLE BOTTOM/TOP, S/R RUNWAY),
  // 5m/15m MTF CONFLUENCE, CORPORATE HEAVYWEIGHTS & GLOBAL MACRO ALIGNMENT ENGINE
  // A single unclosed green/red candle is NEVER trusted on its own (prevents 1-second green-to-red retail bull/bear traps!).
  const prev2 = candles[Math.max(0, candles.length - 3)];
  const prev3 = candles[Math.max(0, candles.length - 4)];
  const prev5 = candles[Math.max(0, candles.length - 6)];
  const move1m = currentLtp - prev.close;
  const move2m = currentLtp - prev2.close;
  const move3m = currentLtp - prev3.close;
  const move5m = currentLtp - prev5.close;

  const candlePattern = detectCandlePattern(prev, prev2, prev3, currentLtp);
  let detectedPatternEn = candlePattern.patternEn;
  let detectedPatternMl = candlePattern.patternMl;
  const {
    isBullishEngulfing: isClosedBullishEngulfing,
    isBearishEngulfing: isClosedBearishEngulfing,
    isHammerSupport: isClosedHammerSupport,
    isShootingStarResistance: isClosedShootingStarResistance,
  } = candlePattern;
  bullishPoints += candlePattern.bullishPoints;
  bearishPoints += candlePattern.bearishPoints;

  const tf5m = buildMtfTrend(candles, currentLtp, 5);
  const tf15m = buildMtfTrend(candles, currentLtp, 15);
  if (tf5m === 'BULLISH' && tf15m === 'BULLISH') bullishPoints += 18;
  else if (tf5m === 'BEARISH' && tf15m === 'BEARISH') bearishPoints += 18;
  else if (tf5m === 'BULLISH' && tf15m !== 'BEARISH') bullishPoints += 8;
  else if (tf5m === 'BEARISH' && tf15m !== 'BULLISH') bearishPoints += 8;

  // C. Historical Chart Structure (60-Candle Major Swing Highs/Lows, HH-HL / LH-LL, Double Bottom/Top & S/R Runway)
  const historySlice = candles.slice(-Math.min(60, candles.length));
  const priorHistory = historySlice.slice(0, Math.max(5, historySlice.length - 3));
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  for (let i = 4; i < priorHistory.length - 4; i++) {
    const c = priorHistory[i];
    if (
      c.high >= priorHistory[i - 1].high &&
      c.high >= priorHistory[i - 2].high &&
      c.high >= priorHistory[i - 3].high &&
      c.high >= priorHistory[i + 1].high &&
      c.high >= priorHistory[i + 2].high &&
      c.high >= priorHistory[i + 3].high
    ) {
      swingHighs.push(c.high);
    }
    if (
      c.low <= priorHistory[i - 1].low &&
      c.low <= priorHistory[i - 2].low &&
      c.low <= priorHistory[i - 3].low &&
      c.low <= priorHistory[i + 1].low &&
      c.low <= priorHistory[i + 2].low &&
      c.low <= priorHistory[i + 3].low
    ) {
      swingLows.push(c.low);
    }
  }

  let chartStructureEn = 'Institutional Trend Continuation';
  let chartStructureMl = 'ഇൻസ്റ്റിറ്റ്യൂഷണൽ ട്രെൻഡ് തുടർച്ച';

  if (swingLows.length >= 2) {
    const lastLow = swingLows[swingLows.length - 1];
    const prevLow = swingLows[swingLows.length - 2];
    if (Math.abs(lastLow - prevLow) <= atr14 * 0.8 && currentLtp > lastLow + atr14) {
      chartStructureEn = 'Double Bottom (W-Pattern) Support Breakout';
      chartStructureMl = 'ഡബിൾ ബോട്ടം (W-Pattern) സപ്പോർട്ട് ബ്രേക്ക്ഔട്ട്';
      bullishPoints += 12;
    } else if (lastLow > prevLow && currentLtp > ema21) {
      chartStructureEn = 'Higher-High / Higher-Low (HH-HL) Uptrend Structure';
      chartStructureMl = 'ഹയർ-ഹൈ / ഹയർ-ലോ (HH-HL) അപ്‌ട്രെൻഡ് സ്ട്രക്ചർ';
      bullishPoints += 10;
    }
  }
  if (swingHighs.length >= 2) {
    const lastHigh = swingHighs[swingHighs.length - 1];
    const prevHigh = swingHighs[swingHighs.length - 2];
    if (Math.abs(lastHigh - prevHigh) <= atr14 * 0.8 && currentLtp < lastHigh - atr14) {
      chartStructureEn = 'Double Top (M-Pattern) Supply Breakdown';
      chartStructureMl = 'ഡബിൾ ടോപ്പ് (M-Pattern) റെസിസ്റ്റൻസ് ബ്രേക്ക്ഡൗൺ';
      bearishPoints += 12;
    } else if (lastHigh < prevHigh && currentLtp < ema21) {
      chartStructureEn = 'Lower-High / Lower-Low (LH-LL) Downtrend Structure';
      chartStructureMl = 'ലോവർ-ഹൈ / ലോവർ-ലോ (LH-LL) ഡൗൺട്രെൻഡ് സ്ട്രക്ചർ';
      bearishPoints += 10;
    }
  }

  // D. Corporate Heavyweights Flow & Global/Macro Market Alignment
  const corpScore = Number(optionMetrics?.corporateHeavyweightScore ?? 0);
  const corpSummary =
    optionMetrics?.corporateHeavyweightSummary ||
    'Heavyweights (HDFCBANK, RELIANCE, ICICIBANK, INFY, TCS) Tracked';
  const macroAlign =
    optionMetrics?.globalMacroAlignment ||
    (tf15m === 'BULLISH' ? 'BULLISH' : tf15m === 'BEARISH' ? 'BEARISH' : 'MIXED');

  // Calculate Nearest Resistance & Nearest Support + Resistance-Shattering Breakout Engine
  const resistancesAbove = swingHighs
    .filter((h) => h > currentLtp + atr14 * 0.3)
    .sort((a, b) => a - b);
  const supportsBelow = swingLows.filter((l) => l < currentLtp - atr14 * 0.3).sort((a, b) => b - a);
  const callWall =
    optionMetrics?.callWallStrike && optionMetrics.callWallStrike > currentLtp
      ? optionMetrics.callWallStrike
      : 0;
  const putWall =
    optionMetrics?.putWallStrike && optionMetrics.putWallStrike < currentLtp
      ? optionMetrics.putWallStrike
      : 0;

  let nearestResistance = Number(
    (
      resistancesAbove[0] ||
      (callWall > 0 ? callWall : currentLtp + Math.max(atr14 * 3.2, currentLtp * 0.004))
    ).toFixed(2),
  );
  let nearestSupport = Number(
    (
      supportsBelow[0] ||
      (putWall > 0 ? putWall : currentLtp - Math.max(atr14 * 3.2, currentLtp * 0.004))
    ).toFixed(2),
  );

  // Check if price is approaching Resistance/Support WITH Resistance-Shattering Breakout Power (RVOL + OI Short Covering + Heavyweights + MACD)
  const distToRes = nearestResistance - currentLtp;
  const distToSup = currentLtp - nearestSupport;
  const hasBullBreakoutPower =
    rvol >= 1.15 ||
    corpScore >= 15 ||
    macdHist > 0 ||
    move2m > atr14 * 0.5 ||
    Number(optionMetrics?.oiChange ?? 0) < 0 ||
    Number(optionMetrics?.bidAskRatio ?? 1.0) >= 1.08;
  const hasBearBreakdownPower =
    rvol >= 1.15 ||
    corpScore <= -15 ||
    macdHist < 0 ||
    move2m < -atr14 * 0.5 ||
    Number(optionMetrics?.oiChange ?? 0) < 0 ||
    Number(optionMetrics?.bidAskRatio ?? 1.0) >= 1.08;

  let isBlockedByResistanceWall = false;
  let isBlockedBySupportWall = false;

  if (distToRes <= atr14 * 0.85) {
    if (hasBullBreakoutPower && (currentLtp >= prev.close || move1m > 0)) {
      // Resistance is being SHATTERED! Shift target runway to the next higher resistance (R2) and boost score!
      nearestResistance = Number(
        (
          resistancesAbove[1] || nearestResistance + Math.max(atr14 * 3.0, currentLtp * 0.0035)
        ).toFixed(2),
      );
      chartStructureEn = `Resistance-Shattering Breakout (RVOL ${rvol}x + Short Covering)`;
      chartStructureMl = `റെസിസ്റ്റൻസ് ഭേദിച്ചുള്ള വോളിയം ബ്രേക്ക്ഔട്ട് (RVOL ${rvol}x)`;
      bullishPoints += 14;
    } else if (move1m <= 0 && move2m <= 0) {
      // Stalling right under resistance without momentum -> Trap Protection!
      isBlockedByResistanceWall = true;
    }
  }

  if (distToSup <= atr14 * 0.85) {
    if (hasBearBreakdownPower && (currentLtp <= prev.close || move1m < 0)) {
      // Support is being SHATTERED! Shift target runway to the next lower support (S2) and boost score!
      nearestSupport = Number(
        (supportsBelow[1] || nearestSupport - Math.max(atr14 * 3.0, currentLtp * 0.0035)).toFixed(
          2,
        ),
      );
      chartStructureEn = `Support-Shattering Breakdown (RVOL ${rvol}x + Long Unwinding)`;
      chartStructureMl = `സപ്പോർട്ട് ഭേദിച്ചുള്ള ശക്തമായ ബ്രേക്ക്ഡൗൺ (RVOL ${rvol}x)`;
      bearishPoints += 14;
    } else if (move1m >= 0 && move2m >= 0) {
      // Stalling right above support without downward momentum -> Trap Protection!
      isBlockedBySupportWall = true;
    }
  }

  const earlyCorpDivergencePenalty =
    (corpScore <= -25 &&
      tf15m === 'BULLISH' &&
      readings.supertrend.signal === 'BUY' &&
      currentLtp > vwapPrice) ||
    (corpScore >= 25 &&
      tf15m === 'BEARISH' &&
      readings.supertrend.signal === 'SELL' &&
      currentLtp < vwapPrice);

  if (corpScore >= 25) {
    bullishPoints += 12;
    bearishPoints -= earlyCorpDivergencePenalty ? 5 : 15;
  } else if (corpScore <= -25) {
    bearishPoints += 12;
    bullishPoints -= earlyCorpDivergencePenalty ? 5 : 15;
  }

  if (macroAlign === 'BULLISH') bullishPoints += 8;
  else if (macroAlign === 'BEARISH') bearishPoints += 8;

  // D2. 5-Year Historical Daily/Weekly Macro Regime, 200-Day/50-Day EMA & Multi-Year Support/Resistance Confluence
  const fiveYearTrend = optionMetrics?.fiveYearRegimeTrend || 'BULLISH_SECULAR';
  const multiYrSup = Number(optionMetrics?.multiYearSupport || nearestSupport);
  const multiYrRes = Number(optionMetrics?.multiYearResistance || nearestResistance);
  const histWinProb = Number(optionMetrics?.historicalPatternWinRate || 86);
  const fiveYrSummaryEn =
    optionMetrics?.fiveYearRegimeSummary ||
    `5Y Daily/Weekly Regime: ${fiveYearTrend === 'BULLISH_SECULAR' ? 'Above 50D & 200D EMA' : fiveYearTrend === 'BEARISH_CORRECTION' ? 'Below 50D EMA Supply' : 'Multi-Year S/R Zone'} (S: ₹${multiYrSup} | R: ₹${multiYrRes})`;
  const fiveYrSummaryMl =
    optionMetrics?.fiveYearRegimeSummaryMl ||
    `5-വർഷ ചാർട്ട് ഹിസ്റ്ററി: ${fiveYearTrend === 'BULLISH_SECULAR' ? '50D/200D EMA-യ്ക്ക് മുകളിൽ ബുള്ളിഷ്' : fiveYearTrend === 'BEARISH_CORRECTION' ? '50D EMA-യ്ക്ക് താഴെ ബെയറിഷ്' : 'മൾട്ടി-ഇയർ സപ്പോർട്ട്/റെസിസ്റ്റൻസ് സോൺ'} (Win Prob: ${histWinProb}%)`;

  if (fiveYearTrend === 'BULLISH_SECULAR') {
    bullishPoints += 8;
  } else if (fiveYearTrend === 'BEARISH_CORRECTION') {
    bearishPoints += 8;
  }
  // If spot is breaking above a multi-year/multi-month swing high with volume, boost breakout score!
  if (
    multiYrRes > 0 &&
    Math.abs(currentLtp - multiYrRes) / (currentLtp || 1) <= 0.0025 &&
    hasBullBreakoutPower
  ) {
    bullishPoints += 8;
  }
  if (
    multiYrSup > 0 &&
    Math.abs(currentLtp - multiYrSup) / (currentLtp || 1) <= 0.0025 &&
    hasBearBreakdownPower
  ) {
    bearishPoints += 8;
  }

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

  // CORPORATE HEDGE FUND / PROP DESK MULTI-TIMEFRAME & ROLLING VWAP TREND VETO
  // Also compute 30-min rolling VWAP so mid-day trend reversals (e.g. +220pt rally rolling into -120pt crash)
  // are caught immediately without waiting all afternoon for 09:15 AM's stale session average!
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

  if (isCorporateMtfBullBlocked) {
    bullishPoints = Math.min(bullishPoints, 35);
  }
  if (isCorporateMtfBearBlocked) {
    bearishPoints = Math.min(bearishPoints, 35);
  }

  // Real Multi-Bar Compression / Chop Box Filter:
  // Detects narrow sideways consolidation boxes (e.g. <0.14% 12-bar range with EMA crossbacks & ADX < 20)
  // so the bot refuses to buy losing options inside dead sideways chop and ONLY triggers on real expansion!
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

  // India VIX & Market Regime Selection (Trending Option Buying vs High-VIX Breakout vs Low-VIX Range Guard)
  const indiaVixVal = Number(optionMetrics?.indiaVix || 13.8);
  const marketRegimeMode: 'TRENDING_OPTION_BUYING' | 'HIGH_VIX_BREAKOUT' | 'LOW_VIX_RANGE_GUARD' =
    adxValue < 16 || (indiaVixVal > 0 && indiaVixVal < 11.5)
      ? 'LOW_VIX_RANGE_GUARD'
      : indiaVixVal >= 18
        ? 'HIGH_VIX_BREAKOUT'
        : 'TRENDING_OPTION_BUYING';

  // 11. LAYER 2: Live Option Premium, Greeks, Volume & Order Book Depth Validation
  const optionLayer = applyOptionLayer({
    optionMetrics,
    bullishPoints,
    bearishPoints,
    corpScore,
    rvol,
  });
  bullishPoints = optionLayer.bullishPoints;
  bearishPoints = optionLayer.bearishPoints;
  const oiBuildupDesc = optionLayer.oiBuildupDesc;
  const effectiveOptDir = optionLayer.effectiveOptDir;
  return {
    bullishPoints,
    bearishPoints,
    rvol,
    tf5m,
    tf15m,
    detectedPatternEn,
    detectedPatternMl,
    chartStructureEn,
    chartStructureMl,
    nearestSupport,
    nearestResistance,
    corpScore,
    corpSummary,
    macroAlign,
    fiveYrSummaryEn,
    fiveYrSummaryMl,
    multiYrSup,
    multiYrRes,
    histWinProb,
    isStrongTechUptrend,
    isStrongTechDowntrend,
    isCorporateMtfBullBlocked,
    isCorporateMtfBearBlocked,
    isSidewaysChopRegime,
    adxVal,
    vwapVal,
    indiaVixVal,
    marketRegimeMode,
    oiBuildupDesc,
    effectiveOptDir,
  };
}
