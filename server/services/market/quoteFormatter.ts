// Upstox quote payload normalization: converts the raw per-instrument map into
// the flat list the UI consumes, while refreshing live marks for paper positions.
import { globalLiveQuotes, paperPositions } from '../../state';
import { getInstrumentKey } from '../../lib/instruments';

export function formatUpstoxQuotesToStandardList(upstoxData: any) {
  const list: any[] = [];
  for (const [key, val] of Object.entries(upstoxData || {})) {
    const v = val as any;
    if (!v) continue;
    const parts = key.split(/[:|]/);
    let symbolDisplay = (
      v.symbol && v.symbol !== 'NA' ? v.symbol : parts.length > 1 ? parts[1] : key
    ).toUpperCase();
    const canonicalInstrumentKey = getInstrumentKey(v.instrument_token || key || symbolDisplay);
    // Standardize index display names so NIFTY 50, BANKNIFTY, FINNIFTY, SENSEX, BANKEX match watchlist & charts seamlessly
    if (canonicalInstrumentKey === 'NSE_INDEX|Nifty 50') symbolDisplay = 'NIFTY 50';
    else if (canonicalInstrumentKey === 'NSE_INDEX|Nifty Bank') symbolDisplay = 'BANKNIFTY';
    else if (canonicalInstrumentKey === 'NSE_INDEX|Nifty Fin Service') symbolDisplay = 'FINNIFTY';
    else if (canonicalInstrumentKey === 'BSE_INDEX|SENSEX') symbolDisplay = 'SENSEX';
    else if (canonicalInstrumentKey === 'BSE_INDEX|BANKEX') symbolDisplay = 'BANKEX';
    else if (canonicalInstrumentKey === 'NSE_INDEX|NIFTY MID SELECT') symbolDisplay = 'MIDCPNIFTY';

    const segment = key.includes('INDEX') ? 'INDEX' : key.includes('FO') ? 'OPTIONS' : 'EQUITY';
    const ltp = Number(v.last_price || 0);
    const netChange =
      v.net_change !== undefined && v.net_change !== null
        ? Number(v.net_change)
        : v.ohlc?.close && v.ohlc.close !== ltp
          ? Number((ltp - Number(v.ohlc.close)).toFixed(2))
          : 0;
    const prevClose =
      netChange !== 0
        ? Number((ltp - netChange).toFixed(2))
        : Number(v.ohlc?.close || v.close || ltp);
    const changePercent = prevClose > 0 ? Number(((netChange / prevClose) * 100).toFixed(2)) : 0;

    if (ltp > 0) {
      globalLiveQuotes[canonicalInstrumentKey] = {
        last_price: ltp,
        net_change: netChange,
        changePercent,
        instrument_token: v.instrument_token || canonicalInstrumentKey,
      };
      globalLiveQuotes[key] = {
        last_price: ltp,
        net_change: netChange,
        changePercent,
        instrument_token: v.instrument_token || canonicalInstrumentKey,
      };
      if (v.instrument_token) {
        globalLiveQuotes[v.instrument_token] = {
          last_price: ltp,
          net_change: netChange,
          changePercent,
          instrument_token: v.instrument_token,
        };
      }
      globalLiveQuotes['last_update'] = new Date().toISOString();
    }
    list.push({
      symbol: symbolDisplay,
      name: symbolDisplay,
      exchange: key.startsWith('BSE') ? 'BSE' : 'NSE',
      segment,
      instrumentKey: canonicalInstrumentKey,
      ltp,
      change: Number(netChange.toFixed(2)),
      changePercent,
      volume: Number(v.volume || 0),
      open: Number(v.ohlc?.open || v.open || ltp),
      high: Number(v.ohlc?.high || v.high || ltp),
      low: Number(v.ohlc?.low || v.low || ltp),
      close: prevClose,
    });
  }
  // Update paperPositions in-memory on every tick so P&L and P&L% are always live!
  if (paperPositions.length > 0) {
    paperPositions.forEach((pos: any) => {
      const match = list.find(
        (q) => q.instrumentKey === pos.instrumentKey || q.symbol === pos.symbol,
      );
      if (match && match.ltp > 0) {
        if (!(pos.isOption && match.ltp > pos.buyPrice * 50)) {
          pos.currentLTP = match.ltp;
          pos.pnl = Number(((match.ltp - pos.buyPrice) * (pos.quantity || 1)).toFixed(2));
          pos.pnlPercent =
            pos.buyPrice > 0
              ? Number((((match.ltp - pos.buyPrice) / pos.buyPrice) * 100).toFixed(2))
              : 0;
        }
      }
    });
  }
  // Deduplicate list by canonical instrumentKey or symbol to prevent duplicate React keys
  const uniqueMap = new Map<string, any>();
  for (const item of list) {
    const k = item.instrumentKey || item.symbol;
    if (k && !uniqueMap.has(k)) {
      uniqueMap.set(k, item);
    }
  }
  return Array.from(uniqueMap.values());
}
