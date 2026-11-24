import type { CandleData, IndicatorReadings, StrategyKey, TradingSignal } from '../../types';
import type { RealOptionMetrics } from './optionTypes';
import { calculateATR } from './calculations';
import { calculateTradeCharges } from './tradeMath';
import { selectSessionCandles, computeSessionVwap } from './session';
import {
  calculateVwapSigmaBands,
  evaluateDepthPressure,
  detect0DteGammaExplosion,
} from './institutionalQuant';
import { buildIndicatorReadings } from './signals/readings';
import { buildTargetForecast } from './signals/targetForecast';
import { runConfluenceEngine } from './signals/confluenceEngine';
import { buildOptionPremiumPlan } from './signals/optionPremiumPlan';
import { decideSignalDirection } from './signals/signalDecision';

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

  // Identify today's intraday session candles and compute the intraday VWAP & Multi-Sigma Bands.
  const sessionCandles = selectSessionCandles(candles);
  const vwapPrice = computeSessionVwap(sessionCandles, currentLtp);
  const vwapSigma = calculateVwapSigmaBands(
    sessionCandles.length > 0 ? sessionCandles : candles,
    currentLtp,
  );
  const isGammaExploding0Dte = detect0DteGammaExplosion(
    sessionCandles.length > 0 ? sessionCandles : candles,
    currentLtp,
  );
  const depthScore = evaluateDepthPressure(
    Number(optionMetrics?.bidQty || 1000),
    Number(optionMetrics?.askQty || 1000),
  );

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
  const symUpper = symbol.toUpperCase();

  const riskDiff = Math.abs(currentLtp - stopLoss);
  const rewardDiff = Math.abs(target1 - currentLtp);
  const rrRatio = `1:${(rewardDiff / (riskDiff || 1)).toFixed(1)}`;

  const isBullish =
    signalType === 'BUY' ||
    (signalType === 'HOLD' &&
      (isStrongTechUptrend ||
        (!isStrongTechDowntrend &&
          totalBullishConfidence > totalBearishConfidence &&
          corpScore >= -15)));
  const optType: 'CE' | 'PE' =
    optionMetrics && Number(optionMetrics.ltp) > 0 && optionMetrics.optionType
      ? optionMetrics.optionType
      : isBullish
        ? 'CE'
        : 'PE';
  const defaultStrike = Math.round(currentLtp / strikeStep) * strikeStep;
  const chosenStrike = optionMetrics?.strikePrice || defaultStrike;

  let optSymbol = optionMetrics?.optionSymbol || '';
  if (
    !optSymbol &&
    (symUpper.includes('NIFTY') ||
      symUpper.includes('SENSEX') ||
      symUpper.includes('BANKEX') ||
      symUpper.includes('MIDCP'))
  ) {
    optSymbol = `${indexPrefix} ${chosenStrike} ${optType}`;
  }

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

  const defaultLotForFallback =
    indexPrefix === 'BANKNIFTY' || indexPrefix === 'BANKEX'
      ? 30
      : indexPrefix === 'SENSEX'
        ? 20
        : indexPrefix === 'MIDCPNIFTY'
          ? 120
          : indexPrefix === 'FINNIFTY'
            ? 60
            : 65;
  const fallbackLotSz =
    optionMetrics?.lotSize && optionMetrics.lotSize > 1
      ? optionMetrics.lotSize
      : defaultLotForFallback;
  const fallbackCharges = optSymbol
    ? calculateTradeCharges(optEntry, fallbackLotSz, true, optT1)
    : undefined;

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
      multiLegDetails: {
        strategyType: adxValue < 16 ? 'SHORT_STRANGLE' : 'SHORT_STRADDLE',
        callStrike: chosenStrike + (adxValue < 16 ? strikeStep * 2 : 0),
        callLtp: Number((optEntry * 0.85).toFixed(2)),
        putStrike: chosenStrike - (adxValue < 16 ? strikeStep * 2 : 0),
        putLtp: Number((optEntry * 0.82).toFixed(2)),
        combinedPremiumCollected: Number((optEntry * 1.67).toFixed(2)),
        thetaDecayPerDayRupees: Math.round(
          Math.abs(optionMetrics?.theta ?? 8) * 1.8 * fallbackLotSz,
        ),
        upperBreakeven: Math.round(chosenStrike + strikeStep * 2 + optEntry * 1.67),
        lowerBreakeven: Math.round(chosenStrike - strikeStep * 2 - optEntry * 1.67),
      },
    },
    recommendedOptionStrike: optSymbol
      ? {
          strikePrice: chosenStrike,
          optionType: optType,
          ltp: optEntry,
          expiry: optionMetrics?.expiry || 'Current Weekly',
          delta: Number((optionMetrics?.delta ?? (isBullish ? 0.54 : -0.54)).toFixed(2)),
          lotSize: optionMetrics?.lotSize || fallbackLotSz,
          iv: optionMetrics?.iv,
          oi: optionMetrics?.oi,
          volume: optionMetrics?.volume,
          instrumentKey: optionMetrics?.instrumentKey,
          requiredCapital: optionMetrics?.requiredCapital ?? fallbackCharges?.tradeValue,
          estimatedBrokerage:
            optionMetrics?.estimatedBrokerage ?? fallbackCharges?.roundTripCharges,
          totalRequiredWithBrokerage:
            optionMetrics?.totalRequiredWithBrokerage ??
            fallbackCharges?.totalRequiredWithBrokerage,
          expectedNetProfit:
            optionMetrics?.expectedNetProfit ??
            (fallbackCharges
              ? Number(
                  ((optT1 - optEntry) * fallbackLotSz - fallbackCharges.roundTripCharges).toFixed(
                    2,
                  ),
                )
              : undefined),
          affordableLots: optionMetrics?.affordableLots,
          availableCapital: optionMetrics?.availableCapital,
          underlyingSpot: currentLtp,
        }
      : undefined,
    timestamp: new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    status: 'ACTIVE',
  };
}
