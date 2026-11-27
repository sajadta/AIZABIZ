// Bottom-dip, base-reversal, clean-breakout and opening-impulse entry patterns.
// Tolerances scale smoothly across micro (<₹15), compact (<₹85) and normal premiums.

export interface OptionEntrySetupParams {
  liveOptLtp: number;
  optLow0: number;
  optLow1: number;
  optLow2: number;
  optOpen0: number;
  optClose1: number;
  optClose2: number;
  optShortVwap: number;
  optClosePos: number;
  optUpperWickRatio: number;
  singleMinuteSpikePct: number;
  isFlatRangeBar: boolean;
  isOptionRisingNow: boolean;
  isUnderlyingConfirming: boolean;
}

export interface OptionEntrySetupResult {
  isLowPremOpt: boolean;
  isCompactPremOpt: boolean;
  dynMaxSpikePct: number;
  dynMaxVwapMult: number;
  optLowestBase: number;
  isBottomDipBounce: boolean;
  isEarlyReversalTurn: boolean;
  isLowPriceDipEntry: boolean;
  isCleanBreakoutEntry: boolean;
  isMorningOpenImpulse: boolean;
  /** Any of the five patterns qualifies the candidate for the dip-momentum check. */
  baseOk: boolean;
}

export function evaluateOptionEntrySetup(p: OptionEntrySetupParams): OptionEntrySetupResult {
  const {
    liveOptLtp,
    optLow0,
    optLow1,
    optLow2,
    optOpen0,
    optClose1,
    optClose2,
    optShortVwap,
    optClosePos,
    optUpperWickRatio,
    singleMinuteSpikePct,
    isFlatRangeBar,
    isOptionRisingNow,
    isUnderlyingConfirming,
  } = p;

  const isLowPremOpt = liveOptLtp > 0 && liveOptLtp < 15;
  const isCompactPremOpt = liveOptLtp >= 15 && liveOptLtp < 85;
  const dynMaxSpikePct = isLowPremOpt ? 14.0 : isCompactPremOpt ? 7.0 : 4.0;
  const dynMaxWick = isLowPremOpt ? 0.45 : isCompactPremOpt ? 0.42 : 0.28;
  const dynMaxTurnWick = isLowPremOpt ? 0.45 : isCompactPremOpt ? 0.42 : 0.3;
  const dynMaxCleanWick = isLowPremOpt ? 0.45 : isCompactPremOpt ? 0.38 : 0.25;
  const dynMaxVwapMult = isLowPremOpt ? 1.1 : isCompactPremOpt ? 1.07 : 1.035;
  const dynMaxBaseMult = isLowPremOpt ? 1.15 : isCompactPremOpt ? 1.12 : 1.045;
  const dynMaxClosePos = isLowPremOpt ? 0.88 : isCompactPremOpt ? 0.86 : 0.82;

  const optLowestBase = Math.min(optLow0, optLow1, optLow2);
  const isBottomDipBounce =
    isUnderlyingConfirming &&
    liveOptLtp >= optLowestBase &&
    liveOptLtp <= optLowestBase * dynMaxBaseMult &&
    liveOptLtp >= optOpen0 * 0.992 &&
    optUpperWickRatio <= dynMaxWick;

  const isEarlyReversalTurn =
    isUnderlyingConfirming &&
    liveOptLtp >= optOpen0 * (isFlatRangeBar ? 1.0 : 1.001) &&
    liveOptLtp <= optOpen0 * (isLowPremOpt ? 1.12 : isCompactPremOpt ? 1.07 : 1.035) &&
    liveOptLtp >= optShortVwap * 0.975 &&
    liveOptLtp <= optShortVwap * dynMaxVwapMult &&
    optUpperWickRatio <= dynMaxTurnWick;

  const isLowPriceDipEntry =
    isUnderlyingConfirming &&
    liveOptLtp >= optShortVwap * 0.975 &&
    liveOptLtp <= optShortVwap * dynMaxVwapMult &&
    optClosePos >= 0.2 &&
    optClosePos <= dynMaxClosePos &&
    optUpperWickRatio <= dynMaxWick &&
    singleMinuteSpikePct <= dynMaxSpikePct &&
    singleMinuteSpikePct >= -2.5;

  const isCleanBreakoutEntry =
    isUnderlyingConfirming &&
    isOptionRisingNow &&
    (liveOptLtp >= optClose2 * 0.985 || liveOptLtp >= optClose1 * 0.99) &&
    liveOptLtp >= optShortVwap * 0.99 &&
    liveOptLtp <= optShortVwap * dynMaxVwapMult &&
    optClosePos >= 0.35 &&
    optClosePos <= dynMaxClosePos &&
    optUpperWickRatio <= dynMaxCleanWick &&
    singleMinuteSpikePct <= dynMaxSpikePct &&
    singleMinuteSpikePct >= -1.5;

  const currentIstMinutesTotal =
    ((new Date().getUTCHours() + 5.5) % 24) * 60 + new Date().getUTCMinutes();
  const isMorningOpeningWindow =
    currentIstMinutesTotal >= 9 * 60 + 15 && currentIstMinutesTotal <= 10 * 60 + 45;

  const isMorningOpenImpulse =
    isMorningOpeningWindow &&
    isUnderlyingConfirming &&
    liveOptLtp >= optLowestBase &&
    liveOptLtp <= optLowestBase * (isLowPremOpt ? 1.15 : isCompactPremOpt ? 1.12 : 1.055) &&
    optUpperWickRatio <= (isLowPremOpt ? 0.45 : isCompactPremOpt ? 0.42 : 0.32);

  return {
    isLowPremOpt,
    isCompactPremOpt,
    dynMaxSpikePct,
    dynMaxVwapMult,
    optLowestBase,
    isBottomDipBounce,
    isEarlyReversalTurn,
    isLowPriceDipEntry,
    isCleanBreakoutEntry,
    isMorningOpenImpulse,
    baseOk:
      isMorningOpenImpulse ||
      isBottomDipBounce ||
      isEarlyReversalTurn ||
      isLowPriceDipEntry ||
      isCleanBreakoutEntry,
  };
}
