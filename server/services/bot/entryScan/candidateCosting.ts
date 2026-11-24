// Cost, brokerage-drag and profitability gates for a single option candidate.
import { botConfig } from '../../../state';
import {
  calculateTradeCharges,
  calculateAffordableLotsWithBrokerage,
} from '../../../../src/utils/indicators';

export interface CandidateCostingParams {
  cand: any;
  signal: any;
  isBullish: boolean;
  liveLtp: number;
  liveOptLtp: number;
  lotSz: number;
  compactCapCeiling: number;
  effectiveCapital: number;
  tierCfg: any;
  calcEntryAffordableLots: (ltpVal: number, lotSzVal: number, cashCap: number) => number;
  momentumOk: boolean;
}

/** Mutates `cand` with fresh charges/targets and returns whether it passes all gates. */
export function evaluateCandidateCosting({
  cand,
  signal,
  isBullish,
  liveLtp,
  liveOptLtp,
  lotSz,
  compactCapCeiling,
  effectiveCapital,
  tierCfg,
  calcEntryAffordableLots,
  momentumOk,
}: CandidateCostingParams): boolean {
  let candMomentumOk = momentumOk;
  const candDeltaAbs = Math.abs(Number(cand.delta || 0.48));
  const candGammaAbs = Math.abs(Number(cand.gamma || 0.0001));
  const candUnderlyingAtr = Number(signal?.institutionalQuantAnalysis?.atr14 || 18);
  const candUnderlyingRes = Number(
    signal?.institutionalQuantAnalysis?.nearestResistance || liveLtp + candUnderlyingAtr * 2.5,
  );
  const candUnderlyingSup = Number(
    signal?.institutionalQuantAnalysis?.nearestSupport || liveLtp - candUnderlyingAtr * 2.5,
  );
  const candRunwayPoints = isBullish
    ? Math.max(candUnderlyingAtr * 1.8, candUnderlyingRes - liveLtp)
    : Math.max(candUnderlyingAtr * 1.8, liveLtp - candUnderlyingSup);
  const candGammaGainPts =
    0.5 * candGammaAbs * Math.pow(Math.min(candRunwayPoints, candUnderlyingAtr * 3), 2);
  const candExpGainPts = Math.max(
    liveOptLtp * 0.25,
    candRunwayPoints * candDeltaAbs + candGammaGainPts,
  );
  const freshBaseMult =
    liveOptLtp <= 14 ? 1.65 : liveOptLtp <= 65 ? 1.45 : liveOptLtp <= 120 ? 1.35 : 1.28;
  const freshTargetMult = Math.max(
    freshBaseMult,
    (liveOptLtp + candExpGainPts) / (liveOptLtp || 1),
  );
  const freshCharges = calculateTradeCharges(liveOptLtp, lotSz, true, liveOptLtp * freshTargetMult);
  cand.oneLotCost = freshCharges.tradeValue;
  cand.estimatedBrokerage = freshCharges.roundTripCharges;
  cand.buyCharges = freshCharges.buyCharges;
  cand.entryRequiredCash = Number(
    (freshCharges.tradeValue + freshCharges.buyCharges + 3).toFixed(2),
  );
  cand.totalRequiredWithBrokerage = freshCharges.totalRequiredWithBrokerage;

  // Compute net profit based on all affordable lots with the user's available margin
  const lotAfford = calculateAffordableLotsWithBrokerage(
    liveOptLtp,
    lotSz,
    compactCapCeiling,
    true,
    5,
  );
  const liveEntryPossibleLots =
    botConfig.mode === 'UPSTOX_LIVE'
      ? calcEntryAffordableLots(liveOptLtp, lotSz, compactCapCeiling)
      : 0;
  const possibleLots = Math.max(
    lotAfford.affordableLots,
    liveEntryPossibleLots,
    cand.entryRequiredCash <= compactCapCeiling ? 1 : 0,
  );
  cand.possibleLots = Math.max(1, Math.min(3, possibleLots));
  cand.expectedNetProfit = Number(
    (
      liveOptLtp * (freshTargetMult - 1) * lotSz * cand.possibleLots -
      freshCharges.roundTripCharges
    ).toFixed(2),
  );

  const minReqNetProfit = tierCfg.getMinReqNetProfit(
    cand.estimatedBrokerage,
    botConfig.minOptionProfitAmount,
  );
  const freshBrokerageDragPct =
    freshCharges.tradeValue > 0 ? freshCharges.roundTripCharges / freshCharges.tradeValue : 1;
  const entryCashCapCheck =
    botConfig.mode === 'UPSTOX_LIVE' ? cand.entryRequiredCash : cand.totalRequiredWithBrokerage;
  if (
    cand.expectedNetProfit < minReqNetProfit ||
    liveOptLtp < tierCfg.minLtp ||
    Math.abs(Number(cand.delta || 0)) < tierCfg.minDelta ||
    freshBrokerageDragPct > tierCfg.maxBrokerageDragPct ||
    possibleLots < 1 ||
    (effectiveCapital > 0 && entryCashCapCheck > compactCapCeiling)
  ) {
    candMomentumOk = false;
  }
  return candMomentumOk;
}
