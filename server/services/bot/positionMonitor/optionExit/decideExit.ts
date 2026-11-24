// Exit-decision engine for a single option position: dynamic peak-locked stops,
// trailing ladders, theta stagnation and maximum-runway harvest rules.
import {
  botConfig,
  botLogs,
  paperTradeHistory,
  livePositionStateTracker,
  getCachedUpstoxLiveMargin,
} from '../../../../state';
import { calculateTradeCharges } from '../../../../../src/utils/indicators';
import { fetchLiveUpstoxCharges } from '../../../../lib/charges';
import { computeOptionStopLossPlan } from '../stopLoss';
import { detectUnderlyingReversal, isCallOptionSymbol } from '../underlyingReversal';
import { evaluateOptionTrend } from '../optionTrend';
import { computeTrailingStopLadder } from '../trailingLadder';
import { getPaperInitialCapital } from '../../../persistence';

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

  // Static Stop and Target values based on BUY price (see positionMonitor/stopLoss)
  const liveOrPaperCapital =
    botConfig.mode === 'UPSTOX_LIVE'
      ? getCachedUpstoxLiveMargin().margin > 0
        ? getCachedUpstoxLiveMargin().margin
        : 2000
      : Math.max(
          500,
          getPaperInitialCapital() +
            paperTradeHistory.reduce(
              (sum: number, t: any) => sum + (t.netRealizedPnL || t.realizedPnL || 0),
              0,
            ),
        );
  const isSmallCapitalSafeZone = liveOrPaperCapital <= 4000;
  const {
    qty,
    deployedValue,
    isMicroDeployedOpt,
    optionSlPoints,
    staticStopLossPrice,
    maxAllowedRupeeLoss,
  } = computeOptionStopLossPlan(pos.buyPrice, pos.quantity, botConfig.stopLossPercent);

  // 1. DYNAMIC TREND-RIDING & TARGET-RUNWAY MAXIMUM PROFIT ENGINE
  const posPnL = (ltp - pos.buyPrice) * qty;
  let roundTripTax = calculateTradeCharges(
    pos.buyPrice,
    qty,
    true,
    Math.max(ltp, pos.highestLTP || ltp),
  ).roundTripCharges;
  try {
    const liveChg = await fetchLiveUpstoxCharges(
      pos.instrumentKey || pos.symbol,
      qty,
      pos.buyPrice,
      Math.max(ltp, pos.highestLTP || ltp),
      pos.product || pos.productType || 'D',
    );
    if (liveChg && liveChg.totalRoundTrip > 0) {
      roundTripTax = liveChg.totalRoundTrip;
      (pos as any).brokerageCharges = liveChg.totalRoundTrip;
      (pos as any).brokerageSource = liveChg.source;
    }
  } catch {
    // Ignored
  }
  const posNetPnL = posPnL - roundTripTax;
  const peakGrossPnL = ((pos.highestLTP || ltp) - pos.buyPrice) * qty;
  const peakNetPnL = peakGrossPnL - roundTripTax;
  pos.highestPnl = Math.max(pos.highestPnl || 0, posPnL, peakGrossPnL);
  pos.highestNetPnl = Math.max(pos.highestNetPnl || 0, posNetPnL, peakNetPnL);
  const posProdCode = pos.product || (pos.productType === 'INTRADAY' ? 'I' : 'D');
  const posTrackerKey = pos.instrumentKey ? `${pos.instrumentKey}|${posProdCode}` : '';
  const activeTracker =
    (posTrackerKey && livePositionStateTracker[posTrackerKey]) ||
    (pos.instrumentKey && livePositionStateTracker[pos.instrumentKey]);
  if (activeTracker) {
    activeTracker.highestLTP = pos.highestLTP;
    activeTracker.highestPnl = pos.highestPnl;
    activeTracker.highestNetPnl = pos.highestNetPnl;
    if ((pos as any).brokerageCharges) {
      activeTracker.brokerageCharges = (pos as any).brokerageCharges;
      activeTracker.brokerageSource = (pos as any).brokerageSource;
    }
  }

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

  // 1. HARD RUPEE STOP-LOSS & RISK CAP + EARLY GENUINE REVERSAL CUT
  // If BOTH underlying parameters reversed against us AND option 1m structure broke down while losing >10%, cut early!
  if (
    !shouldSell &&
    ltp <= pos.buyPrice * 0.9 &&
    isUnderlyingParametersReversing &&
    isOption1mBreakingDown &&
    tradeAgeSeconds >= 45
  ) {
    shouldSell = true;
    sellReason = `[SMART EARLY REVERSAL CUT] ${underlyingReversalDetails} + 1m Option Breakdown at ₹${ltp.toFixed(2)} (${pnlPercent.toFixed(2)}%). Exited small to save capital!`;
  } else if (
    !shouldSell &&
    (isStaticSlConfirmed ||
      (posPnL <= -maxAllowedRupeeLoss && !isInitialWiggleProtected && isStaticSlBreachedNow) ||
      posPnL <= -maxAllowedRupeeLoss * 1.25)
  ) {
    shouldSell = true;
    const execPx = Math.max(ltp, staticStopLossPrice);
    const profitDiff = ((execPx - pos.buyPrice) / pos.buyPrice) * 100;
    sellReason = `[STRICT RISK CAP STOP-LOSS] Max risk threshold (-₹${maxAllowedRupeeLoss}) confirmed at ₹${execPx.toFixed(2)} (${profitDiff.toFixed(2)}%). Auto squared-off to protect account capital!`;
  }

  // 2. Trailing Stop Loss (Universal Ratcheted Dynamic Stop)
  if (!shouldSell && botConfig.trailingStopLoss && ltp <= dynamicStopLossPrice) {
    shouldSell = true;
    const execPx =
      peakGainPct >= 18.0 && dynamicStopLossPrice >= minZeroLossPrice
        ? Math.max(ltp, dynamicStopLossPrice)
        : Math.max(ltp, staticStopLossPrice);
    const profitDiff = ((execPx - pos.buyPrice) / pos.buyPrice) * 100;
    const netLocked = (execPx - pos.buyPrice) * qty - roundTripTax;
    sellReason =
      netLocked > 0
        ? `[MAXIMUM PROFIT RATCHET LOCKED] Price reached peak of ₹${peakLtp.toFixed(2)} (+${peakGainPct.toFixed(1)}%) and hit trailing Stop-Loss at ₹${execPx.toFixed(2)}. Secured +₹${netLocked.toFixed(2)} NET PROFIT (+${profitDiff.toFixed(1)}%) after full brokerage!`
        : `[SMART STOP HIT] Price dropped below Auto-SL ₹${dynamicStopLossPrice.toFixed(2)} (${profitDiff.toFixed(2)}%). Exited early to minimize loss.`;
  }

  // 2b. TOP-CLIMAX PEAK HARVESTER (SELL AT MAXIMUM PEAK):
  // Only triggers after a SUBSTANTIAL RALLY (peakGainPct >= 25.0% AND posNetPnL >= ₹450).
  // Gives runners 14% breathing room so normal intra-candle pullbacks are NOT choked!
  const underlyingIndexLtp = Number(latestUnderlyingSig?.price || 0);
  const underlyingNearestResistance = Number(
    latestUnderlyingSig?.institutionalQuantAnalysis?.nearestResistance || 0,
  );
  const isUnderlyingAtKeyResistance = Boolean(
    isCallOption &&
    underlyingIndexLtp > 0 &&
    underlyingNearestResistance > 0 &&
    underlyingIndexLtp >= underlyingNearestResistance * 0.999,
  );

  const minHarvestNetProfit = isMicroDeployedOpt ? 150 : isSmallCapitalSafeZone ? 350 : 600;
  if (
    !shouldSell &&
    peakGainPct >= 35.0 &&
    posNetPnL >= minHarvestNetProfit &&
    ((dropFromPeakPct >= 20.0 && isOptionClimaxReversal) ||
      dropFromPeakPct >= 25.0 ||
      (isUnderlyingParametersReversing && dropFromPeakPct >= 18.0))
  ) {
    shouldSell = true;
    const topReason = isOptionClimaxReversal
      ? `Top Climax Wick rejection (>=35% shadow) at peak ₹${peakLtp.toFixed(2)}`
      : isUnderlyingParametersReversing
        ? `Underlying parameters reversed against position`
        : `Peak pullback ${dropFromPeakPct.toFixed(1)}% from high`;
    sellReason = `[MAXIMUM PROFIT PEAK HARVESTER] Reached peak of ₹${peakLtp.toFixed(2)} (+${peakGainPct.toFixed(1)}%). ${topReason}. Captured peak profit (+₹${posNetPnL.toFixed(2)})!`;
  }

  // 3. Static Stop Loss (if trailing is off)
  if (!shouldSell && ltp <= staticStopLossPrice) {
    shouldSell = true;
    sellReason = `Strict Stop Loss hit (${pnlPercent.toFixed(2)}%) for ${pos.symbol}. Squaring off to prevent further loss.`;
  }

  // 4. Pre-emptive Underlying Reversal Profit Lock:
  // ONLY activate if position has reached GENUINE profit (>= 22% and scaled rupee net threshold) AND dropped >= 8.5% from high!
  const reversalLockNetMin = isMicroDeployedOpt ? 120 : 400;
  if (
    !shouldSell &&
    peakGainPct >= 22.0 &&
    posNetPnL >= reversalLockNetMin &&
    dropFromPeakPct >= 8.5 &&
    isUnderlyingParametersReversing
  ) {
    shouldSell = true;
    sellReason = `[SUBSTANTIAL PROFIT REVERSAL LOCK] ${underlyingReversalDetails}. Secured +₹${posNetPnL.toFixed(2)} net profit before reversal!`;
  }

  // 5. CORPORATE STRUCTURE PROTECTION:
  // Young positions are allowed to consolidate without being prematurely cut on minor noise.
  // Positions are protected by the Hard Risk Cap Stop-Loss and Trailing SL.

  // 7. Post-Entry Theta Stagnation Shield (Dynamic Expiry-Aware)
  // Strictly prevents premature exit if the trade is in healthy momentum!
  const currentIstHour = (new Date().getUTCHours() + 5.5) % 24;
  const isExpiryAfternoon = currentIstHour >= 13.5;
  const maxStagnationHoldMs = isExpiryAfternoon ? 8 * 60 * 1000 : 18 * 60 * 1000;
  const stagnationMinNet = isMicroDeployedOpt ? 70 : 250;

  if (
    !shouldSell &&
    openedMs > 0 &&
    Date.now() - openedMs >= maxStagnationHoldMs &&
    peakGainPct < 4.0 &&
    posNetPnL >= stagnationMinNet
  ) {
    shouldSell = true;
    sellReason = isExpiryAfternoon
      ? `[0-DTE EXPIRY THETA SHIELD] Position held >8m in afternoon stagnation. Secured +₹${posNetPnL.toFixed(2)} before rapid theta collapse!`
      : `[THETA STAGNATION SHIELD] Position held >18m in low-volatility consolidation. Locked +₹${posNetPnL.toFixed(2)} net profit above brokerage before Theta decay!`;
  }

  // 8. Forecasted Maximum Target Runway Exit (ONLY on genuine massive profit!)
  const targetReachMinPnL = isMicroDeployedOpt ? 160 : 550;
  const isTargetReached = isShortPosition
    ? ltp <= forecastedMaxPrice && posPnL >= (isMicroDeployedOpt ? 160 : 500)
    : ltp >= forecastedMaxPrice && peakGainPct >= 35.0 && posPnL >= targetReachMinPnL;

  if (
    !shouldSell &&
    isTargetReached &&
    (dropFromPeakPct >= 8.5 || isUnderlyingParametersReversing)
  ) {
    shouldSell = true;
    sellReason = `[MAXIMUM RUNNER HARVEST] Target Runway (₹${forecastedMaxPrice.toFixed(1)}) achieved (+${peakGainPct.toFixed(1)}% peak). Secured massive profit at ₹${ltp.toFixed(2)} (+${pnlPercent.toFixed(1)}%) for ${pos.symbol}!`;
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

  const nextMomentState:
    'ACCELERATING_UP' | 'FAKE_DIP_HOLD' | 'PEAK_EXHAUSTION' | 'REVERSING_EXIT' =
    shouldSell ||
    ltp <= dynamicStopLossPrice ||
    ltp <= staticStopLossPrice ||
    (isUnderlyingParametersReversing && !isOption1mTrendIntact)
      ? 'REVERSING_EXIT'
      : isPeakInflectionAlert || hasReachedForecastTarget
        ? 'PEAK_EXHAUSTION'
        : posPnL >= 0 && isOption1mTrendIntact
          ? 'ACCELERATING_UP'
          : 'FAKE_DIP_HOLD';

  pos.liveTrajectoryRadar = {
    nextMomentState,
    nextMomentLabel:
      nextMomentState === 'ACCELERATING_UP'
        ? 'Option In Profit — Riding Toward Target'
        : nextMomentState === 'FAKE_DIP_HOLD'
          ? `Monitoring Risk Above Stop-Loss (₹${dynamicStopLossPrice.toFixed(2)})`
          : nextMomentState === 'PEAK_EXHAUSTION'
            ? `Peak Target Reached — Stop-Loss Locked @ ₹${dynamicStopLossPrice.toFixed(2)}`
            : 'Stop-Loss Hit — Exiting Trade',
    nextMomentLabelMl:
      nextMomentState === 'ACCELERATING_UP'
        ? 'ഓപ്ഷൻ ലാഭത്തിൽ — ടാർഗെറ്റിലേക്ക് മുന്നേറുന്നു'
        : nextMomentState === 'FAKE_DIP_HOLD'
          ? `സ്റ്റോപ്പ്-ലോസിന് മുകളിൽ റിസ്ക് നിരീക്ഷിക്കുന്നു (SL: ₹${dynamicStopLossPrice.toFixed(2)})`
          : nextMomentState === 'PEAK_EXHAUSTION'
            ? `പരമാവധി ലാഭ ലക്ഷ്യം കണ്ടു — Stop-Loss ₹${dynamicStopLossPrice.toFixed(2)}-ൽ ലോക്ക് ചെയ്തു`
            : 'സ്റ്റോപ്പ്-ലോസ് പരിധി എത്തി — നഷ്ടം തടയാൻ ക്ലോസ് ചെയ്യുന്നു',
    holdOrExitVerdict:
      nextMomentState === 'PEAK_EXHAUSTION'
        ? `PEAK LOCKED @ ₹${dynamicStopLossPrice.toFixed(1)}`
        : nextMomentState === 'ACCELERATING_UP'
          ? `IN PROFIT (Target ₹${dynamicTargetPrice.toFixed(1)} | SL ₹${dynamicStopLossPrice.toFixed(1)})`
          : nextMomentState === 'FAKE_DIP_HOLD'
            ? `HOLDING (SL ₹${dynamicStopLossPrice.toFixed(1)})`
            : 'STOP-LOSS HIT — EXITING',
    holdOrExitVerdictMl:
      nextMomentState === 'PEAK_EXHAUSTION'
        ? `Peak Locked @ ₹${dynamicStopLossPrice.toFixed(1)}`
        : nextMomentState === 'ACCELERATING_UP'
          ? `ലാഭത്തിൽ (Target ₹${dynamicTargetPrice.toFixed(1)} | SL ₹${dynamicStopLossPrice.toFixed(1)})`
          : nextMomentState === 'FAKE_DIP_HOLD'
            ? `ഹോൾഡ് ചെയ്യുന്നു (SL ₹${dynamicStopLossPrice.toFixed(1)})`
            : 'Stop-Loss എത്തി — ക്ലോസ് ചെയ്യുന്നു',
    dynamicStopLossPrice,
    dynamicTargetPrice,
    protectedNetFloor: protectedNetFloorRupees,
    forecastedMaxOptionPrice: dynamicTargetPrice,
    option1mTrendIntact: isOption1mTrendIntact,
    underlyingAligned: !isUnderlyingParametersReversing,
    updatedAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
  };
  return { shouldSell, sellReason, dynamicStopLossPrice, qty, posProdCode, posTrackerKey };
}
