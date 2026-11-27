// Core confluence scoring engine: 11 layered checks that convert indicator
// readings into bullish/bearish points, trend gates and the market regime mode.
import type { CandleData, IndicatorReadings } from '../../../types';
import type { RealOptionMetrics } from '../optionTypes';
import { buildMtfTrend } from './mtfTrend';
import { detectCandlePattern } from './candlePatterns';
import { applyCoreScoring } from './coreScoring';
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

  const core = applyCoreScoring({
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
  });
  let bullishPoints = core.bullishPoints;
  let bearishPoints = core.bearishPoints;
  const { rvol, adxVal, isDeadSidewaysChop, isOpening3mWhipsaw } = core;

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
