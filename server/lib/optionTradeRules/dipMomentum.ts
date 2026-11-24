// Dip-buy vs breakdown discrimination for option entries.
export interface DipMomentumInput {
  liveOptLtp: number;
  chainSnapshotLtp: number;
  optLowestBase: number;
  optOpen0: number;
  optShortVwap: number;
  optUpperWickRatio: number;
  singleMinuteSpikePct: number;
  isUnderlyingConfirming: boolean;
  isBaseMomentumOk: boolean;
}

/**
 * Evaluates whether a minor dip below the option-chain snapshot price is a valid
 * value dip-buy vs a sudden breakdown/crash. Replaces strict micro-tick rejection
 * (`liveOptLtp < chainSnapshotLtp`) which previously killed all pullback dip entries.
 */
export function evaluateOptionDipMomentum(input: DipMomentumInput): boolean {
  const {
    liveOptLtp,
    chainSnapshotLtp,
    optLowestBase,
    optOpen0,
    optShortVwap,
    optUpperWickRatio,
    singleMinuteSpikePct,
    isUnderlyingConfirming,
    isBaseMomentumOk,
  } = input;

  if (liveOptLtp <= 0) return false;
  // Block sharp >12% flash drops relative to chain snapshot
  if (chainSnapshotLtp > 0 && liveOptLtp < chainSnapshotLtp * 0.88) {
    return false;
  }
  if (isBaseMomentumOk) return true;

  // Scale tolerance smoothly for nano (<₹6), micro (<₹15), and compact (<₹85) contracts
  const isNanoPrem = liveOptLtp < 6;
  const isLowPrem = liveOptLtp < 15;
  const isCompactPrem = liveOptLtp < 85;
  const maxBaseMult = isNanoPrem ? 1.25 : isLowPrem ? 1.16 : isCompactPrem ? 1.12 : 1.06;
  const maxUpperWick = isLowPrem ? 0.48 : isCompactPrem ? 0.42 : 0.35;
  const maxSpikePct = isNanoPrem ? 20.0 : isLowPrem ? 14.0 : isCompactPrem ? 7.0 : 4.0;

  // Value dip-buy bounce near 3m low or short VWAP when underlying index trend confirms
  const isHealthyPullbackZone =
    isUnderlyingConfirming &&
    chainSnapshotLtp > 0 &&
    liveOptLtp >= chainSnapshotLtp * 0.9 &&
    liveOptLtp >= optLowestBase &&
    liveOptLtp <= optLowestBase * maxBaseMult &&
    liveOptLtp >= optShortVwap * 0.96 &&
    liveOptLtp >= optOpen0 * 0.985 &&
    optUpperWickRatio <= maxUpperWick &&
    singleMinuteSpikePct >= -4.5 &&
    singleMinuteSpikePct <= maxSpikePct;

  return isHealthyPullbackZone;
}
