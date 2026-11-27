// Ordered exit rules for a live option position: hard risk cap, trailing ladder,
// peak harvester, static stop, reversal lock, theta stagnation and runway harvest.
import { botConfig } from '../../../../state';

export interface OptionExitRulesParams {
  pos: any;
  ltp: number;
  qty: number;
  pnlPercent: number;
  peakLtp: number;
  peakGainPct: number;
  dropFromPeakPct: number;
  posPnL: number;
  posNetPnL: number;
  roundTripTax: number;
  staticStopLossPrice: number;
  dynamicStopLossPrice: number;
  minZeroLossPrice: number;
  maxAllowedRupeeLoss: number;
  forecastedMaxPrice: number;
  isStaticSlConfirmed: boolean;
  isStaticSlBreachedNow: boolean;
  isInitialWiggleProtected: boolean;
  tradeAgeSeconds: number;
  openedMs: number;
  isShortPosition: boolean;
  isMicroDeployedOpt: boolean;
  isSmallCapitalSafeZone: boolean;
  isOptionClimaxReversal: boolean;
  isOption1mBreakingDown: boolean;
  isUnderlyingParametersReversing: boolean;
  underlyingReversalDetails: string;
  isEodSquareOff: boolean;
}

export interface OptionExitRulesResult {
  shouldSell: boolean;
  sellReason: string;
}

export function evaluateOptionExitRules(p: OptionExitRulesParams): OptionExitRulesResult {
  const {
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
  } = p;

  let shouldSell = false;
  let sellReason = '';

  // 1. Hard rupee risk cap plus early genuine reversal cut
  if (
    ltp <= pos.buyPrice * 0.9 &&
    isUnderlyingParametersReversing &&
    isOption1mBreakingDown &&
    tradeAgeSeconds >= 45
  ) {
    shouldSell = true;
    sellReason = `[SMART EARLY REVERSAL CUT] ${underlyingReversalDetails} + 1m Option Breakdown at ₹${ltp.toFixed(2)} (${pnlPercent.toFixed(2)}%). Exited small to save capital!`;
  } else if (
    isStaticSlConfirmed ||
    (posPnL <= -maxAllowedRupeeLoss && !isInitialWiggleProtected && isStaticSlBreachedNow) ||
    posPnL <= -maxAllowedRupeeLoss * 1.25
  ) {
    shouldSell = true;
    const execPx = Math.max(ltp, staticStopLossPrice);
    const profitDiff = ((execPx - pos.buyPrice) / pos.buyPrice) * 100;
    sellReason = `[STRICT RISK CAP STOP-LOSS] Max risk threshold (-₹${maxAllowedRupeeLoss}) confirmed at ₹${execPx.toFixed(2)} (${profitDiff.toFixed(2)}%). Auto squared-off to protect account capital!`;
  }

  // 2. Ratcheted trailing stop
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

  // 3. Top-climax peak harvester (only after a substantial rally)
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

  // 4. Static stop when trailing is disabled
  if (!shouldSell && ltp <= staticStopLossPrice) {
    shouldSell = true;
    sellReason = `Strict Stop Loss hit (${pnlPercent.toFixed(2)}%) for ${pos.symbol}. Squaring off to prevent further loss.`;
  }

  // 5. Pre-emptive profit lock on underlying reversal
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

  // 6. Post-entry theta stagnation shield (expiry-aware)
  const isExpiryAfternoon = (new Date().getUTCHours() + 5.5) % 24 >= 13.5;
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

  // 7. Forecasted maximum runway harvest
  const targetReachMinPnL = isMicroDeployedOpt ? 160 : 550;
  const isTargetReached = isShortPosition
    ? ltp <= forecastedMaxPrice && posPnL >= (isMicroDeployedOpt ? 160 : 500)
    : ltp >= forecastedMaxPrice && peakGainPct >= 35.0 && posPnL >= targetReachMinPnL;
  if (isTargetReached && (dropFromPeakPct >= 8.5 || isUnderlyingParametersReversing)) {
    shouldSell = true;
    sellReason = `[MAXIMUM RUNNER HARVEST] Target Runway (₹${forecastedMaxPrice.toFixed(1)}) achieved (+${peakGainPct.toFixed(1)}% peak). Secured massive profit at ₹${ltp.toFixed(2)} (+${pnlPercent.toFixed(1)}%) for ${pos.symbol}!`;
  }

  return { shouldSell, sellReason };
}
