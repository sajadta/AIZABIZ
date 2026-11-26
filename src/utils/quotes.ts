import type { StockQuote } from '../types';

export const deduplicateQuotes = (quotesList: StockQuote[]): StockQuote[] => {
  const map = new Map<string, StockQuote>();
  const listToProcess = Array.isArray(quotesList) ? quotesList : [];
  for (const q of listToProcess) {
    if (!q) continue;
    const rawKey = String(q.instrumentKey || q.symbol || '')
      .toUpperCase()
      .trim();
    let normKey = q.instrumentKey || q.symbol;
    const isFuturesOrCommodityOrGlobal =
      rawKey.includes('FUT') ||
      rawKey.includes('CRUDE') ||
      rawKey.includes('GOLD') ||
      rawKey.includes('SILVER') ||
      rawKey.includes('GAS') ||
      rawKey.includes('US500') ||
      rawKey.includes('NDX') ||
      rawKey.includes('GLOBAL') ||
      q.segment === 'FUTURES' ||
      q.segment === 'COMMODITY' ||
      q.segment === 'GLOBAL';

    if (!isFuturesOrCommodityOrGlobal) {
      if (rawKey.includes('FIN SERVICE') || rawKey.includes('FINNIFTY')) {
        normKey = 'NSE_INDEX|Nifty Fin Service';
      } else if (
        rawKey.includes('MID SELECT') ||
        rawKey.includes('MIDCP') ||
        rawKey.includes('MIDCAP')
      ) {
        normKey = 'NSE_INDEX|NIFTY MID SELECT';
      } else if (rawKey.includes('BANKEX')) {
        normKey = 'BSE_INDEX|BANKEX';
      } else if (rawKey.includes('SENSEX')) {
        normKey = 'BSE_INDEX|SENSEX';
      } else if (rawKey.includes('NIFTY BANK') || rawKey.includes('BANKNIFTY')) {
        normKey = 'NSE_INDEX|Nifty Bank';
      } else if (
        rawKey.includes('NIFTY 50') ||
        (rawKey.includes('NIFTY') &&
          !rawKey.includes('BANK') &&
          !rawKey.includes('FIN') &&
          !rawKey.includes('MID'))
      ) {
        normKey = 'NSE_INDEX|Nifty 50';
      }
    }
    if (!map.has(normKey)) {
      map.set(normKey, q);
    }
  }
  return Array.from(map.values());
};

export const getStandardIndexLotSize = (symbolOrKey: string): number => {
  const s = String(symbolOrKey || '').toUpperCase();
  if (s.includes('MID SELECT') || s.includes('MIDCP') || s.includes('MIDCAP')) return 120;
  if (s.includes('FIN SERVICE') || s.includes('FINNIFTY')) return 60;
  if (s.includes('BANKNIFTY') || s.includes('NIFTY BANK') || s === 'BANK') return 30;
  if (s.includes('BANKEX')) return 30;
  if (s.includes('SENSEX')) return 20;
  if (s.includes('NIFTY')) return 65;
  return 1;
};
