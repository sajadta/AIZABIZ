// Static instrument-key resolution for symbols, indices, futures and options.
import { paperPositions, paperTradeHistory } from '../../state';

export const lotSizeCache: Record<
  string,
  { lotSize: number; timestamp: number; source: string; expiry?: string }
> = {
  'NSE_INDEX|Nifty 50': { lotSize: 65, timestamp: Date.now(), source: 'UPSTOX_LIVE' },
  'NSE_INDEX|Nifty Bank': { lotSize: 30, timestamp: Date.now(), source: 'UPSTOX_LIVE' },
  'NSE_INDEX|Nifty Fin Service': { lotSize: 60, timestamp: Date.now(), source: 'UPSTOX_LIVE' },
  'NSE_INDEX|NIFTY MID SELECT': { lotSize: 120, timestamp: Date.now(), source: 'UPSTOX_LIVE' },
  'BSE_INDEX|SENSEX': { lotSize: 20, timestamp: Date.now(), source: 'UPSTOX_LIVE' },
  'BSE_INDEX|BANKEX': { lotSize: 30, timestamp: Date.now(), source: 'UPSTOX_LIVE' },
  'NIFTY 50': { lotSize: 65, timestamp: Date.now(), source: 'UPSTOX_LIVE' },
  NIFTY: { lotSize: 65, timestamp: Date.now(), source: 'UPSTOX_LIVE' },
  BANKNIFTY: { lotSize: 30, timestamp: Date.now(), source: 'UPSTOX_LIVE' },
  FINNIFTY: { lotSize: 60, timestamp: Date.now(), source: 'UPSTOX_LIVE' },
  MIDCPNIFTY: { lotSize: 120, timestamp: Date.now(), source: 'UPSTOX_LIVE' },
  SENSEX: { lotSize: 20, timestamp: Date.now(), source: 'UPSTOX_LIVE' },
  BANKEX: { lotSize: 30, timestamp: Date.now(), source: 'UPSTOX_LIVE' },
};

export function getInstrumentKey(symbolOrKey: string): string {
  const raw = String(symbolOrKey || '').trim();
  if (
    raw.startsWith('NSE_FO|') ||
    raw.startsWith('BSE_FO|') ||
    raw.startsWith('NSE_EQ|INE') ||
    raw.startsWith('BSE_EQ|INE')
  ) {
    return raw;
  }
  const s = raw.toUpperCase();
  if (s.includes('RELIANCE')) return 'NSE_EQ|INE002A01018';
  if (s.includes('HDFCBANK') || s === 'HDFC') return 'NSE_EQ|INE040A01034';
  if (s.includes('TCS')) return 'NSE_EQ|INE467B01029';
  if (s.includes('INFY')) return 'NSE_EQ|INE009A01021';
  if (s.includes('ICICIBANK')) return 'NSE_EQ|INE090A01021';
  if (s.includes('SBIN') || s === 'SBI') return 'NSE_EQ|INE062A01020';
  if (s.includes('AXISBANK')) return 'NSE_EQ|INE238A01034';
  if (s.includes('KOTAKBANK')) return 'NSE_EQ|INE237A01028';
  if (s.includes('INDUSINDBK')) return 'NSE_EQ|INE095A01012';
  if (s.includes('HINDUNILVR')) return 'NSE_EQ|INE030A01027';
  if (s.includes('ITC')) return 'NSE_EQ|INE154A01025';
  if (s === 'LT' || s.includes('INE018A01030')) return 'NSE_EQ|INE018A01030';
  if (s.includes('BHARTIARTL')) return 'NSE_EQ|INE397D01024';
  if (s.includes('BAJFINANCE')) return 'NSE_EQ|INE296A01024';
  if (s.includes('HCLTECH')) return 'NSE_EQ|INE860A01027';
  if (s.includes('ASIANPAINT')) return 'NSE_EQ|INE021A01026';
  if (s.includes('TATAMOTORS')) return 'NSE_EQ|INE155A01022';
  if (s.includes('TRIDENT')) return 'NSE_EQ|INE064C01022';
  if (s.includes('SUZLON')) return 'NSE_EQ|INE040H01021';
  if (s.includes('IRFC')) return 'NSE_EQ|INE053F01010';
  if (s.includes('TATASTEEL')) return 'NSE_EQ|INE081A01020';
  if (s.includes('IOC')) return 'NSE_EQ|INE242A01010';
  if (s.includes('NHPC')) return 'NSE_EQ|INE848E01016';
  if (s.includes('YESBANK')) return 'NSE_EQ|INE528G01035';
  if (s.includes('ZOMATO')) return 'NSE_EQ|INE758T01015';
  if (s.includes('BEL')) return 'NSE_EQ|INE263A01024';

  const isOption = /\b(CE|PE|CALL|PUT)\b/.test(s) || s.endsWith('CE') || s.endsWith('PE');
  if (!isOption) {
    if (s.includes('CRUDEOIL') || s.includes('CRUDE')) return 'MCX_FO|CRUDEOIL24NOVFUT';
    if (s.includes('NATURALGAS') || s.includes('NATGAS')) return 'MCX_FO|NATURALGAS24NOVFUT';
    if (s.includes('GOLD')) return 'MCX_FO|GOLD24NOVFUT';
    if (s.includes('SILVER')) return 'MCX_FO|SILVER24NOVFUT';
    if (s.includes('US500') || s.includes('S&P 500') || s.includes('SPX'))
      return 'GLOBAL_INDEX|US500';
    if (s.includes('BANKNIFTY FUT') || (s.includes('BANK') && s.includes('FUT')))
      return 'NSE_FO|BANKNIFTY24NOVFUT';
    if (s.includes('NIFTY FUT') || (s.includes('NIFTY') && s.includes('FUT')))
      return 'NSE_FO|NIFTY24NOVFUT';
    if (s.includes('BANKEX')) return 'BSE_INDEX|BANKEX';
    if (s.includes('SENSEX')) return 'BSE_INDEX|SENSEX';
    if (s.includes('MID SELECT') || s.includes('MIDCP') || s.includes('MIDCAP'))
      return 'NSE_INDEX|NIFTY MID SELECT';
    if (s.includes('FIN SERVICE') || s.includes('FINNIFTY')) return 'NSE_INDEX|Nifty Fin Service';
    if (
      s.includes('NIFTY BANK') ||
      s.includes('BANKNIFTY') ||
      s.includes('BANK NIFTY') ||
      s === 'BANK'
    )
      return 'NSE_INDEX|Nifty Bank';
    if (s.includes('NIFTY')) return 'NSE_INDEX|Nifty 50';
  } else {
    const allPos = [...(paperPositions || []), ...(paperTradeHistory || [])];
    const match = allPos.find(
      (p) => p.symbol === raw || (p.instrumentKey && p.instrumentKey === raw),
    );
    if (match && match.instrumentKey) {
      return match.instrumentKey;
    }
    if (s.includes('SENSEX') || s.includes('BANKEX')) {
      return `BSE_FO|${raw}`;
    }
    return `NSE_FO|${raw}`;
  }

  if (raw.includes(':') && !raw.includes('|')) {
    return raw.replace(':', '|');
  }
  return raw;
}

export const getUnderlyingOptionInstrumentKey = (symbolOrKey: string): string => {
  const raw = String(symbolOrKey || '').trim();
  const s = raw.toUpperCase();
  if (s.includes('BANKEX')) return 'BSE_INDEX|BANKEX';
  if (s.includes('SENSEX')) return 'BSE_INDEX|SENSEX';
  if (s.includes('MID SELECT') || s.includes('MIDCP') || s.includes('MIDCAP'))
    return 'NSE_INDEX|NIFTY MID SELECT';
  if (s.includes('FIN SERVICE') || s.includes('FINNIFTY')) return 'NSE_INDEX|Nifty Fin Service';
  if (
    s.includes('NIFTY BANK') ||
    s.includes('BANKNIFTY') ||
    s.includes('BANK NIFTY') ||
    s === 'BANK'
  )
    return 'NSE_INDEX|Nifty Bank';
  if (s.includes('NIFTY')) return 'NSE_INDEX|Nifty 50';
  return getInstrumentKey(raw);
};

export const getNextExpiry = (symbol: string) => {
  const d = new Date();
  const dayOfWeek = d.getDay();
  let targetDay = 4;

  if (symbol.includes('BANKEX')) targetDay = 1;
  else if (symbol.includes('SENSEX')) targetDay = 5;
  else if (symbol.includes('BANK')) targetDay = 3;
  else if (symbol.includes('FIN')) targetDay = 2;
  else if (symbol.includes('MIDCP') || symbol.includes('MID SELECT')) targetDay = 1;

  let diff = targetDay - dayOfWeek;
  if (diff < 0) diff += 7;

  const expiryDate = new Date(d.getTime() + diff * 24 * 60 * 60 * 1000);
  return expiryDate.toISOString().split('T')[0];
};
