// Per-strike economics for option entry: premium target, brokerage drag, ROI and
// capital fit, collapsed into a scored candidate payload.
import { botConfig } from '../../../state';
import { calculateTradeCharges } from '../../../../src/utils/indicators';
import { scoreStrikeCandidate } from './strikeScoring';

export interface StrikeEconomicsParams {
  row: any;
  optObj: any;
  ltp: number;
  lotSz: number;
  optType: 'CE' | 'PE';
  isBullish: boolean;
  delta: number;
  gamma: number;
  theta: number;
  absDelta: number;
  iv: number;
  oi: number;
  oiChange: number;
  bidAskRatio: number;
  volume: number;
  bidAskSpreadPct: number;
  closePrice: number;
  liveLtp: number;
  effectiveCapital: number;
  tierCfg: any;
  isSmallCapitalAccount: boolean;
  signal: any;
  cheapestSkippedStrikeForCap: any;
}

export interface StrikeEconomicsResult {
  skip: boolean;
  cheapestSkippedStrikeForCap: any;
  candidate: any;
}

export function evaluateStrikeEconomics(params: StrikeEconomicsParams): StrikeEconomicsResult {
  const {
    row,
    optObj,
    ltp,
    lotSz,
    optType,
    isBullish,
    delta,
    gamma,
    theta,
    absDelta,
    iv,
    oi,
    oiChange,
    bidAskRatio,
    volume,
    bidAskSpreadPct,
    closePrice,
    liveLtp,
    effectiveCapital,
    tierCfg,
    isSmallCapitalAccount,
    signal,
  } = params;
  let cheapestSkippedStrikeForCap = params.cheapestSkippedStrikeForCap;

  const rowUnderlyingAtr = Number(signal?.institutionalQuantAnalysis?.atr14 || 18);
  const rowUnderlyingRes = Number(
    signal?.institutionalQuantAnalysis?.nearestResistance || liveLtp + rowUnderlyingAtr * 2.5,
  );
  const rowUnderlyingSup = Number(
    signal?.institutionalQuantAnalysis?.nearestSupport || liveLtp - rowUnderlyingAtr * 2.5,
  );
  const rowRunwayPts = isBullish
    ? Math.max(rowUnderlyingAtr * 1.8, rowUnderlyingRes - liveLtp)
    : Math.max(rowUnderlyingAtr * 1.8, liveLtp - rowUnderlyingSup);
  const rowGammaGainPts =
    0.5 * Math.abs(gamma) * Math.pow(Math.min(rowRunwayPts, rowUnderlyingAtr * 3), 2);
  const rowExpGainPts = Math.max(ltp * 0.25, rowRunwayPts * absDelta + rowGammaGainPts);
  const baseMult = ltp <= 14 ? 1.65 : ltp <= 65 ? 1.45 : ltp <= 120 ? 1.35 : 1.28;
  const targetMult = Math.max(baseMult, (ltp + rowExpGainPts) / (ltp || 1));
  const strikeCharges = calculateTradeCharges(ltp, lotSz, true, ltp * targetMult);
  const oneLotCost = strikeCharges.tradeValue;
  const estimatedBrokerage = strikeCharges.roundTripCharges;
  const strikeBrokerageDragPct = oneLotCost > 0 ? estimatedBrokerage / oneLotCost : 1;
  const totalRequiredWithBrokerage = strikeCharges.totalRequiredWithBrokerage;
  const expectedNetProfit = Number(
    (ltp * (targetMult - 1) * lotSz - estimatedBrokerage).toFixed(2),
  );

  const entryRequiredCashForStrike = Number((oneLotCost + strikeCharges.buyCharges + 3).toFixed(2));
  const fitsCapital =
    botConfig.mode === 'UPSTOX_LIVE'
      ? effectiveCapital > 0 && entryRequiredCashForStrike <= effectiveCapital
      : effectiveCapital <= 0 || totalRequiredWithBrokerage <= effectiveCapital;

  // Score strike on Capital Fit + High Risk-Reward Ratio + ROI % (കുറഞ്ഞ മുതൽമുടക്കിൽ പരമാവധി ലാഭം)
  // Sweet spot: Compact capital (₹2,500 - ₹8,500 per lot), High Delta (0.35 - 0.65), ROI >= 20%
  const roiPotentialPct =
    totalRequiredWithBrokerage > 0
      ? Number(((expectedNetProfit / totalRequiredWithBrokerage) * 100).toFixed(1))
      : 0;

  const scoring = scoreStrikeCandidate({
    mode: botConfig.mode,
    tierCfg,
    effectiveCapital,
    entryRequiredCashForStrike,
    totalRequiredWithBrokerage,
    fitsCapital,
    ltp,
    absDelta,
    strikeBrokerageDragPct,
    roiPotentialPct,
    estimatedBrokerage,
    expectedNetProfit,
    configuredMinProfit: botConfig.minOptionProfitAmount,
    bidAskSpreadPct,
    iv,
    volume,
    oi,
    closePrice,
    distRatio: Math.abs(Number(row.strike_price) - liveLtp) / (liveLtp || 1),
    isSmallCapitalAccount,
    strike: {
      strikePrice: Number(row.strike_price),
      optType,
      lotSize: lotSz,
      delta,
      gamma,
      theta,
      oneLotCost,
    },
    cheapestSkippedStrikeForCap,
  });
  cheapestSkippedStrikeForCap = scoring.cheapestSkippedStrikeForCap;
  if (scoring.skip) {
    return { skip: true, cheapestSkippedStrikeForCap, candidate: null };
  }
  const score = scoring.score;

  const candidate = {
    score,
    strikePrice: Number(row.strike_price),
    ltp,
    lotSize: lotSz,
    delta,
    gamma,
    theta,
    iv,
    oi,
    oiChange,
    bidAskRatio,
    volume,
    instrumentKey: optObj?.instrument_key,
    oneLotCost,
    estimatedBrokerage,
    totalRequiredWithBrokerage,
    expectedNetProfit,
    fitsCapital,
  };

  return { skip: false, cheapestSkippedStrikeForCap, candidate };
}
