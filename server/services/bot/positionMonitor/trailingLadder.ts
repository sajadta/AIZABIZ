// Trailing stop ladder: locks breakeven after a small gain, then ratchets the stop
// upward through profit tiers so net gains are never handed back.

export interface TrailingLadderInput {
  staticStopLossPrice: number;
  isMicroDeployedOpt: boolean;
  avgOptionAtr: number;
  ltp: number;
  buyPrice: number;
  posNetPnL: number;
  peakGainPct: number;
  peakLtp: number;
  breakEvenWithBrokerage: number;
  minZeroLossPrice: number;
}

export const computeTrailingStopLadder = ({
  staticStopLossPrice,
  isMicroDeployedOpt,
  avgOptionAtr,
  ltp,
  buyPrice,
  posNetPnL,
  peakGainPct,
  peakLtp,
  breakEvenWithBrokerage,
  minZeroLossPrice,
}: TrailingLadderInput): number => {
  let candidateStopLoss = staticStopLossPrice;

  const tier0NetTrigger = isMicroDeployedOpt ? 45 : 75;
  const tier1NetTrigger = isMicroDeployedOpt ? 85 : 150;
  const slCushion = Math.max(0.25, Number((avgOptionAtr * 0.2).toFixed(2)));
  const maxNonTriggerSlCap = Number(Math.max(staticStopLossPrice, ltp - 0.15).toFixed(2));

  const netPeakPoints = Math.max(0, peakLtp - breakEvenWithBrokerage);

  // Tier 0: breakeven (including brokerage) only once LTP clears it by a cushion, so
  // cheap options never get a stop at or above the live price.
  if (
    (peakGainPct >= 8.0 || posNetPnL >= tier0NetTrigger) &&
    ltp >= breakEvenWithBrokerage + slCushion
  ) {
    candidateStopLoss = Math.max(
      candidateStopLoss,
      Math.min(breakEvenWithBrokerage, maxNonTriggerSlCap),
    );
  }

  if (
    (peakGainPct >= 15.0 || posNetPnL >= tier1NetTrigger) &&
    ltp >= minZeroLossPrice + slCushion
  ) {
    candidateStopLoss = Math.max(candidateStopLoss, Math.min(minZeroLossPrice, maxNonTriggerSlCap));
  }

  const ratchet = (keepFraction: number, breathingRoom: number) => {
    const dynamicPeakGainLock = Number((buyPrice + netPeakPoints * keepFraction).toFixed(2));
    const breathingRoomPrice = Number((peakLtp * breathingRoom).toFixed(2));
    candidateStopLoss = Math.max(
      candidateStopLoss,
      minZeroLossPrice,
      Math.max(dynamicPeakGainLock, breathingRoomPrice),
    );
  };

  if (peakGainPct >= 25.0 && peakGainPct < 35.0 && netPeakPoints > 0 && ltp >= minZeroLossPrice) {
    ratchet(0.65, 0.9);
  } else if (
    peakGainPct >= 35.0 &&
    peakGainPct < 55.0 &&
    netPeakPoints > 0 &&
    ltp >= minZeroLossPrice
  ) {
    ratchet(0.8, 0.92);
  } else if (peakGainPct >= 55.0 && netPeakPoints > 0 && ltp >= minZeroLossPrice) {
    ratchet(0.88, 0.94);
  }

  return candidateStopLoss;
};
