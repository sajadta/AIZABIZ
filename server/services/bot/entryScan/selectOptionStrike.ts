// Strike selection for one index: option-chain fetch, capital-tier filtering,
// candidate scoring and live 1-minute momentum verification.
import { botSignals, optionContractCache, optionChainCache } from '../../../state';
import {} from '../../../../src/utils/indicators';
import { resilientFetchJson } from '../../../lib/http';
import { lotSizeCache } from '../../../lib/instruments';
import {} from '../../../lib/optionTradeRules';
import { getTodayIstDateString } from '../../../lib/upstoxHistory';
import { evaluateChainCandidates } from './chainCandidates';
import {} from '../antiChurn';

export interface StrikeSelectionParams {
  token: string;
  idx: any;
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
}

export interface StrikeSelectionResult {
  signal: any;
  bestCandidate: any;
  topOptionCandidateForIndex: any;
  cheapestSkippedStrikeForCap: any;
  verifiedRealOptionStrike: boolean;
}

export async function selectOptionStrike(
  params: StrikeSelectionParams,
): Promise<StrikeSelectionResult> {
  const {
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
  } = params;
  let signal = params.signal;
  let verifiedRealOptionStrike = false;
  let topOptionCandidateForIndex: any = null;
  let bestCandidate: any = null;
  let cheapestSkippedStrikeForCap: any = null;

  if (token) {
    try {
      const idxKey = idx.key;
      let contractData = optionContractCache[idxKey]?.data;
      if (!contractData || Date.now() - (optionContractCache[idxKey]?.timestamp || 0) > 60000) {
        const cJson: any = await resilientFetchJson(
          `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(idxKey)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          },
          2,
          6000,
        );
        if (cJson?.data?.length > 0) {
          contractData = cJson;
          optionContractCache[idxKey] = {
            timestamp: Date.now(),
            data: cJson,
          };
        }
      }
      if (contractData?.data?.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const validExpiries = contractData.data
          .map((c: any) => c.expiry)
          .filter((e: any) => new Date(e).getTime() >= today.getTime())
          .sort((a: any, b: any) => new Date(a).getTime() - new Date(b).getTime());
        const expiryDate =
          validExpiries.length > 0 ? validExpiries[0] : contractData.data[0].expiry;

        const todayIstStr = getTodayIstDateString();
        const isExpiryDay0DTE = String(expiryDate || '') === todayIstStr;
        const istNowMins =
          (new Date().getUTCHours() * 60 + new Date().getUTCMinutes() + 330) % 1440;
        const isMiddayThetaChopWindow = istNowMins >= 12 * 60 + 15 && istNowMins <= 13 * 60 + 15;
        const currentAdxVal = Number(signal?.indicators?.adx?.value ?? 18);
        const passesExpiryChopShield = !(
          isExpiryDay0DTE &&
          isMiddayThetaChopWindow &&
          (currentAdxVal < 20 || Number(signal?.confidenceScore || 0) < 82)
        );
        if (!passesExpiryChopShield && signal) {
          signal.signalType = 'HOLD';
          signal.confidenceScore = Math.min(signal.confidenceScore || 55, 58);
          signal.reason = `0DTE Expiry Midday Theta Chop Guard (12:15–13:15 IST): Waiting for high-ADX (>=20) breakout (ADX: ${currentAdxVal.toFixed(1)}).`;
        }

        const activeContractForLot =
          contractData.data.find(
            (c: any) => c.expiry === expiryDate && Number(c.lot_size || c.minimum_lot) > 0,
          ) || contractData.data.find((c: any) => Number(c.lot_size || c.minimum_lot) > 0);
        const liveIdxLotSize = Number(
          activeContractForLot?.lot_size || activeContractForLot?.minimum_lot || 0,
        );
        if (liveIdxLotSize > 0) {
          const entry = {
            lotSize: liveIdxLotSize,
            timestamp: Date.now(),
            source: 'UPSTOX_LIVE',
            expiry: expiryDate,
          };
          lotSizeCache[idxKey] = entry;
          lotSizeCache[idx.symbol.toUpperCase()] = entry;
        }

        const chainCacheKey = `${idxKey}_${expiryDate}`;
        let chainData = optionChainCache[chainCacheKey]?.data;
        if (
          passesExpiryChopShield &&
          (!chainData || Date.now() - (optionChainCache[chainCacheKey]?.timestamp || 0) > 10000)
        ) {
          const chJson: any = await resilientFetchJson(
            `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(idxKey)}&expiry_date=${expiryDate}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Api-Version': '2.0',
              },
            },
            2,
            6000,
          );
          if (chJson?.data && Array.isArray(chJson.data)) {
            chainData = chJson;
            optionChainCache[chainCacheKey] = {
              timestamp: Date.now(),
              data: chJson,
            };
          }
          if (!chainData?.data && optionChainCache[chainCacheKey]?.data) {
            chainData = optionChainCache[chainCacheKey].data;
          }
        }
        if (passesExpiryChopShield && chainData?.data && Array.isArray(chainData.data)) {
          const result = await evaluateChainCandidates({
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
            signal,
            bestCandidate,
            topOptionCandidateForIndex,
            cheapestSkippedStrikeForCap,
            verifiedRealOptionStrike,
          });
          signal = result.signal;
          bestCandidate = result.bestCandidate;
          topOptionCandidateForIndex = result.topOptionCandidateForIndex;
          cheapestSkippedStrikeForCap = result.cheapestSkippedStrikeForCap;
          verifiedRealOptionStrike = result.verifiedRealOptionStrike;
        }
      }
    } catch (e) {
      console.error('Option Fetch Error: ', e);
    }
  }

  if (signal && !verifiedRealOptionStrike) {
    signal.signalType = 'HOLD';
    signal.confidenceScore = Math.min(signal.confidenceScore || 50, 58);
    signal.confidence = Math.min(signal.confidence || 50, 58);
  }

  // Always keep exactly 1 up-to-date signal per underlying index in botSignals so downgraded HOLD signals never leave stale BUY/SELL entries!
  if (signal) {
    const signalSymbol = signal.symbol;
    const existingIdx = botSignals.findIndex(
      (s) => s.underlyingInstrumentKey === idx.key || s.symbol === signalSymbol,
    );
    if (existingIdx === -1) {
      botSignals.unshift(signal);
      if (botSignals.length > 20) botSignals.length = 20;
    } else {
      botSignals[existingIdx] = signal;
    }
  }
  return {
    signal,
    bestCandidate,
    topOptionCandidateForIndex,
    cheapestSkippedStrikeForCap,
    verifiedRealOptionStrike,
  };
}
