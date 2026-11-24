// Core confluence scoring engine: 11 layered checks that convert indicator
// readings into bullish/bearish points, trend gates and the market regime mode.
import type { CandleData, IndicatorReadings } from '../../../types';
import type { RealOptionMetrics } from '../optionTypes';
import { buildMtfTrend } from './mtfTrend';
import { detectCandlePattern } from './candlePatterns';
import { evaluateVolumeRegime } from './volumeRegime';
import { applyOptionLayer } from './optionLayer';
import { analyzeSwingStructure } from './swingStructure';
import { applyLevelConfluence } from './levelConfluence';
import { applyConfirmationGates } from './confirmationGates';
import { applyTrendVeto } from './trendVeto';

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

  const {
    swingHighs,
    swingLows,
    chartStructureEn: initialStructureEn,
    chartStructureMl: initialStructureMl,
    bullishPointsDelta: structureBullPoints,
    bearishPointsDelta: structureBearPoints,
  } = analyzeSwingStructure({ candles, currentLtp, atr14, ema21 });
  let chartStructureEn = initialStructureEn;
  let chartStructureMl = initialStructureMl;
  bullishPoints += structureBullPoints;
  bearishPoints += structureBearPoints;

  const levelConfluence = applyLevelConfluence({
    optionMetrics,
    swingHighs,
    swingLows,
    currentLtp,
    atr14,
    rvol,
    macdHist,
    move1m,
    move2m,
    prevClose: prev.close,
    tf15m,
    supertrendSignal: readings.supertrend.signal as 'BUY' | 'SELL',
    vwapPrice,
    chartStructureEn,
    chartStructureMl,
  });
  bullishPoints += levelConfluence.bullishPointsDelta;
  bearishPoints += levelConfluence.bearishPointsDelta;
  chartStructureEn = levelConfluence.chartStructureEn;
  chartStructureMl = levelConfluence.chartStructureMl;
  const {
    corpScore,
    corpSummary,
    macroAlign,
    nearestSupport,
    nearestResistance,
    isBlockedByResistanceWall,
    isBlockedBySupportWall,
    fiveYrSummaryEn,
    fiveYrSummaryMl,
    multiYrSup,
    multiYrRes,
    histWinProb,
  } = levelConfluence;

  const gates = applyConfirmationGates({
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
    isClosedBullishEngulfing: isClosedBullishEngulfing,
    isClosedBearishEngulfing: isClosedBearishEngulfing,
    isClosedHammerSupport: isClosedHammerSupport,
    isClosedShootingStarResistance: isClosedShootingStarResistance,
    detectedPatternEn,
    detectedPatternMl,
    bullishPoints,
    bearishPoints,
  });
  bullishPoints = gates.bullishPoints;
  bearishPoints = gates.bearishPoints;
  detectedPatternEn = gates.detectedPatternEn;
  detectedPatternMl = gates.detectedPatternMl;
  const vwapVal = gates.vwapVal;

  const veto = applyTrendVeto({
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
    bullishPoints,
    bearishPoints,
    optionMetrics,
  });
  bullishPoints = veto.bullishPoints;
  bearishPoints = veto.bearishPoints;
  const {
    isStrongTechUptrend,
    isStrongTechDowntrend,
    isCorporateMtfBullBlocked,
    isCorporateMtfBearBlocked,
    isSidewaysChopRegime,
    indiaVixVal,
    marketRegimeMode,
  } = veto;

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
