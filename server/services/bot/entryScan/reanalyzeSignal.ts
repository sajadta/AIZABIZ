// Re-runs the full Layer-1 + Layer-2 analyzer against the verified live option
// premium, Greeks, OI walls and capital fit, and caches the resolved lot size.
import { botConfig } from '../../../state';
import {
  analyzeTradingSignals,
  calculateAffordableLotsWithBrokerage,
} from '../../../../src/utils/indicators';
import { lotSizeCache } from '../../../lib/instruments';

export interface ReanalyzeSignalParams {
  bestCandidate: any;
  idx: any;
  idxKey: string;
  enriched: any;
  liveLtp: number;
  expiryDate: string;
  optType: 'CE' | 'PE';
  lotSz: number;
  effectiveCapital: number;
  chainPcr: number;
  callWallStrike: number;
  putWallStrike: number;
  corporateHeavyweightScore: number;
  corporateHeavyweightSummary: any;
  globalMacroAlignment: any;
  fiveYearMetrics: any;
  liveIndiaVix: number;
}

export interface ReanalyzeSignalResult {
  signal: any;
  verifiedRealOptionStrike: boolean;
}

export function reanalyzeVerifiedSignal(params: ReanalyzeSignalParams): ReanalyzeSignalResult {
  const {
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
  } = params;

  let signal: any = null;
  let verifiedRealOptionStrike = false;
  const liveOptLtp = Number(bestCandidate.ltp || 0);
  const symUpper = idx.symbol.toUpperCase();
  let indexPrefix = symUpper;
  if (symUpper.includes('BANKEX')) indexPrefix = 'BANKEX';
  else if (symUpper.includes('SENSEX')) indexPrefix = 'SENSEX';
  else if (symUpper.includes('MID SELECT') || symUpper.includes('MIDCP'))
    indexPrefix = 'MIDCPNIFTY';
  else if (symUpper.includes('FIN')) indexPrefix = 'FINNIFTY';
  else if (symUpper.includes('BANK')) indexPrefix = 'BANKNIFTY';
  else if (symUpper.includes('NIFTY')) indexPrefix = 'NIFTY';

  const chosenOptSymbol = `${indexPrefix} ${bestCandidate.strikePrice} ${optType}`;

  const lotAffordability = calculateAffordableLotsWithBrokerage(
    liveOptLtp,
    lotSz,
    effectiveCapital,
    true,
    5,
  );
  const affordableLots = Math.max(lotAffordability.affordableLots, bestCandidate.possibleLots || 1);

  // Re-run Layer-1 + Layer-2 analyzer with real option price, Greeks, Corporate Heavyweights, OI Walls, and Capital + Brokerage fit
  signal = analyzeTradingSignals(
    idx.symbol,
    idx.symbol,
    idxKey,
    enriched,
    liveLtp,
    botConfig.selectedStrategy as any,
    liveOptLtp,
    {
      optionSymbol: chosenOptSymbol,
      strikePrice: bestCandidate.strikePrice,
      optionType: optType,
      ltp: liveOptLtp,
      expiry: expiryDate,
      lotSize: lotSz,
      delta: bestCandidate.delta,
      gamma: bestCandidate.gamma,
      theta: bestCandidate.theta,
      iv: bestCandidate.iv,
      oi: bestCandidate.oi,
      oiChange: bestCandidate.oiChange,
      bidAskRatio: bestCandidate.bidAskRatio,
      callWallStrike,
      putWallStrike,
      corporateHeavyweightScore,
      corporateHeavyweightSummary,
      globalMacroAlignment,
      fiveYearRegimeTrend: fiveYearMetrics?.fiveYearRegimeTrend,
      fiveYearRegimeSummary: fiveYearMetrics?.fiveYearRegimeSummary,
      fiveYearRegimeSummaryMl: fiveYearMetrics?.fiveYearRegimeSummaryMl,
      multiYearSupport: fiveYearMetrics?.multiYearSupport,
      multiYearResistance: fiveYearMetrics?.multiYearResistance,
      historicalPatternWinRate: fiveYearMetrics?.historicalPatternWinRate,
      ema200Daily: fiveYearMetrics?.ema200Daily,
      ema50Daily: fiveYearMetrics?.ema50Daily,
      indiaVix: liveIndiaVix,
      volume: bestCandidate.volume,
      pcr: chainPcr,
      instrumentKey: bestCandidate.instrumentKey,
      requiredCapital: bestCandidate.oneLotCost,
      estimatedBrokerage: bestCandidate.estimatedBrokerage,
      totalRequiredWithBrokerage: bestCandidate.totalRequiredWithBrokerage,
      expectedNetProfit: bestCandidate.expectedNetProfit,
      affordableLots,
      availableCapital: effectiveCapital,
    },
  );

  if (signal && bestCandidate?.instrumentKey) {
    signal.instrumentKey = bestCandidate.instrumentKey;
    verifiedRealOptionStrike = true;
    if (lotSz > 0) {
      lotSizeCache[bestCandidate.instrumentKey] = {
        lotSize: lotSz,
        timestamp: Date.now(),
        source: 'UPSTOX_LIVE',
        expiry: expiryDate,
      };
    }
  }

  return { signal, verifiedRealOptionStrike };
}
