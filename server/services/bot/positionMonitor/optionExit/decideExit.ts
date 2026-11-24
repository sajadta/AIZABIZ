// Exit-decision engine for a single option position: dynamic peak-locked stops,
// trailing ladders, theta stagnation and maximum-runway harvest rules.
import { botConfig, botLogs, livePositionStateTracker } from '../../../../state';
import { calculateTradeCharges } from '../../../../../src/utils/indicators';
import { detectUnderlyingReversal, isCallOptionSymbol } from '../underlyingReversal';
import { evaluateOptionTrend } from '../optionTrend';
import { computeTrailingStopLadder } from '../trailingLadder';
import { resolveOptionPositionAccounting } from './positionAccounting';
import { buildLiveTrajectoryRadar } from './liveTrajectoryRadar';
import { evaluateOptionExitRules } from './exitRules';

export interface OptionExitDecisionParams {
  pos: any;
  isEodSquareOff: boolean;
  isBtstHoldRecommended: boolean;
  latestUnderlyingSig: any;
  openedMs: number;
  optCandlesActive: any[];
}

export interface OptionExitDecision {
  shouldSell: boolean;
  sellReason: string;
  dynamicStopLossPrice: number;
  qty: number;
  posProdCode: string;
  posTrackerKey: string;
}

export async function decideOptionExit(
  params: OptionExitDecisionParams,
): Promise<OptionExitDecision> {
  const {
    pos,
    isEodSquareOff,
    isBtstHoldRecommended,
    latestUnderlyingSig,
    openedMs,
    optCandlesActive,
  } = params;
  let isOption1mTrendIntact = true;
  let isOptionClimaxReversal = false;
  let isOption1mBreakingDown = false;

  const ltp = Number(pos.currentLTP || pos.buyPrice);
  pos.highestLTP = Math.max(pos.highestLTP || pos.buyPrice, ltp);

  const rawForecast = Number(
    pos.estimatedMaxOptionPrice ||
      pos.target2 ||
      pos.target ||
      pos.buyPrice * (1 + (botConfig.targetProfitPercent || 30) / 100),
  );
  const estQty = Math.max(1, Number(pos.quantity || 1));
  const estRoundTripBrok = calculateTradeCharges(
    pos.buyPrice,
    estQty,
    true,
    pos.buyPrice * 1.6,
    pos.instrumentKey || pos.symbol,
  ).roundTripCharges;
  const minNetTargetRupees = pos.buyPrice * estQty <= 300 ? 55 : 110;
  const minProfitableForecast = Number(
    (pos.buyPrice + (estRoundTripBrok + minNetTargetRupees) / estQty).toFixed(2),
  );
  const isShortPosition = pos.type === 'SELL' || pos.optionStrategyType === 'OPTION_SELLING';
  const forecastedMaxPrice = isShortPosition
    ? rawForecast < pos.buyPrice
      ? rawForecast
      : Number((pos.buyPrice * 0.45).toFixed(2))
    : Math.max(
        minProfitableForecast,
        rawForecast > pos.buyPrice * 1.35
          ? rawForecast
          : Number(
              (
                pos.buyPrice *
                (1 + Math.max(40, botConfig.targetProfitPercent || 50) / 100)
              ).toFixed(2),
            ),
      );

  const optionTrend = evaluateOptionTrend({
    candles: optCandlesActive,
    ltp,
    buyPrice: pos.buyPrice,
    forecastedMaxPrice,
  });
  const avgOptionAtr = optionTrend.avgOptionAtr;
  isOption1mTrendIntact = optionTrend.isTrendIntact;
  isOption1mBreakingDown = optionTrend.isBreakingDown;
  isOptionClimaxReversal = optionTrend.isClimaxReversal;

  const pnlPercent = pos.buyPrice > 0 ? ((ltp - pos.buyPrice) / pos.buyPrice) * 100 : 0;
  let shouldSell = false;
  let sellReason = '';

  if (isEodSquareOff) {
    if (isBtstHoldRecommended) {
      if (!pos.btstHoldLogged) {
        botLogs.unshift({
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString(),
          message: `[DELIVERY BTST HOLD] ${pos.symbol} നിലവിൽ ലാഭകരമാകാൻ സാധ്യതയുള്ളതിനാൽ നാളത്തേക്ക് ഹോൾഡ് ചെയ്യുന്നു. (Sentiment: ${latestUnderlyingSig?.sentiment || 'BULLISH'})`,
          type: 'INFO',
        });
        pos.btstHoldLogged = true;
      }
    } else {
      shouldSell = true;
      sellReason = `End of day Auto Square-Off at 15:25 IST for ${pos.symbol}.`;
    }
  }

  const {
    qty,
    isMicroDeployedOpt,
    staticStopLossPrice,
    maxAllowedRupeeLoss,
    roundTripTax,
    posPnL,
    posNetPnL,
    posProdCode,
    posTrackerKey,
    activeTracker,
    isSmallCapitalSafeZone,
  } = await resolveOptionPositionAccounting(pos, ltp);

  // LIVE UNDERLYING INDEX PARAMETER RADAR (Checks live signal & indicators for the underlying index of this option!)
  const isCallOption = isCallOptionSymbol(pos.symbol);
  const { isUnderlyingParametersReversing, underlyingReversalDetails } = detectUnderlyingReversal(
    latestUnderlyingSig,
    isCallOption,
  );

  // 1. PEAK-LOCKED AUTO-MOVING STOP-LOSS & AUTO-EXPANDING TARGET ENGINE
  // Exact implementation of User's Rule:
  // - "When maximum profit is reached and parameters suggest next move could be down, DO NOT prematurely close the trade!
  //    Instead, FIX the Stop-Loss right at the Maximum Profit Point! That way, if it drops, the Stop-Loss triggers immediately
  //    and locks maximum profit; if it DOES NOT drop and keeps rising, we capture all that extra profit too!"
  // - "A candle oscillates up and down while forming — NEVER rely on candle color/oscillation alone! Always verify across
  //    ALL live market parameters (EMA9/21, SuperTrend, MACD, RSI, Corporate Heavyweights, Global Macro, Option Bid/Ask & OI)
  //    on every cycle before locking or exiting!"

  const sameContractSignal =
    latestUnderlyingSig &&
    ((latestUnderlyingSig.instrumentKey &&
      pos.instrumentKey &&
      latestUnderlyingSig.instrumentKey === pos.instrumentKey) ||
      (Number(latestUnderlyingSig.price || 0) > 0 &&
        Math.abs(Number(latestUnderlyingSig.price) - pos.buyPrice) <= pos.buyPrice * 0.45));
  const liveUnderlyingForecastPrice = sameContractSignal
    ? Number(latestUnderlyingSig?.institutionalQuantAnalysis?.estimatedMaxOptionPrice || 0)
    : 0;
  let dynamicTargetPrice = Math.max(forecastedMaxPrice, liveUnderlyingForecastPrice);
  if (ltp >= dynamicTargetPrice * 0.98 && !isUnderlyingParametersReversing) {
    // Resistance-Shattering Target Expansion: Automatically move target higher as price climbs!
    dynamicTargetPrice = Number(Math.max(dynamicTargetPrice * 1.08, ltp * 1.1).toFixed(2));
  }
  pos.target = dynamicTargetPrice;
  pos.estimatedMaxOptionPrice = dynamicTargetPrice;

  const perShareBrokerage = roundTripTax / Math.max(1, pos.quantity || 1);
  const breakEvenWithBrokerage = Number((pos.buyPrice + perShareBrokerage).toFixed(2));
  const minZeroLossPrice = Number(
    (breakEvenWithBrokerage + Math.max(0.15, perShareBrokerage * 0.3)).toFixed(2),
  );

  // Scale-Invariant Quantitative Metrics (Independent of capital, quantity, or strike price):
  const peakLtp = Number(pos.highestLTP || ltp);
  const peakGainPct =
    pos.buyPrice > 0 ? Number((((peakLtp - pos.buyPrice) / pos.buyPrice) * 100).toFixed(2)) : 0;
  const dropFromPeakPct =
    peakLtp > pos.buyPrice ? Number((((peakLtp - ltp) / peakLtp) * 100).toFixed(2)) : 0;
  // Dynamic Volatility-Adaptive Retracement Threshold (ATR-Normalized):
  // Highly volatile options get up to 3.2% breathing room to avoid false whipsaws; calm options get 1.8%
  const dynamicPeakPullbackPct = Math.max(
    1.8,
    Math.min(3.2, Number((((avgOptionAtr * 1.05) / Math.max(1, peakLtp)) * 100).toFixed(2))),
  );
  const netPeakPoints = Math.max(0, peakLtp - breakEvenWithBrokerage);
  const netCurrentPoints = ltp - breakEvenWithBrokerage;

  // Multi-Parameter Exhaustion / Peak Inflection Detection
  const indLive = latestUnderlyingSig?.indicators;
  const corpScoreNow =
    latestUnderlyingSig?.institutionalQuantAnalysis?.corporateHeavyweightScore ?? 0;
  const macroNow = latestUnderlyingSig?.institutionalQuantAnalysis?.globalMacroAlignment || 'MIXED';
  const isUnderlyingAtExtremeExhaustion = Boolean(
    indLive &&
    ((isCallOption && indLive.rsi?.value >= 78 && indLive.macd?.hist <= 0) ||
      (!isCallOption && indLive.rsi?.value <= 22 && indLive.macd?.hist >= 0)),
  );
  const isCorporateOrMacroTurningAgainst =
    (isCallOption && (corpScoreNow <= -30 || macroNow === 'BEARISH')) ||
    (!isCallOption && (corpScoreNow >= 30 || macroNow === 'BULLISH'));

  // Scale-Invariant Peak Inflection: Triggers when price achieved momentum (>= 5% peak gain)
  // AND underlying parameters actively turn against the position or hit extreme overbought/exhaustion.
  // Genuine Peak Inflection & Top Climax Alert:
  // ONLY triggers when trade has reached SUBSTANTIAL profit (>= 25%) AND encounters major institutional exhaustion or underlying reversal!
  // Strictly prevents premature exits on normal 1-minute consolidation pullbacks.
  const isPeakInflectionAlert =
    peakGainPct >= 25.0 &&
    netCurrentPoints > 0 &&
    ((isOptionClimaxReversal &&
      (isUnderlyingParametersReversing || isCorporateOrMacroTurningAgainst)) ||
      (ltp >= forecastedMaxPrice * 0.96 &&
        (isUnderlyingParametersReversing ||
          isUnderlyingAtExtremeExhaustion ||
          isCorporateOrMacroTurningAgainst)) ||
      (isUnderlyingParametersReversing && dropFromPeakPct >= 7.5));

  const candidateStopLoss = computeTrailingStopLadder({
    staticStopLossPrice,
    isMicroDeployedOpt,
    avgOptionAtr,
    ltp,
    buyPrice: pos.buyPrice,
    posNetPnL,
    peakGainPct,
    peakLtp,
    breakEvenWithBrokerage,
    minZeroLossPrice,
  });
  const previousLockedStop = Number(
    pos.lockedStopLossPrice || activeTracker?.lockedStopLossPrice || staticStopLossPrice,
  );
  const dynamicStopLossPrice = Number(Math.max(previousLockedStop, candidateStopLoss).toFixed(2));
  pos.lockedStopLossPrice = dynamicStopLossPrice;
  pos.stopLoss = dynamicStopLossPrice;
  pos.trailingStopLoss = dynamicStopLossPrice;
  if (activeTracker) {
    activeTracker.lockedStopLossPrice = dynamicStopLossPrice;
  }

  const hasReachedForecastTarget = ltp >= dynamicTargetPrice * 0.99;

  const tradeAgeSeconds = openedMs > 0 ? (Date.now() - openedMs) / 1000 : 999;
  const isInitialWiggleProtected =
    tradeAgeSeconds < 120 && !isUnderlyingParametersReversing && !isOption1mBreakingDown;

  // Multi-tick Stop-Loss Breach Confirmation (3.5s hold below SL) so 1-second flash wicks never shake out winners!
  const slStateKey = posTrackerKey || pos.instrumentKey || pos.id;
  const trackerObj =
    activeTracker || (slStateKey ? livePositionStateTracker[slStateKey] : undefined);
  const isStaticSlBreachedNow = ltp <= staticStopLossPrice;
  let isStaticSlConfirmed = false;
  if (isStaticSlBreachedNow) {
    const breachStart = Number(pos._slBreachAtMs || trackerObj?._slBreachAtMs || 0);
    if (breachStart <= 0) {
      pos._slBreachAtMs = Date.now();
      if (trackerObj) trackerObj._slBreachAtMs = pos._slBreachAtMs;
    } else if (
      Date.now() - breachStart >= 3500 ||
      isUnderlyingParametersReversing ||
      posPnL <= -maxAllowedRupeeLoss * 1.15
    ) {
      isStaticSlConfirmed = true;
    }
  } else {
    pos._slBreachAtMs = 0;
    if (trackerObj) trackerObj._slBreachAtMs = 0;
  }

  const exitRules = evaluateOptionExitRules({
    pos,
    ltp,
    qty,
    pnlPercent,
    peakLtp,
    peakGainPct,
    dropFromPeakPct,
    posPnL,
    posNetPnL,
    roundTripTax,
    staticStopLossPrice,
    dynamicStopLossPrice,
    minZeroLossPrice,
    maxAllowedRupeeLoss,
    forecastedMaxPrice,
    isStaticSlConfirmed,
    isStaticSlBreachedNow,
    isInitialWiggleProtected,
    tradeAgeSeconds,
    openedMs,
    isShortPosition,
    isMicroDeployedOpt,
    isSmallCapitalSafeZone,
    isOptionClimaxReversal,
    isOption1mBreakingDown,
    isUnderlyingParametersReversing,
    underlyingReversalDetails,
    isEodSquareOff,
  });
  // An end-of-day square-off always wins over the intraday rules.
  if (!shouldSell && exitRules.shouldSell) {
    shouldSell = true;
    sellReason = exitRules.sellReason;
  }

  const isFakePullbackHold =
    !shouldSell &&
    ltp > dynamicStopLossPrice &&
    !isUnderlyingParametersReversing &&
    !isOption1mBreakingDown &&
    ltp < (pos.highestLTP || ltp);

  const protectedNetFloorRupees =
    peakGainPct >= 4.5 && netPeakPoints > 0
      ? Math.max(0, Math.round((dynamicStopLossPrice - pos.buyPrice) * qty - roundTripTax))
      : -maxAllowedRupeeLoss;

  pos.liveTrajectoryRadar = buildLiveTrajectoryRadar({
    shouldSell,
    ltp,
    dynamicStopLossPrice,
    staticStopLossPrice,
    dynamicTargetPrice,
    protectedNetFloor: protectedNetFloorRupees,
    isUnderlyingParametersReversing,
    isOption1mTrendIntact,
    isPeakInflectionAlert,
    hasReachedForecastTarget,
    posPnL,
  });

  return { shouldSell, sellReason, dynamicStopLossPrice, qty, posProdCode, posTrackerKey };
}
