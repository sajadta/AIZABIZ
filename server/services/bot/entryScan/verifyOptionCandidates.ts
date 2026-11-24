// Live verification of the top scored option candidates: real-time LTP, 1-minute
// candle momentum, anti-churn guards and the final signal re-analysis.
import {
  botConfig,
  globalLiveQuotes,
  optionIntradayCandleCache,
  recentClosedStrikes,
} from '../../../state';
import {
  analyzeTradingSignals,
  calculateTradeCharges,
  calculateAffordableLotsWithBrokerage,
} from '../../../../src/utils/indicators';
import { resilientFetchJson } from '../../../lib/http';
import { lotSizeCache } from '../../../lib/instruments';
import { evaluateOptionDipMomentum } from '../../../lib/optionTradeRules';
import { STRIKE_LOCKOUT_MS } from '../antiChurn';

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

  // CRITICAL LAYER-2 LIVE OPTION CANDLE & REAL-TIME QUOTE VERIFICATION:
  // Check the top near-ATM candidate strikes so if #1 has a momentary 1-tick pause, #2 (e.g. ATM vs 1-step ITM) can confirm!
  let optionMomentumConfirmed = false;

  for (const cand of topCandidates) {
    if (!cand?.instrumentKey) continue;
    let liveOptLtp = Number(globalLiveQuotes[cand.instrumentKey]?.last_price || cand.ltp);
    try {
      const optQJson: any = await resilientFetchJson(
        `https://api.upstox.com/v2/market-quote/ltp?instrument_key=${encodeURIComponent(cand.instrumentKey)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Api-Version': '2.0',
          },
        },
        1,
        3500,
      );
      const qItem = optQJson?.data?.[cand.instrumentKey] || Object.values(optQJson?.data || {})[0];
      if ((qItem as any)?.last_price > 0) {
        liveOptLtp = Number((qItem as any).last_price);
        globalLiveQuotes[cand.instrumentKey] = {
          ...(globalLiveQuotes[cand.instrumentKey] || {}),
          ...(qItem as any),
        };
      }
    } catch {
      // Ignored
    }

    const chainSnapshotLtp = Number(cand.ltp || liveOptLtp);
    cand.ltp = liveOptLtp;

    let candMomentumOk = false;
    try {
      let optRawCandles: any[] = [];
      const cachedOptC = optionIntradayCandleCache[cand.instrumentKey];
      if (cachedOptC && Date.now() - cachedOptC.timestamp < 5000) {
        optRawCandles = cachedOptC.raw;
      } else {
        const optCJson: any = await resilientFetchJson(
          `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(cand.instrumentKey)}/1minute`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
              'Api-Version': '2.0',
            },
          },
          1,
          4000,
        );
        if (
          optCJson?.status === 'success' &&
          Array.isArray(optCJson?.data?.candles) &&
          optCJson.data.candles.length > 0
        ) {
          optRawCandles = optCJson.data.candles;
          optionIntradayCandleCache[cand.instrumentKey] = {
            timestamp: Date.now(),
            raw: optRawCandles,
          };
        }
      }

      if (optRawCandles.length >= 2) {
        // Upstox returns newest candle first at index 0
        const c0 = optRawCandles[0]; // current 1m candle: [time, open, high, low, close, vol]
        const c1 = optRawCandles[1]; // 1m ago
        const c2 = optRawCandles[2] || c1; // 2m ago
        const optOpen0 = Number(c0[1] || liveOptLtp);
        const optHigh0 = Math.max(Number(c0[2] || liveOptLtp), liveOptLtp);
        const optLow0 = Math.min(Number(c0[3] || liveOptLtp), liveOptLtp);
        const optOpen1 = Number(c1[1] || liveOptLtp);
        const optHigh1 = Number(c1[2] || liveOptLtp);
        const optLow1 = Number(c1[3] || liveOptLtp);
        const optClose1 = Number(c1[4] || liveOptLtp);
        const optClose2 = Number(c2[4] || liveOptLtp);
        const optLow2 = Number(c2[3] || liveOptLtp);
        const recentOpt3mHigh = Math.max(optHigh0, optHigh1, Number(c2[2] || 0));
        // Evaluate across combined 2-candle window (c1 + c0) so a brand-new 1-minute candle with a ₹0.50 range never gets falsely rejected
        const combined2mHigh = Math.max(optHigh0, optHigh1);
        const combined2mLow = Math.min(optLow0, optLow1);
        const isFlatRangeBar = combined2mHigh - combined2mLow <= (liveOptLtp < 15 ? 0.05 : 0.15);
        const combined2mRange = Math.max(
          liveOptLtp < 6 ? 0.15 : 0.5,
          combined2mHigh - combined2mLow,
        );
        const optClosePos = isFlatRangeBar ? 0.65 : (liveOptLtp - combined2mLow) / combined2mRange;
        const optUpperWickRatio = isFlatRangeBar
          ? 0.15
          : (combined2mHigh - liveOptLtp) / combined2mRange;

        // Compute Option 3-minute VWAP / Typical Price Floor
        const tp0 = (optHigh0 + optLow0 + liveOptLtp) / 3;
        const tp1 = (optHigh1 + optLow1 + optClose1) / 3;
        const tp2 = (Number(c2[2] || liveOptLtp) + optLow2 + optClose2) / 3;
        const v0 = Math.max(1, Number(c0[5] || 1));
        const v1 = Math.max(1, Number(c1[5] || 1));
        const v2 = Math.max(1, Number(c2[5] || 1));
        const optShortVwap = (tp0 * v0 + tp1 * v1 + tp2 * v2) / (v0 + v1 + v2);

        // Verify Underlying Index's current 1m/2m trend is moving in the trade direction
        const idxLastCandle = enriched[enriched.length - 1];
        const idxPrevCandle = enriched[enriched.length - 2] || idxLastCandle;
        const isUnderlying1mConfirmingNow = isBullish
          ? liveLtp >= idxLastCandle.open * 0.9997 || liveLtp >= idxPrevCandle.close * 0.9997
          : liveLtp <= idxLastCandle.open * 1.0003 || liveLtp <= idxPrevCandle.close * 1.0003;

        const singleMinuteSpikePct = optOpen0 > 0 ? ((liveOptLtp - optOpen0) / optOpen0) * 100 : 0;
        // Allow either current 1m candle rising OR holding firm after a strong green c1/c2 impulse
        const isOptionRisingNow =
          (liveOptLtp >= optOpen0 && liveOptLtp >= optClose1 * 0.99) ||
          (liveOptLtp >= optClose1 * 0.994 && optClose1 >= optOpen1) ||
          (liveOptLtp > optClose2 && liveOptLtp >= optOpen0 * 0.992);

        // SMART BOTTOM-DIP & BASE REVERSAL ENTRY ENGINE:
        // Scales tick/percentage tolerance smoothly for micro (<₹15) and compact (<₹85) contracts.
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
          isUnderlying1mConfirmingNow &&
          liveOptLtp >= optLowestBase &&
          liveOptLtp <= optLowestBase * dynMaxBaseMult &&
          liveOptLtp >= optOpen0 * 0.992 &&
          optUpperWickRatio <= dynMaxWick;

        const isEarlyReversalTurn =
          isUnderlying1mConfirmingNow &&
          liveOptLtp >= optOpen0 * (isFlatRangeBar ? 1.0 : 1.001) &&
          liveOptLtp <= optOpen0 * (isLowPremOpt ? 1.12 : isCompactPremOpt ? 1.07 : 1.035) &&
          liveOptLtp >= optShortVwap * 0.975 &&
          liveOptLtp <= optShortVwap * dynMaxVwapMult &&
          optUpperWickRatio <= dynMaxTurnWick;

        const isLowPriceDipEntry =
          isUnderlying1mConfirmingNow &&
          liveOptLtp >= optShortVwap * 0.975 &&
          liveOptLtp <= optShortVwap * dynMaxVwapMult &&
          optClosePos >= 0.2 &&
          optClosePos <= dynMaxClosePos &&
          optUpperWickRatio <= dynMaxWick &&
          singleMinuteSpikePct <= dynMaxSpikePct &&
          singleMinuteSpikePct >= -2.5;

        const isCleanBreakoutEntry =
          isUnderlying1mConfirmingNow &&
          isOptionRisingNow &&
          (liveOptLtp >= optClose2 * 0.985 || liveOptLtp >= optClose1 * 0.99) &&
          liveOptLtp >= optShortVwap * 0.99 &&
          liveOptLtp <= optShortVwap * dynMaxVwapMult &&
          optClosePos >= 0.35 &&
          optClosePos <= dynMaxClosePos &&
          optUpperWickRatio <= dynMaxCleanWick &&
          singleMinuteSpikePct <= dynMaxSpikePct &&
          singleMinuteSpikePct >= -1.5;

        const currentIstHourNow = (new Date().getUTCHours() + 5.5) % 24;
        const currentIstMinNow = new Date().getUTCMinutes();
        const currentIstMinutesTotal = currentIstHourNow * 60 + currentIstMinNow;
        const isMorningOpeningWindow =
          currentIstMinutesTotal >= 9 * 60 + 15 && currentIstMinutesTotal <= 10 * 60 + 45;

        const isMorningOpenImpulse =
          isMorningOpeningWindow &&
          isUnderlying1mConfirmingNow &&
          liveOptLtp >= optLowestBase &&
          liveOptLtp <= optLowestBase * (isLowPremOpt ? 1.15 : isCompactPremOpt ? 1.12 : 1.055) &&
          optUpperWickRatio <= (isLowPremOpt ? 0.45 : isCompactPremOpt ? 0.42 : 0.32);

        if (isOptionSellingMode) {
          if (
            isUnderlying1mConfirmingNow &&
            liveOptLtp <= optOpen0 * 1.005 &&
            liveOptLtp <= optClose1 * 1.005 &&
            liveOptLtp <= optShortVwap * 1.008
          ) {
            candMomentumOk = true;
          }
        } else {
          // STRICT ANTI-CHASE ENTRY: Never bypass spike/wick limits just because 1m green tick fired!
          // Must satisfy genuine dip bounce, early base reversal, or controlled non-extended breakout.
          const baseOk =
            isMorningOpenImpulse ||
            isBottomDipBounce ||
            isEarlyReversalTurn ||
            isLowPriceDipEntry ||
            isCleanBreakoutEntry;
          candMomentumOk = evaluateOptionDipMomentum({
            liveOptLtp,
            chainSnapshotLtp,
            optLowestBase,
            optOpen0,
            optShortVwap,
            optUpperWickRatio,
            singleMinuteSpikePct,
            isUnderlyingConfirming: isUnderlying1mConfirmingNow,
            isBaseMomentumOk: baseOk,
          });
        }
      } else if (optRawCandles.length === 1) {
        const c0 = optRawCandles[0];
        const optOpen0 = Number(c0[1] || liveOptLtp);
        if (isOptionSellingMode ? liveOptLtp <= optOpen0 * 1.005 : liveOptLtp >= optOpen0 * 0.985) {
          candMomentumOk = true;
        }
      } else if (optRawCandles.length === 0) {
        // Fallback for BSE / new contracts when Upstox 1m historical candles are empty or delayed
        const idxLastCandle = enriched[enriched.length - 1];
        const isUnderlying1mConfirmingNow = isBullish
          ? liveLtp >= idxLastCandle.open * 0.9997
          : liveLtp <= idxLastCandle.open * 1.0003;
        if (isUnderlying1mConfirmingNow && liveOptLtp >= chainSnapshotLtp * 0.98) {
          candMomentumOk = true;
        }
      }
    } catch (optCandleErr) {
      console.error('Option 1m candle eval error:', optCandleErr);
    }

    // Anti-Double-Order Guard (15-second buffer):
    const recentClosed = cand.instrumentKey ? recentClosedStrikes[cand.instrumentKey] : null;
    if (recentClosed) {
      const elapsedSinceExit = Date.now() - recentClosed.exitTime;
      if (elapsedSinceExit < STRIKE_LOCKOUT_MS) {
        candMomentumOk = false;
      }
    }
    // Protect against sudden flash drops (>12% below option chain snapshot), while allowing normal dip pullbacks!
    if (chainSnapshotLtp > 0 && liveOptLtp < chainSnapshotLtp * 0.88) {
      candMomentumOk = false;
    }

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
    const freshCharges = calculateTradeCharges(
      liveOptLtp,
      lotSz,
      true,
      liveOptLtp * freshTargetMult,
    );
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

    if (candMomentumOk) {
      bestCandidate = cand;
      optionMomentumConfirmed = true;
      break;
    }
  }

  if (optionMomentumConfirmed && bestCandidate) {
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
    const affordableLots = Math.max(
      lotAffordability.affordableLots,
      bestCandidate.possibleLots || 1,
    );

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
  }
  return { bestCandidate, signal, verifiedRealOptionStrike };
}
