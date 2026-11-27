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
import { buildIndexScanRow } from './indexScanRow';
import { sizeOptionEntry } from './entrySizing';

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

        const idxScanItem: any = buildIndexScanRow({
          idx,
          liveLtp,
          signal,
          displayCandidate,
          cheapestSkippedStrikeForCap,
          isCapitalShortfallBlocked,
          verifiedRealOptionStrike,
          corporateHeavyweightScore,
          corporateHeavyweightSummary,
          effectiveCapital,
        });
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
          const optionSymbol = signal.symbol;
          const optionPrice = Number(signal.price || 0);
          const optInstrumentKey =
            signal.instrumentKey || signal.underlyingInstrumentKey || 'NSE_FO|' + optionSymbol;
          const candidate = await sizeOptionEntry({
            token,
            idx,
            signal,
            bestCandidate,
            optionSymbol,
            optionPrice,
            optInstrumentKey,
            effectiveCapital,
            activeSessionTrades,
          });
          if (!candidate) continue;
          marketAlphaCandidates.push(candidate);
          idxScanItem.alphaOpportunityScore = candidate.alphaOpportunityScore;
          idxScanItem.expectedNetProfit = candidate.expectedNetProfit;
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
