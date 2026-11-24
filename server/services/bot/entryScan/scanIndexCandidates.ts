// Per-index candidate scanning: candle loading, signal generation, strike
// selection and candidate accumulation for the multi-index alpha comparison.
import { botConfig, botLogs, botSignals, globalLiveQuotes } from '../../../state';
import {
  analyzeTradingSignals,
  enrichCandlesWithIndicators,
  calculateTradeCharges,
  calculateAffordableLotsWithBrokerage,
} from '../../../../src/utils/indicators';
import { resilientFetchJson } from '../../../lib/http';
import { getDynamicLotSize, lotSizeCache } from '../../../lib/instruments';
import {} from '../../../lib/optionTradeRules';
import { loadIntradayCandles } from './intradayCandles';
import { isStrikeChurnBlocked } from './strikeAntiChurn';
import { getFiveYearRegime } from './fiveYearRegime';
import { computeInstitutionalFlow } from './institutionalFlow';
import { computeAlphaScore } from './alphaScore';
import { applyLiveTick, mapUpstoxCandles } from './candles';
import { selectOptionStrike } from './selectOptionStrike';
import { applyCrossIndexVeto } from './crossIndexVeto';

let lastCapitalShortfallLogMs = 0;

export interface ScanIndexCandidatesParams {
  token: string;
  scanIndices: any[];
  activePositions: any[];
  activeSessionTrades: any[];
  liveQuotesMap: any;
  effectiveCapital: number;
  isDailyTradeLimitReached: boolean;
  isInPostExitCooldown: boolean;
  isTradingDay: boolean;
  isTradingHours: boolean;
  marketAlphaCandidates: any[];
  currentTickMultiIndexComparison: any[];
}

export async function scanIndexCandidates(params: ScanIndexCandidatesParams): Promise<void> {
  const {
    token,
    scanIndices,
    activePositions,
    activeSessionTrades,
    liveQuotesMap,
    effectiveCapital,
    isDailyTradeLimitReached,
    isInPostExitCooldown,
    isTradingDay,
    isTradingHours,
    marketAlphaCandidates,
    currentTickMultiIndexComparison,
  } = params;

  for (const idx of scanIndices) {
    const today = new Date();
    const toDate = today.toISOString().split('T')[0];

    try {
      let verifiedRealOptionStrike = false;
      let topOptionCandidateForIndex: any = null;
      let bestCandidate: any = null;
      let cheapestSkippedStrikeForCap: any = null;
      const cData = await loadIntradayCandles(idx, token);

      if (cData?.status === 'success' && Array.isArray(cData.data?.candles)) {
        const rawCandles = mapUpstoxCandles(cData.data.candles);

        if (rawCandles.length === 0) continue;

        // Get live quote for this specific index FIRST and merge into rawCandles BEFORE enrichCandlesWithIndicators
        // so that EMA9, EMA21, SuperTrend, RSI, and MACD are calculated on the real-time tick price!
        let liveLtp =
          globalLiveQuotes[idx.key]?.last_price || rawCandles[rawCandles.length - 1].close;
        if (token && !globalLiveQuotes[idx.key]?.last_price) {
          try {
            const qData: any = await resilientFetchJson(
              `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(idx.key)}`,
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
            if (qData?.data?.[idx.key]?.last_price) {
              liveLtp = qData.data[idx.key].last_price;
            }
          } catch {
            // Ignored
          }
        }
        applyLiveTick(rawCandles, liveLtp);

        const {
          corporateHeavyweightScore,
          corporateHeavyweightSummary,
          globalMacroAlignment,
          bankQuote: bankQ,
        } = computeInstitutionalFlow(idx.symbol, liveQuotesMap, globalLiveQuotes);

        const enriched = enrichCandlesWithIndicators(rawCandles);

        const fiveYearMetrics = await getFiveYearRegime(idx, { token, today, toDate, liveLtp });

        const liveIndiaVix = Number(
          liveQuotesMap['NSE_INDEX|India VIX']?.last_price ||
            globalLiveQuotes['NSE_INDEX|India VIX']?.last_price ||
            13.8,
        );

        let signal = analyzeTradingSignals(
          idx.symbol,
          idx.symbol,
          idx.key,
          enriched,
          liveLtp,
          botConfig.selectedStrategy as any,
          undefined,
          {
            strikePrice: Math.round(liveLtp / 50) * 50,
            optionType: corporateHeavyweightScore < 0 ? 'PE' : 'CE',
            ltp: 0,
            expiry: 'Current Weekly',
            lotSize: idx.symbol.includes('BANK')
              ? 30
              : idx.symbol.includes('SENSEX')
                ? 20
                : idx.symbol.includes('FIN')
                  ? 60
                  : idx.symbol.includes('MID')
                    ? 120
                    : 65,
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
          },
        );

        applyCrossIndexVeto({
          symbol: idx.symbol,
          signal,
          bankQuote: bankQ,
          corporateHeavyweightScore,
        });

        verifiedRealOptionStrike = false;
        topOptionCandidateForIndex = null;
        bestCandidate = null;

        if (signal && (signal.signalType === 'BUY' || signal.signalType === 'SELL')) {
          const selection = await selectOptionStrike({
            token,
            idx,
            liveLtp,
            effectiveCapital,
            enriched,
            fiveYearMetrics,
            corporateHeavyweightScore,
            corporateHeavyweightSummary,
            globalMacroAlignment,
            liveIndiaVix,
            activeSessionTrades,
            signal,
          });
          signal = selection.signal;
          bestCandidate = selection.bestCandidate;
          topOptionCandidateForIndex = selection.topOptionCandidateForIndex;
          cheapestSkippedStrikeForCap = selection.cheapestSkippedStrikeForCap;
          verifiedRealOptionStrike = selection.verifiedRealOptionStrike;
        } else if (signal) {
          // Also update/show live HOLD analysis in botSignals so the UI always displays real-time index status while waiting for a breakout
          const existingIdx = botSignals.findIndex(
            (s) => s.underlyingInstrumentKey === idx.key || s.symbol === idx.symbol,
          );
          if (existingIdx === -1) {
            botSignals.push(signal);
            if (botSignals.length > 20) botSignals.length = 20;
          } else {
            botSignals[existingIdx] = signal;
          }
        }

        const displayCandidate = topOptionCandidateForIndex || cheapestSkippedStrikeForCap;
        const isCapitalShortfallBlocked = Boolean(
          !verifiedRealOptionStrike &&
          !topOptionCandidateForIndex &&
          cheapestSkippedStrikeForCap &&
          effectiveCapital > 0 &&
          cheapestSkippedStrikeForCap.totalRequiredWithBrokerage > effectiveCapital,
        );
        if (
          isCapitalShortfallBlocked &&
          idx.symbol === 'NIFTY 50' &&
          Date.now() - lastCapitalShortfallLogMs >= 180000
        ) {
          lastCapitalShortfallLogMs = Date.now();
          const reqAmt = Math.round(cheapestSkippedStrikeForCap.totalRequiredWithBrokerage);
          const capTag =
            botConfig.mode === 'UPSTOX_LIVE' ? 'CAPITAL & BROKERAGE SHIELD' : 'PAPER CAPITAL GUARD';
          botLogs.unshift({
            id: Date.now().toString(),
            time: new Date().toLocaleTimeString(),
            message: `[${capTag}] ⚠️ ${idx.symbol} മികച്ച സ്ട്രൈക്കിന് (${cheapestSkippedStrikeForCap.strikePrice} ${cheapestSkippedStrikeForCap.optType} @ ₹${cheapestSkippedStrikeForCap.ltp}) 1 Lot + ബ്രോക്കറേജ് (₹72) ഉൾപ്പെടെ ₹${reqAmt.toLocaleString('en-IN')} വേണം — നിലവിലെ ബാലൻസ് ₹${effectiveCapital.toFixed(2)} മാത്രമാണ്. ബ്രോക്കറേജ് നഷ്ടം വരുന്ന വിലകുറഞ്ഞ Deep-OTM ട്രേഡുകൾ ബ്ലോക്ക് ചെയ്ത് പണം സംരക്ഷിച്ചു.`,
            type: 'WARN',
          });
          if (botLogs.length > 200) botLogs.length = 200;
        }

        const expNetVal = Number(displayCandidate?.expectedNetProfit || 0);
        const timeframe15m = signal?.mtfConfirmation?.timeframe15m ?? 'NEUTRAL';
        const idxScanItem: any = {
          key: idx.key,
          symbol: idx.symbol,
          displayName: idx.symbol,
          exchange: idx.key.startsWith('BSE') ? 'BSE' : 'NSE',
          spotLtp: liveLtp,
          trend15m: timeframe15m,
          trend5m: signal?.mtfConfirmation?.timeframe5m || 'NEUTRAL',
          signalType: signal?.signalType || 'HOLD',
          confidenceScore: signal?.confidenceScore || 50,
          corporateHeavyweightScore,
          corporateHeavyweightSummary,
          bestOptionSymbol:
            displayCandidate && (signal?.signalType !== 'HOLD' || isCapitalShortfallBlocked)
              ? `${idx.symbol.split(' ')[0]} ${displayCandidate.strikePrice} ${displayCandidate.optType || ''}`.trim()
              : undefined,
          bestOptionLtp: displayCandidate?.ltp || 0,
          lotSize: displayCandidate?.lotSize || lotSizeCache[idx.key]?.lotSize || 1,
          bestStrike: displayCandidate?.strikePrice || 0,
          delta: displayCandidate?.delta || 0,
          gamma: displayCandidate?.gamma || 0,
          expectedNetProfit: expNetVal,
          totalRequiredCashWithBrokerage: displayCandidate?.totalRequiredWithBrokerage || 0,
          roiPotentialPct: displayCandidate?.roiPotentialPct || 0,
          alphaOpportunityScore: 0,
          verifiedRealOptionStrike,
          statusTextMl:
            signal?.signalType === 'BUY'
              ? `🔥 ശക്തമായ CE ബ്രേക്ക്ഔട്ട് (Exp Net: +₹${Math.round(expNetVal)})`
              : signal?.signalType === 'SELL'
                ? `⚡ ശക്തമായ PE ബ്രേക്ക്ഡൗൺ (Exp Net: +₹${Math.round(expNetVal)})`
                : isCapitalShortfallBlocked
                  ? `⚠️ ബാലൻസ് പോരാ: 1 Lot (${cheapestSkippedStrikeForCap.strikePrice} ${cheapestSkippedStrikeForCap.optType})-ന് ₹${Math.round(cheapestSkippedStrikeForCap.totalRequiredWithBrokerage).toLocaleString('en-IN')} വേണം (ലഭ്യം: ₹${effectiveCapital.toFixed(0)})`
                  : timeframe15m !== 'NEUTRAL'
                    ? `⏳ 15m ${timeframe15m} - മികച്ച ഓപ്ഷൻ പ്രീമിയം ബ്രേക്ക്ഔട്ടിനായി കാത്തിരിക്കുന്നു`
                    : `⏳ ഇൻഡക്സ് കൺസോളിഡേഷനിലാണ് (Chop Zone) - റേഞ്ച് ബ്രേക്ക്ഔട്ട് വെയിറ്റ് ചെയ്യുന്നു`,
          statusTextEn:
            signal?.signalType === 'BUY'
              ? `Bullish Breakout CE (Exp Net: +₹${Math.round(expNetVal)})`
              : signal?.signalType === 'SELL'
                ? `Bearish Breakdown PE (Exp Net: +₹${Math.round(expNetVal)})`
                : isCapitalShortfallBlocked
                  ? `Insufficient Funds: 1 Lot (${cheapestSkippedStrikeForCap.strikePrice} ${cheapestSkippedStrikeForCap.optType}) needs ₹${Math.round(cheapestSkippedStrikeForCap.totalRequiredWithBrokerage).toLocaleString('en-IN')} (Avail: ₹${effectiveCapital.toFixed(0)})`
                  : timeframe15m !== 'NEUTRAL'
                    ? `15m ${timeframe15m} - Waiting for high-momentum premium entry`
                    : `Consolidation Chop - Waiting for institutional breakout`,
        };
        currentTickMultiIndexComparison.push(idxScanItem);

        const isUnderlyingAlreadyOpen = activePositions.some(
          (p: any) =>
            p.underlyingInstrumentKey === idx.key ||
            (p.symbol && p.symbol.startsWith(idx.symbol.split(' ')[0])),
        );

        if (
          !isUnderlyingAlreadyOpen &&
          !botConfig.dailyLossLocked &&
          !isDailyTradeLimitReached &&
          !isInPostExitCooldown &&
          isTradingDay &&
          isTradingHours &&
          verifiedRealOptionStrike &&
          signal &&
          signal.instrumentKey &&
          !String(signal.instrumentKey).includes('INDEX') &&
          (signal.signalType === 'BUY' || signal.signalType === 'SELL') &&
          (signal.mtfConfirmation?.status === true ||
            (signal.signalType === 'BUY'
              ? signal.mtfConfirmation?.timeframe15m === 'BULLISH'
              : signal.mtfConfirmation?.timeframe15m === 'BEARISH')) &&
          signal.confidenceScore >= Math.max(78, Number(botConfig.minConfidence || 78))
        ) {
          const isBullish = signal.signalType === 'BUY';
          const optionSymbol = signal.symbol;
          const optionPrice = Number(signal.price || 0);
          const optInstrumentKey =
            signal.instrumentKey || signal.underlyingInstrumentKey || 'NSE_FO|' + optionSymbol;

          // PERSISTENT ANTI-CHURN & SMART BIG-PROFIT RE-ENTRY GUARD
          if (isStrikeChurnBlocked({ optionSymbol, optInstrumentKey, activeSessionTrades })) {
            continue;
          }
          const lotSize = await getDynamicLotSize(optionSymbol, token, optInstrumentKey);
          const lotCalc = calculateAffordableLotsWithBrokerage(
            optionPrice,
            lotSize,
            effectiveCapital,
            true,
            5,
          );
          const oneLotEntryCheck = calculateTradeCharges(
            optionPrice,
            lotSize,
            true,
            signal.target1 || optionPrice * 1.25,
          );
          const oneLotEntryCashNeeded =
            oneLotEntryCheck.tradeValue + oneLotEntryCheck.buyCharges + 3;
          const canAffordOneLiveLot =
            botConfig.mode === 'UPSTOX_LIVE' &&
            effectiveCapital > 0 &&
            oneLotEntryCashNeeded <= effectiveCapital;
          let liveEntryMaxLots = lotCalc.affordableLots;
          if (
            botConfig.mode === 'UPSTOX_LIVE' &&
            effectiveCapital > 0 &&
            effectiveCapital <= 6500
          ) {
            for (let l = 1; l <= 3; l++) {
              const lc = calculateTradeCharges(
                optionPrice,
                lotSize * l,
                true,
                signal.target1 || optionPrice * 1.25,
              );
              if (lc.tradeValue + lc.buyCharges + 3 <= effectiveCapital)
                liveEntryMaxLots = Math.max(liveEntryMaxLots, l);
              else break;
            }
          }
          // CRITICAL CAPITAL GUARD: Never enter trade if account balance cannot afford even 1 lot!
          if (
            effectiveCapital <= 0 ||
            (lotCalc.affordableLots < 1 && !canAffordOneLiveLot && liveEntryMaxLots < 1)
          ) {
            continue;
          }
          let affordableLots = Math.max(lotCalc.affordableLots, liveEntryMaxLots, 1);
          if (effectiveCapital > 30000 && (botConfig as any).maxConcurrentTrades === 1) {
            affordableLots = Math.min(affordableLots, 2);
          } else if (effectiveCapital <= 6500) {
            // Maximize profit for small capital accounts on cheap strikes across all 6 indices
            affordableLots = Math.min(affordableLots, 3);
          } else {
            affordableLots = Math.min(affordableLots, 2);
          }
          const targetQuantity = affordableLots * lotSize;
          const multiLotCharges = calculateTradeCharges(
            optionPrice,
            targetQuantity,
            true,
            signal.target1 || optionPrice * 1.25,
          );
          const totalTradeCost = multiLotCharges.tradeValue;
          const totalTradeBrokerage = multiLotCharges.roundTripCharges;
          const totalRequiredCashWithBrokerage = multiLotCharges.totalRequiredWithBrokerage;

          // Accurate entry cash requirement: option cost + entry buy charges
          const entryRequiredCash = totalTradeCost + multiLotCharges.buyCharges;
          if (entryRequiredCash > effectiveCapital) {
            continue;
          }

          const isOptionSellingEntry = botConfig.optionStrategyMode === 'OPTION_SELLING';
          const execTransactionType = isOptionSellingEntry ? 'SELL' : 'BUY';
          const execOrderType = botConfig.limitOrderSlippageGuard ? 'LIMIT' : 'MARKET';
          const roundToTick = (val: number, tick = 0.05) =>
            Number((Math.round(val / tick) * tick).toFixed(2));
          const limitPriceWithSlippageGuard = isOptionSellingEntry
            ? roundToTick(optionPrice * 0.995)
            : roundToTick(optionPrice * 1.005);
          const effectiveStopLoss = isOptionSellingEntry
            ? Number((optionPrice * 1.28).toFixed(2))
            : signal.stopLoss;
          const effectiveTarget1 = isOptionSellingEntry
            ? Number((optionPrice * 0.55).toFixed(2))
            : signal.target1;

          // Corporate quant multi-index alpha opportunity scoring
          const {
            expectedNetProfit: expNetProfit,
            profitYield,
            alphaOpportunityScore,
          } = computeAlphaScore({
            expectedNetProfit: bestCandidate?.expectedNetProfit,
            effectiveTarget1,
            optionPrice,
            targetQuantity,
            totalTradeBrokerage,
            totalRequiredCash: totalRequiredCashWithBrokerage,
            hasMtfConfirmation: Boolean(signal.mtfConfirmation?.status),
            rvol: signal.indicators?.rvol,
            confidenceScore: signal.confidenceScore,
          });

          marketAlphaCandidates.push({
            idx,
            signal,
            bestCandidate,
            optionSymbol,
            optionPrice,
            optInstrumentKey,
            lotSize,
            targetQuantity,
            affordableLots,
            totalTradeCost,
            totalTradeBrokerage,
            entryRequiredCash,
            totalRequiredCashWithBrokerage,
            effectiveStopLoss,
            effectiveTarget1,
            isBullish,
            isOptionSellingEntry,
            execTransactionType,
            execOrderType,
            limitPriceWithSlippageGuard,
            alphaOpportunityScore,
            expectedNetProfit: expNetProfit,
            profitYield,
          });
          idxScanItem.alphaOpportunityScore = alphaOpportunityScore;
          idxScanItem.expectedNetProfit = expNetProfit;
        }
      }
    } catch (innerErr: any) {
      const errStr = String(
        innerErr?.message || innerErr?.cause?.message || innerErr?.cause?.code || innerErr,
      );
      const isTransient =
        errStr.includes('ECONNRESET') ||
        errStr.includes('fetch failed') ||
        errStr.includes('socket hang up') ||
        errStr.includes('ETIMEDOUT') ||
        errStr.includes('UND_ERR_SOCKET') ||
        errStr.includes('EAI_AGAIN') ||
        innerErr?.name === 'AbortError';
      if (isTransient) {
        console.warn(
          `[Index Polling] Handled transient network reset for ${idx.key}. Using cached market state.`,
        );
      } else {
        console.error('Inner loop err for', idx.key, innerErr);
      }
    }
  }
}
