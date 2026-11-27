// Live corporate heavyweight flow and global macro alignment, derived from the
// real-time Upstox quote map for the index being scanned.

interface HeavyweightDef {
  sym: string;
  key: string;
  weight: number;
}

const BANK_HEAVYWEIGHTS: HeavyweightDef[] = [
  { sym: 'HDFCBANK', key: 'NSE_EQ|INE040A01034', weight: 28 },
  { sym: 'ICICIBANK', key: 'NSE_EQ|INE090A01021', weight: 24 },
  { sym: 'SBIN', key: 'NSE_EQ|INE062A01020', weight: 12 },
  { sym: 'AXISBANK', key: 'NSE_EQ|INE238A01034', weight: 10 },
  { sym: 'KOTAKBANK', key: 'NSE_EQ|INE237A01028', weight: 10 },
  { sym: 'INDUSINDBK', key: 'NSE_EQ|INE095A01012', weight: 6 },
];

const BROAD_HEAVYWEIGHTS: HeavyweightDef[] = [
  { sym: 'HDFCBANK', key: 'NSE_EQ|INE040A01034', weight: 13 },
  { sym: 'RELIANCE', key: 'NSE_EQ|INE002A01018', weight: 11 },
  { sym: 'ICICIBANK', key: 'NSE_EQ|INE090A01021', weight: 9 },
  { sym: 'INFY', key: 'NSE_EQ|INE009A01021', weight: 7 },
  { sym: 'TCS', key: 'NSE_EQ|INE467B01029', weight: 6 },
  { sym: 'ITC', key: 'NSE_EQ|INE154A01025', weight: 5 },
  { sym: 'LT', key: 'NSE_EQ|INE018A01030', weight: 5 },
  { sym: 'SBIN', key: 'NSE_EQ|INE062A01020', weight: 4 },
];

const findQuote = (liveQuotesMap: any, globalLiveQuotes: any, key: string, sym?: string) =>
  liveQuotesMap[key] ||
  globalLiveQuotes[key] ||
  Object.values(liveQuotesMap).find(
    (item: any) =>
      item?.instrument_token === key || String(item?.symbol || '').toUpperCase() === sym,
  );

export interface InstitutionalFlow {
  corporateHeavyweightScore: number;
  corporateHeavyweightSummary: string;
  globalMacroAlignment: 'BULLISH' | 'BEARISH' | 'MIXED';
  bankQuote: any;
}

export function computeInstitutionalFlow(
  indexSymbol: string,
  liveQuotesMap: any,
  globalLiveQuotes: any,
): InstitutionalFlow {
  const isBankIndex = indexSymbol.includes('BANK') || indexSymbol.includes('FIN');
  const heavyweightDefs = isBankIndex ? BANK_HEAVYWEIGHTS : BROAD_HEAVYWEIGHTS;

  let weightedBull = 0;
  let totalWeightTracked = 0;
  const bullMovers: string[] = [];
  const bearMovers: string[] = [];

  for (const hw of heavyweightDefs) {
    const q = findQuote(liveQuotesMap, globalLiveQuotes, hw.key, hw.sym);
    if (q && Number(q.last_price) > 0) {
      const ltpHw = Number(q.last_price);
      const openHw = Number(q.ohlc?.open || ltpHw);
      const netChg = q.net_change !== undefined ? Number(q.net_change) : ltpHw - openHw;
      totalWeightTracked += hw.weight;
      if (netChg > 0 && ltpHw >= openHw) {
        weightedBull += hw.weight;
        bullMovers.push(`${hw.sym} ↑`);
      } else if (netChg < 0 && ltpHw <= openHw) {
        weightedBull -= hw.weight;
        bearMovers.push(`${hw.sym} ↓`);
      }
    }
  }

  const corporateHeavyweightScore =
    totalWeightTracked > 0 ? Math.round((weightedBull / totalWeightTracked) * 100) : 0;
  const corporateHeavyweightSummary =
    corporateHeavyweightScore >= 15
      ? `Heavyweights Bullish (${bullMovers.slice(0, 4).join(', ') || 'Top Corporates Buying'})`
      : corporateHeavyweightScore <= -15
        ? `Heavyweights Bearish (${bearMovers.slice(0, 4).join(', ') || 'Top Corporates Selling'})`
        : `Mixed Heavyweight Flow (${[...bullMovers.slice(0, 2), ...bearMovers.slice(0, 2)].join(', ') || 'Neutral'})`;

  // Global tech proxy (INFY + TCS) plus broad index breadth.
  const macroQuotes = [
    findQuote(liveQuotesMap, globalLiveQuotes, 'NSE_EQ|INE009A01021', 'INFY'),
    findQuote(liveQuotesMap, globalLiveQuotes, 'NSE_EQ|INE467B01029', 'TCS'),
    findQuote(liveQuotesMap, globalLiveQuotes, 'NSE_INDEX|Nifty 50', 'NIFTY 50'),
    findQuote(liveQuotesMap, globalLiveQuotes, 'NSE_INDEX|Nifty Bank', 'NIFTY BANK'),
  ];
  let macroBullCount = 0;
  let macroBearCount = 0;
  for (const mqItem of macroQuotes) {
    if (mqItem && Number(mqItem.last_price) > 0) {
      const chg = Number(
        mqItem.net_change ?? mqItem.last_price - (mqItem.ohlc?.open || mqItem.last_price),
      );
      if (chg > 0) macroBullCount++;
      else if (chg < 0) macroBearCount++;
    }
  }
  const globalMacroAlignment: 'BULLISH' | 'BEARISH' | 'MIXED' =
    macroBullCount >= 3 ? 'BULLISH' : macroBearCount >= 3 ? 'BEARISH' : 'MIXED';

  return {
    corporateHeavyweightScore,
    corporateHeavyweightSummary,
    globalMacroAlignment,
    bankQuote: macroQuotes[3],
  };
}
