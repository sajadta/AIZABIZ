// Option-chain candidate evaluation: capital-tier filtering, strike scoring and
// live 1-minute momentum verification for a single underlying index.
import { botConfig } from '../../../state';
import { calculateTradeCharges } from '../../../../src/utils/indicators';
import { lotSizeCache } from '../../../lib/instruments';
import { getCapitalTierOptionConstraints } from '../../../lib/optionTradeRules';
import { isChainStrikeCoolingDown } from './chainStrikeGuard';
import { computeChainOiMetrics } from './chainMetrics';
import { evaluateStrikeEconomics } from './strikeEconomics';
import { verifyOptionCandidates } from './verifyOptionCandidates';
import { selectAffordableRows } from './affordableRows';

export interface ChainCandidatesParams {
  token: string;
  idx: any;
  idxKey: string;
  chainData: any;
  expiryDate: string;
  liveIdxLotSize: number;
  liveLtp: number;
  effectiveCapital: number;
  enriched: any;
  fiveYearMetrics: any;
  corporateHeavyweightScore: number;
  corporateHeavyweightSummary: any;
  globalMacroAlignment: any;
  liveIndiaVix: number;
  activeSessionTrades: any[];
  signal: any;
  bestCandidate: any;
  topOptionCandidateForIndex: any;
  cheapestSkippedStrikeForCap: any;
  verifiedRealOptionStrike: boolean;
}

export interface ChainCandidatesResult {
  signal: any;
  bestCandidate: any;
  topOptionCandidateForIndex: any;
  cheapestSkippedStrikeForCap: any;
  verifiedRealOptionStrike: boolean;
}

export async function evaluateChainCandidates(
  params: ChainCandidatesParams,
): Promise<ChainCandidatesResult> {
  const {
    token,
    idx,
    idxKey,
    chainData,
    expiryDate,
    liveIdxLotSize,
    liveLtp,
    effectiveCapital,
    enriched,
    fiveYearMetrics,
    corporateHeavyweightScore,
    corporateHeavyweightSummary,
    globalMacroAlignment,
    liveIndiaVix,
    activeSessionTrades,
  } = params;
  let signal = params.signal;
  let bestCandidate = params.bestCandidate;
  let topOptionCandidateForIndex = params.topOptionCandidateForIndex;
  let cheapestSkippedStrikeForCap = params.cheapestSkippedStrikeForCap;
  let verifiedRealOptionStrike = params.verifiedRealOptionStrike;

  const rawSigType = signal?.signalType || 'HOLD';
  const isBullish =
    rawSigType === 'BUY' ||
    (String(rawSigType) === 'HOLD' &&
      (signal?.recommendedOptionStrike?.optionType === 'CE' ||
        (!signal?.rationale?.includes('Bearish') &&
          (signal?.rationale?.includes('Bullish') || (signal?.confidenceScore || 50) >= 50))));
  const isOptionSellingMode = botConfig.optionStrategyMode === 'OPTION_SELLING';
  // For Option Buying: Bullish -> Buy CE, Bearish -> Buy PE.
  // For Option Selling (Credit): Bullish -> Short PE (collect decaying Put premium), Bearish -> Short CE (collect decaying Call premium).
  const optType: 'CE' | 'PE' = isOptionSellingMode
    ? isBullish
      ? 'PE'
      : 'CE'
    : isBullish
      ? 'CE'
      : 'PE';
  const lotSz =
    liveIdxLotSize > 0
      ? liveIdxLotSize
      : lotSizeCache[idxKey]?.lotSize ||
        lotSizeCache[idx.symbol.toUpperCase()]?.lotSize ||
        (idx.symbol.includes('BANK')
          ? 30
          : idx.symbol.includes('SENSEX')
            ? 20
            : idx.symbol.includes('FIN')
              ? 60
              : idx.symbol.includes('MID')
                ? 120
                : 65);

  // Put-Call Ratio plus the highest Call-OI resistance wall and Put-OI support wall
  const { chainPcr, callWallStrike, putWallStrike } = computeChainOiMetrics(
    chainData.data,
    liveLtp,
  );

  // Sort strikes by proximity to underlying index spot, PLUS include affordable strikes that fit the user's exact Upstox account balance
  const allValidRows = [...chainData.data].filter((r: any) => Number(r.strike_price) > 0);
  const nearAtmRows = [...allValidRows]
    .sort(
      (a: any, b: any) =>
        Math.abs(Number(a.strike_price) - liveLtp) - Math.abs(Number(b.strike_price) - liveLtp),
    )
    .slice(0, 12);

  // Capital-Adaptive Institutional Selection:
  // Supports Standard (> ₹3,500), Compact (₹1,200–₹3,500 e.g. ₹2,000 Paper), AND Micro (₹350–₹1,200 e.g. ₹781.45 Live)
  const isSmallCapitalAccount = effectiveCapital > 0 && effectiveCapital <= 6500;
  const compactCapCeiling = isSmallCapitalAccount
    ? effectiveCapital
    : Math.min(Math.max(effectiveCapital, 15000), 25000);
  const isBseIndex =
    idxKey.includes('BSE_INDEX') || idx.symbol.includes('SENSEX') || idx.symbol.includes('BANKEX');
  const isSecondaryIdx =
    idx.symbol.includes('BANK') || idx.symbol.includes('FIN') || idx.symbol.includes('MID');
  const tierCfg = getCapitalTierOptionConstraints(effectiveCapital, isBseIndex, idx.symbol);
  const maxAllowedBidAskSpreadPct = tierCfg.maxSpreadPct;
  const calcEntryAffordableLots = (ltpVal: number, lotSzVal: number, cashCap: number): number => {
    if (cashCap <= 0 || ltpVal <= 0) return 0;
    let maxLotsFit = 0;
    for (let l = 1; l <= 3; l++) {
      const c = calculateTradeCharges(ltpVal, lotSzVal * l, true, ltpVal * 1.4);
      if (c.tradeValue + c.buyCharges + 3 <= cashCap) maxLotsFit = l;
      else break;
    }
    return maxLotsFit;
  };

  const affordableRows = selectAffordableRows({
    allValidRows,
    optType,
    effectiveCapital,
    compactCapCeiling,
    lotSz,
    liveLtp,
    tierCfg,
    isSecondaryIdx,
    signal,
    isBullish,
    calcEntryAffordableLots,
  });

  // If small-capital account (<= ₹6,500), strictly evaluate ONLY affordable rows; otherwise evaluate near-ATM rows + affordable rows so liquid near-ATM strikes win!
  const candidateRows =
    isSmallCapitalAccount && affordableRows.length > 0
      ? affordableRows
      : Array.from(new Set([...nearAtmRows, ...affordableRows]));

  const scoredCandidates: any[] = [];

  for (const row of candidateRows) {
    const optObj = optType === 'CE' ? row.call_options : row.put_options;
    const ltp = Number(optObj?.market_data?.ltp || 0);
    if (ltp < tierCfg.minLtp || ltp <= 1.0) continue;

    const delta = Number(optObj?.option_greeks?.delta ?? (isBullish ? 0.5 : -0.5));
    const gamma = Number(optObj?.option_greeks?.gamma ?? 0.0015);
    const theta = Number(optObj?.option_greeks?.theta ?? -8);
    const absDelta = Math.abs(delta);
    const iv = Number(optObj?.option_greeks?.iv || 15);
    const oi = Number(optObj?.market_data?.oi || 0);
    const prevOi = Number(optObj?.market_data?.prev_oi || oi);
    const oiChange = Number(optObj?.market_data?.oi_change ?? oi - prevOi);
    const volume = Number(optObj?.market_data?.volume || 0);
    const closePrice = Number(optObj?.market_data?.close_price || 0);
    const bidPrice = Number(optObj?.market_data?.bid_price || ltp);
    const askPrice = Number(optObj?.market_data?.ask_price || ltp);
    const bidQty = Number(optObj?.market_data?.bid_qty || 1);
    const askQty = Number(optObj?.market_data?.ask_qty || 1);
    const bidAskRatio = askQty > 0 ? Number((bidQty / askQty).toFixed(2)) : 1.0;
    const bidAskSpreadPct =
      ltp > 0 && askPrice >= bidPrice && bidPrice > 0 ? ((askPrice - bidPrice) / ltp) * 100 : 0;

    // Skip illiquid strikes or strikes with excessively wide bid-ask spreads
    const passesCandLiquidity =
      tierCfg.tier === 'STANDARD' || isSecondaryIdx || effectiveCapital < 300
        ? (volume >= tierCfg.minVolume || oi >= tierCfg.minOi) && volume > 0 && oi > 0
        : volume >= tierCfg.minVolume && oi >= tierCfg.minOi;
    if (!passesCandLiquidity) {
      continue;
    }
    if (bidAskSpreadPct > maxAllowedBidAskSpreadPct) continue;

    // Smart Anti-Churn & High-Profit Re-entry Guard:
    // 1. Enforce max entries per strike today so one contract isn't churned endlessly.
    // 2. After a NET LOSS on a strike (incl. brokerage), lock that specific losing strike for 15 minutes
    //    while still allowing other qualified strikes immediately after 30s.
    if (
      isChainStrikeCoolingDown({
        instrumentKey: optObj?.instrument_key,
        activeSessionTrades,
      })
    ) {
      continue;
    }
    const economics = evaluateStrikeEconomics({
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
      cheapestSkippedStrikeForCap,
    });
    cheapestSkippedStrikeForCap = economics.cheapestSkippedStrikeForCap;
    if (economics.skip) continue;
    scoredCandidates.push(economics.candidate);
  }

  scoredCandidates.sort((a, b) => b.score - a.score);
  const topCandidates = scoredCandidates.slice(0, 4);
  bestCandidate = topCandidates[0] || null;
  topOptionCandidateForIndex = bestCandidate;

  if (topCandidates.length > 0) {
    const verified = await verifyOptionCandidates({
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
      bestCandidate,
      signal,
    });
    bestCandidate = verified.bestCandidate;
    signal = verified.signal;
    verifiedRealOptionStrike = verified.verifiedRealOptionStrike;
  }

  return {
    signal,
    bestCandidate,
    topOptionCandidateForIndex,
    cheapestSkippedStrikeForCap,
    verifiedRealOptionStrike,
  };
}
