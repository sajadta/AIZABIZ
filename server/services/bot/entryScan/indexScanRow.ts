// Builds the per-index row rendered in the multi-index alpha comparison panel.
import { lotSizeCache } from '../../../lib/instruments';

export interface IndexScanRowParams {
  idx: any;
  liveLtp: number;
  signal: any;
  displayCandidate: any;
  cheapestSkippedStrikeForCap: any;
  isCapitalShortfallBlocked: boolean;
  verifiedRealOptionStrike: boolean;
  corporateHeavyweightScore: number;
  corporateHeavyweightSummary: string;
  effectiveCapital: number;
}

export function buildIndexScanRow(p: IndexScanRowParams): any {
  const {
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
  } = p;
  const expNetVal = Number(displayCandidate?.expectedNetProfit || 0);
  const timeframe15m = signal?.mtfConfirmation?.timeframe15m ?? 'NEUTRAL';

  return {
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
}
