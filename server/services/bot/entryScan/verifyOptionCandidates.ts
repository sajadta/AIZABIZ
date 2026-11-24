// Live verification of the top scored option candidates: real-time LTP, 1-minute
// candle momentum, anti-churn guards and the final signal re-analysis.
import { evaluateCandidateCosting } from './candidateCosting';
import { evaluateCandidateMomentum } from './candidateMomentum';
import { reanalyzeVerifiedSignal } from './reanalyzeSignal';

export interface VerifyCandidatesParams {
  token: string;
  idx: any;
  idxKey: string;
  enriched: any;
  liveLtp: number;
  topCandidates: any[];
  effectiveCapital: number;
  expiryDate: string;
  optType: 'CE' | 'PE';
  lotSz: number;
  tierCfg: any;
  isBullish: boolean;
  isOptionSellingMode: boolean;
  chainPcr: number;
  callWallStrike: number;
  putWallStrike: number;
  compactCapCeiling: number;
  calcEntryAffordableLots: (ltpVal: number, lotSzVal: number, cashCap: number) => number;
  corporateHeavyweightScore: number;
  corporateHeavyweightSummary: any;
  globalMacroAlignment: any;
  fiveYearMetrics: any;
  liveIndiaVix: number;
  bestCandidate: any;
  signal: any;
}

export interface VerifyCandidatesResult {
  bestCandidate: any;
  signal: any;
  verifiedRealOptionStrike: boolean;
}

export async function verifyOptionCandidates(
  params: VerifyCandidatesParams,
): Promise<VerifyCandidatesResult> {
  const {
    token,
    idx,
    idxKey,
    enriched,
    liveLtp,
    topCandidates,
    effectiveCapital,
    expiryDate,
    optType,
    lotSz,
    tierCfg,
    isBullish,
    isOptionSellingMode,
    chainPcr,
    callWallStrike,
    putWallStrike,
    compactCapCeiling,
    calcEntryAffordableLots,
    corporateHeavyweightScore,
    corporateHeavyweightSummary,
    globalMacroAlignment,
    fiveYearMetrics,
    liveIndiaVix,
  } = params;
  let bestCandidate = params.bestCandidate;
  let signal = params.signal;
  let verifiedRealOptionStrike = false;

  // Verify the top near-ATM strikes in order so a momentarily stale #1 quote
  // never blocks a valid #2 (ATM vs one-step ITM) confirmation.
  let optionMomentumConfirmed = false;

  for (const cand of topCandidates) {
    if (!cand?.instrumentKey) continue;

    const { liveOptLtp, momentumOk } = await evaluateCandidateMomentum({
      token,
      cand,
      enriched,
      liveLtp,
      isBullish,
      isOptionSellingMode,
    });

    const passedCosting = evaluateCandidateCosting({
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
    });

    if (passedCosting) {
      bestCandidate = cand;
      optionMomentumConfirmed = true;
      break;
    }
  }

  if (optionMomentumConfirmed && bestCandidate) {
    const reanalysis = reanalyzeVerifiedSignal({
      bestCandidate,
      idx,
      idxKey,
      enriched,
      liveLtp,
      expiryDate,
      optType,
      lotSz,
      effectiveCapital,
      chainPcr,
      callWallStrike,
      putWallStrike,
      corporateHeavyweightScore,
      corporateHeavyweightSummary,
      globalMacroAlignment,
      fiveYearMetrics,
      liveIndiaVix,
    });
    signal = reanalysis.signal ?? signal;
    verifiedRealOptionStrike = reanalysis.verifiedRealOptionStrike;
  }

  return { bestCandidate, signal, verifiedRealOptionStrike };
}
