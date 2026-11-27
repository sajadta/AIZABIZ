import {
  normalizeEquityBaseSymbol,
  toIstIsoTimestamp,
  isOptionSymbolOrToken,
  compareTradeIds,
} from './timeUtils';

export interface OpenFifoLotSummary {
  instrumentKey: string;
  symbol: string;
  product: 'I' | 'D';
  netOpenQty: number;
  openAvgBuyPrice: number;
  openAvgSellPrice: number;
  oldestOpenMs: number;
  latestOpenMs: number;
  isBotManaged: boolean;
}

/**
 * Reconstructs exact open-lot FIFO cost basis and entry timestamps from today's
 * completed Upstox orders per `(instrument, product)` key so re-entering the same
 * strike intraday does not inherit Upstox's cumulative day average buy_price.
 */
export function computeOpenFifoPositionsFromOrders(
  completedOrders: any[],
): Record<string, OpenFifoLotSummary> {
  const result: Record<string, OpenFifoLotSummary> = {};
  if (!Array.isArray(completedOrders) || completedOrders.length === 0) return result;

  const sorted = [...completedOrders]
    .filter(
      (o) =>
        o &&
        String(o.status || '').toLowerCase() === 'complete' &&
        Number(o.filled_quantity || o.quantity || 0) > 0,
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
    const token = String(o.instrument_token || o.instrumentKey || '').trim();
    const prodRaw = String(o.product || o.productType || 'D').toUpperCase();
    const prod: 'I' | 'D' = prodRaw === 'I' || prodRaw === 'INTRADAY' ? 'I' : 'D';
    const isOpt = isOptionSymbolOrToken(sym, token);
    const baseKey = isOpt
      ? token || sym.toUpperCase()
      : token || o.isin || normalizeEquityBaseSymbol(sym);
    const groupKey = `${baseKey}|${prod}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push(o);
  }

  for (const [, legs] of groups.entries()) {
    const openBuys: Array<{ qty: number; price: number; tsMs: number; isBot: boolean }> = [];
    const openSells: Array<{ qty: number; price: number; tsMs: number; isBot: boolean }> = [];
    let lastSym = '';
    let lastToken = '';
    let lastProd: 'I' | 'D' = 'D';

    for (const o of legs) {
      const tx = String(o.transaction_type || o.transactionType || o.type || '').toUpperCase();
      let remQty = Number(o.filled_quantity || o.quantity || 0);
      const px = Number(o.average_price || o.price || 0);
      const tsMs =
        new Date(
          toIstIsoTimestamp(o.order_timestamp || o.exchange_timestamp || o.time),
        ).getTime() || Date.now();
      if (remQty <= 0 || px <= 0) continue;

      lastSym = String(o.trading_symbol || o.symbol || lastSym).trim();
      lastToken = String(o.instrument_token || o.instrumentKey || lastToken).trim();
      const prodRaw = String(o.product || o.productType || 'D').toUpperCase();
      lastProd = prodRaw === 'I' || prodRaw === 'INTRADAY' ? 'I' : 'D';
      const tag = String(o.tag || '').toLowerCase();
      const isBot = tag.startsWith('bot_');

      if (tx === 'BUY') {
        while (remQty > 0 && openSells.length > 0) {
          const s = openSells[0];
          const take = Math.min(remQty, s.qty);
          s.qty -= take;
          remQty -= take;
          if (s.qty <= 0) openSells.shift();
        }
        if (remQty > 0) {
          openBuys.push({ qty: remQty, price: px, tsMs, isBot });
        }
      } else if (tx === 'SELL') {
        while (remQty > 0 && openBuys.length > 0) {
          const b = openBuys[0];
          const take = Math.min(remQty, b.qty);
          b.qty -= take;
          remQty -= take;
          if (b.qty <= 0) openBuys.shift();
        }
        if (remQty > 0) {
          openSells.push({ qty: remQty, price: px, tsMs, isBot });
        }
      }
    }

    const totalBuyQty = openBuys.reduce((s, b) => s + b.qty, 0);
    const totalSellQty = openSells.reduce((s, x) => s + x.qty, 0);
    const netOpenQty = totalBuyQty - totalSellQty;
    if (netOpenQty === 0) continue;

    const openAvgBuyPrice =
      totalBuyQty > 0
        ? Number((openBuys.reduce((s, b) => s + b.qty * b.price, 0) / totalBuyQty).toFixed(4))
        : 0;
    const openAvgSellPrice =
      totalSellQty > 0
        ? Number((openSells.reduce((s, x) => s + x.qty * x.price, 0) / totalSellQty).toFixed(4))
        : 0;
    const activeLots = netOpenQty > 0 ? openBuys : openSells;
    const oldestOpenMs = activeLots.reduce((m, l) => Math.min(m, l.tsMs), activeLots[0].tsMs);
    const latestOpenMs = activeLots.reduce((m, l) => Math.max(m, l.tsMs), activeLots[0].tsMs);
    const isBotManaged = activeLots.some((l) => l.isBot);

    const summary: OpenFifoLotSummary = {
      instrumentKey: lastToken,
      symbol: lastSym,
      product: lastProd,
      netOpenQty,
      openAvgBuyPrice,
      openAvgSellPrice,
      oldestOpenMs,
      latestOpenMs,
      isBotManaged,
    };

    if (lastToken) {
      result[`${lastToken}|${lastProd}`] = summary;
    }
    if (lastSym) {
      result[`${lastSym.toUpperCase()}|${lastProd}`] = summary;
    }
  }

  return result;
}
