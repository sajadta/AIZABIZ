import type { CandleData, IndicatorReadings, StrategyKey, TradingSignal } from '../../types';
import type { RealOptionMetrics } from './optionTypes';
import { calculateATR } from './calculations';
import { selectSessionCandles, computeSessionVwap } from './session';
import { buildIndicatorReadings } from './signals/readings';
import { buildTargetForecast } from './signals/targetForecast';
import { runConfluenceEngine } from './signals/confluenceEngine';
import { buildOptionPremiumPlan } from './signals/optionPremiumPlan';
import { decideSignalDirection } from './signals/signalDecision';
import { resolveOptionContract } from './signals/optionContract';
import {
  buildMultiLegDetails,
  buildRecommendedOptionStrike,
  resolveFallbackLot,
} from './signals/executionPlan';

export function analyzeTradingSignals(
  symbol: string,
  name: string,
  instrumentKey: string,
  candles: CandleData[],
  currentLtp: number,
  strategy: StrategyKey = 'PROFIT_MAX_100_PERCENT_MATRIX',
  realOptionPrice?: number,
  optionMetrics?: RealOptionMetrics,
): TradingSignal | null {
  if (!candles || candles.length < 20) return null;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const ema9 = last.ema9 ?? currentLtp;
  const ema21 = last.ema21 ?? currentLtp;
  const ema50 = last.ema50 ?? currentLtp;
  const rsi = last.rsi ?? 50;
  const supertrendDir = last.supertrendDir ?? 'BUY';
  const supertrendVal = last.supertrend ?? currentLtp * 0.98;
  const macdHist = last.macdHist ?? 0;
  const prevMacdHist = prev.macdHist ?? 0;
  const adxValue = Number(last.adx ?? 20);
  const atrSeries = calculateATR(candles, 14);
  const atr14 =
    atrSeries.length > 0 ? atrSeries[atrSeries.length - 1] : Math.max(1, last.high - last.low);

  // Identify today's intraday session candles for the intraday VWAP context.
  const sessionCandles = selectSessionCandles(candles);
  const vwapPrice = computeSessionVwap(sessionCandles, currentLtp);

  // Evaluate individual indicator signals
  const readings: IndicatorReadings = buildIndicatorReadings({
    currentLtp,
    ema9,
    ema21,
    ema50,
    rsi,
    supertrendDir,
    supertrendVal,
    macdLine: last.macd,
    macdSignal: last.macdSignal,
    macdHist,
    prevMacdHist,
    adxValue,
    vwapPrice,
  });

  const confluence = runConfluenceEngine({
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
  });
  const { bullishPoints, bearishPoints } = confluence;
  const {
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
  } = confluence;

  const decision = decideSignalDirection({
    symbol,
    currentLtp,
    supertrendVal,
    vwapVal,
    rvol,
    adxVal,
    corpScore,
    bullishPoints,
    bearishPoints,
    tf15m,
    isSidewaysChopRegime,
    isCorporateMtfBullBlocked,
    isCorporateMtfBearBlocked,
    isStrongTechUptrend,
    isStrongTechDowntrend,
  });
  const { signalType, confidence, stopLoss, target1, target2, target3 } = decision;
  let { rationale, rationaleMalayalam } = decision;
  const { indexPrefix, strikeStep, totalBullishConfidence, totalBearishConfidence } = decision;

  const riskDiff = Math.abs(currentLtp - stopLoss);
  const rewardDiff = Math.abs(target1 - currentLtp);
  const rrRatio = `1:${(rewardDiff / (riskDiff || 1)).toFixed(1)}`;

  const { isBullish, optType, chosenStrike, optSymbol } = resolveOptionContract({
    symbol,
    signalType,
    isStrongTechUptrend,
    isStrongTechDowntrend,
    totalBullishConfidence,
    totalBearishConfidence,
    corpScore,
    optionMetrics,
    currentLtp,
    strikeStep,
    indexPrefix,
  });

  const premiumPlan = buildOptionPremiumPlan({
    optSymbol,
    indexPrefix,
    isBullish,
    atr14,
    currentLtp,
    nearestSupport,
    nearestResistance,
    realOptionPrice,
    optionMetrics,
    stopLoss,
    target1,
    target2,
    target3,
    rationale,
    rationaleMalayalam,
  });
  const { optEntry, optSL, optT1, optT2, optT3 } = premiumPlan;
  rationale = premiumPlan.rationale;
  rationaleMalayalam = premiumPlan.rationaleMalayalam;

  const { fallbackLotSz, fallbackCharges } = resolveFallbackLot({
    indexPrefix,
    optionMetrics,
    optEntry,
    optT1,
    optSymbol,
  });

  const forecast = buildTargetForecast({
    isBullish,
    atr14,
    nearestResistance,
    nearestSupport,
    optEntry,
    optT1,
    currentLtp,
    delta: Math.abs(optionMetrics?.delta ?? 0.52),
    gamma: Math.abs(optionMetrics?.gamma ?? 0.0015),
    affordableLots: optionMetrics?.affordableLots,
    estimatedBrokerage: optionMetrics?.estimatedBrokerage,
    roundTripCharges: fallbackCharges?.roundTripCharges,
    lotSize: fallbackLotSz,
  });
  const {
    clearRunwayPoints,
    estimatedMaxOptionPrice,
    estimatedMinutesToTarget,
    estimatedNetProfitRange,
  } = forecast;

  return {
    id: `sig_${symbol}_${Date.now()}`,
    symbol: optSymbol || symbol,
    name,
    instrumentKey: optionMetrics?.instrumentKey || instrumentKey,
    underlyingInstrumentKey: instrumentKey,
    signalType,
    strategyName:
      strategy === 'SUPERTREND_EMA_CONFLUENCE'
        ? 'SuperTrend & EMA Confluence'
        : strategy === 'RSI_MOMENTUM_BREAKOUT'
          ? 'RSI Momentum Breakout'
          : strategy === 'VWAP_INSTITUTIONAL_REVERSION'
            ? 'VWAP Institutional Bounce'
            : '7-Layer Institutional Profit Matrix',
    confidenceScore: confidence,
    confidence,
    price: optEntry,
    stopLoss: optSL,
    target1: optT1,
    target2: optT2,
    target3: optT3,
    riskRewardRatio: rrRatio,
    rationale,
    rationaleMalayalam,
    indicators: readings,
    candlestickPattern: detectedPatternEn,
    candlestickPatternMalayalam: detectedPatternMl,
    mtfConfirmation: {
      status:
        (isBullish && tf5m === 'BULLISH' && tf15m !== 'BEARISH') ||
        (!isBullish && tf5m === 'BEARISH' && tf15m !== 'BULLISH'),
      timeframe5m: tf5m,
      timeframe15m: tf15m,
    },
    institutionalQuantAnalysis: {
      chartStructurePattern: chartStructureEn,
      chartStructurePatternMl: chartStructureMl,
      nearestSupport,
      nearestResistance,
      clearRunwayPoints,
      corporateHeavyweightScore: corpScore,
      corporateHeavyweightSummary: corpSummary,
      globalMacroAlignment: macroAlign,
      oiBuildupType: oiBuildupDesc,
      estimatedMinutesToTarget,
      estimatedMaxOptionPrice,
      estimatedNetProfitRange,
      fiveYearRegimeSummary: fiveYrSummaryEn,
      fiveYearRegimeSummaryMl: fiveYrSummaryMl,
      multiYearSupport: multiYrSup,
      multiYearResistance: multiYrRes,
      historicalWinProbability: histWinProb,
      indiaVix: indiaVixVal,
      marketRegimeMode,
      optionExecutionSide:
        signalType === 'BUY' || signalType === 'SELL'
          ? 'OPTION_BUYING'
          : marketRegimeMode === 'LOW_VIX_RANGE_GUARD'
            ? 'MULTI_LEG_STRANGLE'
            : 'OPTION_SELLING',
      multiLegDetails: buildMultiLegDetails({
        adxValue,
        chosenStrike,
        strikeStep,
        optEntry,
        optionMetrics,
        lotSize: fallbackLotSz,
      }),
    },
    recommendedOptionStrike: buildRecommendedOptionStrike({
      optSymbol,
      chosenStrike,
      optType,
      optEntry,
      optT1,
      isBullish,
      fallbackLotSz,
      fallbackCharges,
      optionMetrics,
      currentLtp,
    }),
    timestamp: new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    status: 'ACTIVE',
  };
}
