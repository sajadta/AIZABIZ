import { calculateTradeCharges } from '../../../src/utils/indicators';
import {
  normalizeEquityBaseSymbol,
  toIstIsoTimestamp,
  isOptionSymbolOrToken,
  compareTradeIds,
} from './timeUtils';
import type { NormalizedTradeHistoryEntry } from '../upstoxHistory';

/**
 * Chronologically pairs today's completed Upstox orders using FIFO per normalized instrument
 * (grouping NSE/BSE or -EQ variants together via ISIN or normalized base symbol).
 */
export function pairLiveDayOrders(completedOrders: any[]): NormalizedTradeHistoryEntry[] {
  if (!Array.isArray(completedOrders) || completedOrders.length === 0) return [];

  const sorted = [...completedOrders]
    .filter(
      (o) =>
        o && String(o.status || '').toLowerCase() === 'complete' && Number(o.quantity || 0) > 0,
    )
    .sort((a, b) => {
      const tA = new Date(toIstIsoTimestamp(a.order_timestamp || a.exchange_timestamp)).getTime();
      const tB = new Date(toIstIsoTimestamp(b.order_timestamp || b.exchange_timestamp)).getTime();
      if (tA !== tB) return tA - tB;
      return compareTradeIds(a.order_id, b.order_id);
    });

  const groups = new Map<string, any[]>();
  for (const o of sorted) {
    const sym = String(o.trading_symbol || o.symbol || '').trim();
    const token = String(o.instrument_token || '').trim();
    const isOpt = isOptionSymbolOrToken(sym, token);
    const key = isOpt
      ? token || sym.toUpperCase()
      : o.isin || normalizeEquityBaseSymbol(sym) || token;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }

  const paired: NormalizedTradeHistoryEntry[] = [];

  for (const [, legs] of groups.entries()) {
    const openBuys: Array<{
      qty: number;
      totalQty: number;
      legCharges: number;
      price: number;
      ts: string;
      order: any;
    }> = [];
    const openSells: Array<{
      qty: number;
      totalQty: number;
      legCharges: number;
      price: number;
      ts: string;
      order: any;
    }> = [];

    for (const o of legs) {
      const tx = String(o.transaction_type || '').toUpperCase();
      const origQty = Number(o.filled_quantity || o.quantity || 0);
      let remQty = origQty;
      const px = Number(o.average_price || o.price || 0);
      const ts = toIstIsoTimestamp(o.order_timestamp || o.exchange_timestamp);
      if (origQty <= 0 || px <= 0) continue;

      const legSym = String(o.trading_symbol || o.symbol || '').trim();
      const legToken = String(o.instrument_token || '');
      const legIsOpt = isOptionSymbolOrToken(legSym, legToken);
      const legChgBreakdown = calculateTradeCharges(
        px,
        origQty,
        legIsOpt,
        px,
        legToken || legSym || String(o.exchange || ''),
      );
      const curLegTotalCharges =
        tx === 'BUY' ? legChgBreakdown.buyCharges : legChgBreakdown.sellCharges;

      if (tx === 'BUY') {
        while (remQty > 0 && openSells.length > 0) {
          const s = openSells[0];
          const take = Math.min(remQty, s.qty);
          const sym = String(o.trading_symbol || s.order.trading_symbol || o.symbol || '').trim();
          const token = String(o.instrument_token || s.order.instrument_token || '');
          const isOpt = isOptionSymbolOrToken(sym, token);
          const gross = Number(((s.price - px) * take).toFixed(2));
          const allocChg = Number(
            (curLegTotalCharges * (take / origQty) + s.legCharges * (take / s.totalQty)).toFixed(2),
          );
          const net = Number((gross - allocChg).toFixed(2));
          const closeMs = new Date(ts).getTime();
          paired.push({
            id: `TRD_${s.order.order_id}_${o.order_id}`,
            symbol:
              normalizeEquityBaseSymbol(sym) === sym.toUpperCase() || isOpt
                ? sym
                : normalizeEquityBaseSymbol(sym),
            instrumentKey: token || (isOpt ? `NSE_FO|${sym}` : `NSE_EQ|${sym}`),
            productType: (o.product || s.order.product) === 'I' ? 'INTRADAY' : 'DELIVERY',
            quantity: take,
            buyPrice: px,
            sellPrice: s.price,
            realizedPnL: gross,
            brokerageCharges: allocChg,
            netRealizedPnL: net,
            isOption: isOpt,
            openedAt: s.ts,
            openedAtMs: new Date(s.ts).getTime() || closeMs,
            closeTime: ts,
            exitReason: 'Upstox Short Cover (Today)',
            mode: 'UPSTOX_LIVE',
          });
          s.qty -= take;
          remQty -= take;
          if (s.qty <= 0) openSells.shift();
        }
        if (remQty > 0) {
          openBuys.push({
            qty: remQty,
            totalQty: origQty,
            legCharges: curLegTotalCharges,
            price: px,
            ts,
            order: o,
          });
        }
      } else if (tx === 'SELL') {
        while (remQty > 0 && openBuys.length > 0) {
          const b = openBuys[0];
          const take = Math.min(remQty, b.qty);
          const sym = String(b.order.trading_symbol || o.trading_symbol || o.symbol || '').trim();
          const token = String(b.order.instrument_token || o.instrument_token || '');
          const isOpt = isOptionSymbolOrToken(sym, token);
          const gross = Number(((px - b.price) * take).toFixed(2));
          const allocChg = Number(
            (b.legCharges * (take / b.totalQty) + curLegTotalCharges * (take / origQty)).toFixed(2),
          );
          const net = Number((gross - allocChg).toFixed(2));
          const closeMs = new Date(ts).getTime();
          paired.push({
            id: `TRD_${b.order.order_id}_${o.order_id}`,
            symbol:
              normalizeEquityBaseSymbol(sym) === sym.toUpperCase() || isOpt
                ? sym
                : normalizeEquityBaseSymbol(sym),
            instrumentKey: token || (isOpt ? `NSE_FO|${sym}` : `NSE_EQ|${sym}`),
            productType: (b.order.product || o.product) === 'I' ? 'INTRADAY' : 'DELIVERY',
            quantity: take,
            buyPrice: b.price,
            sellPrice: px,
            realizedPnL: gross,
            brokerageCharges: allocChg,
            netRealizedPnL: net,
            isOption: isOpt,
            openedAt: b.ts,
            openedAtMs: new Date(b.ts).getTime() || closeMs,
            closeTime: ts,
            exitReason: 'Upstox Long Exit (Today)',
            mode: 'UPSTOX_LIVE',
          });
          b.qty -= take;
          remQty -= take;
          if (b.qty <= 0) openBuys.shift();
        }
        if (remQty > 0) {
          openSells.push({
            qty: remQty,
            totalQty: origQty,
            legCharges: curLegTotalCharges,
            price: px,
            ts,
            order: o,
          });
        }
      }
    }
  }

  return paired.sort((a, b) => new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime());
}
