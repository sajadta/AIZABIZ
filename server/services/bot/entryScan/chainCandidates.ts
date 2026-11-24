// Option-chain candidate evaluation: capital-tier filtering, strike scoring and
// live 1-minute momentum verification for a single underlying index.
import { botConfig, recentClosedStrikes } from '../../../state';
import {
  calculateTradeCharges,
  calculateAffordableLotsWithBrokerage,
} from '../../../../src/utils/indicators';
import { lotSizeCache } from '../../../lib/instruments';
import { getCapitalTierOptionConstraints } from '../../../lib/optionTradeRules';
import { getTradeNetPnL } from './sessionCircuit';
import { computeChainOiMetrics } from './chainMetrics';
import { scoreStrikeCandidate } from './strikeScoring';
import { verifyOptionCandidates } from './verifyOptionCandidates';
import {
  strikeDailyEntryCount,
  STRIKE_LOCKOUT_MS,
  STRIKE_LOSS_LOCKOUT_MS,
  MAX_STRIKE_ENTRIES_DEFAULT,
  MAX_STRIKE_ENTRIES_TRENDING,
} from '../antiChurn';

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

  const affordableRows =
    effectiveCapital > 0
      ? allValidRows
          .filter((r: any) => {
            const optObj = optType === 'CE' ? r.call_options : r.put_options;
            const ltp = Number(optObj?.market_data?.ltp || 0);
            const absDelta = Math.abs(Number(optObj?.option_greeks?.delta ?? 0.35));
            const absGamma = Math.abs(Number(optObj?.option_greeks?.gamma ?? 0.0001));
            const vol = Number(optObj?.market_data?.volume || 0);
            const oiVal = Number(optObj?.market_data?.oi || 0);
            const underlyingAtrVal = Number(signal?.institutionalQuantAnalysis?.atr14 || 18);
            const underlyingResVal = Number(
              signal?.institutionalQuantAnalysis?.nearestResistance ||
                liveLtp + underlyingAtrVal * 2.5,
            );
            const underlyingSupVal = Number(
              signal?.institutionalQuantAnalysis?.nearestSupport ||
                liveLtp - underlyingAtrVal * 2.5,
            );
            const runwayPoints = isBullish
              ? Math.max(underlyingAtrVal * 1.8, underlyingResVal - liveLtp)
              : Math.max(underlyingAtrVal * 1.8, liveLtp - underlyingSupVal);
            const gammaGainPts =
              0.5 * absGamma * Math.pow(Math.min(runwayPoints, underlyingAtrVal * 3), 2);
            const expGainPts = Math.max(ltp * 0.25, runwayPoints * absDelta + gammaGainPts);
            const tMult = Math.max(1.25, (ltp + expGainPts) / (ltp || 1));
            const charges = calculateTradeCharges(ltp, lotSz, true, ltp * tMult);
            const lotAfford = calculateAffordableLotsWithBrokerage(
              ltp,
              lotSz,
              compactCapCeiling,
              true,
              5,
            );
            const liveEntryLots =
              botConfig.mode === 'UPSTOX_LIVE'
                ? calcEntryAffordableLots(ltp, lotSz, compactCapCeiling)
                : 0;
            const entryCashNeeded = charges.tradeValue + charges.buyCharges + 3;
            const requiredCapForRow =
              botConfig.mode === 'UPSTOX_LIVE'
                ? entryCashNeeded
                : charges.totalRequiredWithBrokerage;
            const possibleLots = Math.max(
              lotAfford.affordableLots,
              liveEntryLots,
              requiredCapForRow <= compactCapCeiling ? 1 : 0,
            );
            const expNet =
              ltp * (tMult - 1) * lotSz * Math.max(1, possibleLots) - charges.roundTripCharges;
            const strikeDistPct = Math.abs(Number(r.strike_price) - liveLtp) / liveLtp;
            const reqMinProfit = tierCfg.getMinReqNetProfit(
              charges.roundTripCharges,
              botConfig.minOptionProfitAmount,
            );
            const hasLiquidity =
              tierCfg.tier === 'STANDARD' || isSecondaryIdx || effectiveCapital < 300
                ? (vol >= tierCfg.minVolume || oiVal >= tierCfg.minOi) && vol > 0 && oiVal > 0
                : vol >= tierCfg.minVolume && oiVal >= tierCfg.minOi;
            const brokerageDragPct =
              charges.tradeValue > 0 ? charges.roundTripCharges / charges.tradeValue : 1;
            return (
              ltp >= tierCfg.minLtp &&
              strikeDistPct <= tierCfg.maxStrikeDistPct &&
              brokerageDragPct <= tierCfg.maxBrokerageDragPct &&
              possibleLots >= 1 &&
              requiredCapForRow <= compactCapCeiling &&
              absDelta >= tierCfg.minDelta &&
              hasLiquidity &&
              expNet >= reqMinProfit
            );
          })
          .sort((a: any, b: any) => {
            return (
              Math.abs(Number(a.strike_price) - liveLtp) -
              Math.abs(Number(b.strike_price) - liveLtp)
            );
          })
          .slice(0, 8)
      : [];

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
    const optKeyCandidate = optObj?.instrument_key;
    const liveStrikeClosedTrades = optKeyCandidate
      ? activeSessionTrades.filter((t: any) => t.instrumentKey === optKeyCandidate)
      : [];
    const strikeTradesToday = optKeyCandidate
      ? Math.max(strikeDailyEntryCount[optKeyCandidate] || 0, liveStrikeClosedTrades.length)
      : 0;
    const recentClosed = optKeyCandidate ? recentClosedStrikes[optKeyCandidate] : null;
    const latestLiveStrikeClosed = liveStrikeClosedTrades[0] || null;
    const latestStrikeExitTs = Math.max(
      recentClosed?.exitTime || 0,
      latestLiveStrikeClosed?.closeTime ? new Date(latestLiveStrikeClosed.closeTime).getTime() : 0,
    );
    const lastStrikeWasNetLoss = recentClosed
      ? typeof recentClosed.netRealizedPnL === 'number'
        ? recentClosed.netRealizedPnL < 0
        : recentClosed.sellPrice < (recentClosed.buyPrice || 0)
      : latestLiveStrikeClosed
        ? getTradeNetPnL(latestLiveStrikeClosed) < 0
        : false;
    const maxAllowedForStrike = !lastStrikeWasNetLoss
      ? MAX_STRIKE_ENTRIES_TRENDING
      : MAX_STRIKE_ENTRIES_DEFAULT;

    if (strikeTradesToday >= maxAllowedForStrike) {
      continue;
    }
    if (latestStrikeExitTs > 0) {
      const elapsedSinceExit = Date.now() - latestStrikeExitTs;
      const strikeCooldownNeeded = lastStrikeWasNetLoss
        ? STRIKE_LOSS_LOCKOUT_MS
        : STRIKE_LOCKOUT_MS;
      if (elapsedSinceExit < strikeCooldownNeeded) {
        continue;
      }
    }
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

    const entryRequiredCashForStrike = Number(
      (oneLotCost + strikeCharges.buyCharges + 3).toFixed(2),
    );
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
    if (scoring.skip) continue;
    const score = scoring.score;

    scoredCandidates.push({
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
    });
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
