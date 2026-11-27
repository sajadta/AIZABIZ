// Pairs FY historical Upstox trades (F&O + equity FIFO) into closed round-trips.
import type { NormalizedTradeHistoryEntry } from '../upstoxHistory';
import { consolidateHistoricalSplitFills, type ConsolidatedHistoricalLeg } from './consolidate';
import {
  toIstIsoTimestamp,
  getTodayIstDateString,
  normalizeEquityBaseSymbol,
  isOptionSymbolOrToken,
  compareTradeIds,
} from './timeUtils';

export function formatHistoricalOptionSymbol(t: any): string {
  const base = String(t.symbol || t.scrip_name || '').trim();
  const strike = t.strike_price ? String(t.strike_price).replace(/\.0+$/, '') : '';
  const opt = String(t.option_type || '').trim();
  if (strike && opt) {
    return `${base} ${strike} ${opt}`;
  }
  return base;
}

/**
 * Chronologically pairs FY historical trades from Upstox `/v2/charges/historical-trades`
 * across both F&O (including expired OTM options settled at ₹0) and Equity FIFO round-trips,
 * consolidating split exchange fills and allocating Upstox per-order charges without double-counting.
 */
export function pairHistoricalUpstoxTrades(
  foTrades: any[],
  eqTrades: any[],
  todayIst = getTodayIstDateString(),
): NormalizedTradeHistoryEntry[] {
  const results: NormalizedTradeHistoryEntry[] = [];

  // 1. F&O Contracts (grouped by symbol + strike + option_type + expiry)
  const foFiltered = [...(foTrades || [])]
    .filter((t) => t && t.trade_date && t.trade_date < todayIst && Number(t.quantity || 0) > 0)
    .sort((a, b) => {
      const d = String(a.trade_date).localeCompare(String(b.trade_date));
      if (d !== 0) return d;
      return compareTradeIds(a.trade_id, b.trade_id);
    });

  const foGroups = new Map<string, any[]>();
  for (const t of foFiltered) {
    const key = [t.symbol, t.strike_price, t.option_type, t.expiry].join('|');
    if (!foGroups.has(key)) foGroups.set(key, []);
    foGroups.get(key)!.push(t);
  }

  for (const [, rawLegs] of foGroups.entries()) {
    const sampleSym = formatHistoricalOptionSymbol(rawLegs[0]);
    const isOpt = isOptionSymbolOrToken(
      sampleSym,
      rawLegs[0].instrument_token,
      rawLegs[0].option_type,
    );
    const legs = consolidateHistoricalSplitFills(rawLegs, isOpt);

    const openBuys: Array<{
      qty: number;
      totalQty: number;
      legCharges: number;
      price: number;
      date: string;
      leg: ConsolidatedHistoricalLeg;
    }> = [];
    const openSells: Array<{
      qty: number;
      totalQty: number;
      legCharges: number;
      price: number;
      date: string;
      leg: ConsolidatedHistoricalLeg;
    }> = [];

    for (const leg of legs) {
      const tx = leg.transaction_type;
      let rem = leg.quantity;
      const px = leg.price;
      const date = leg.trade_date;
      const sym = formatHistoricalOptionSymbol(leg);
      const token = String(
        leg.instrument_token || `${leg.exchange === 'BFO' ? 'BSE_FO' : 'NSE_FO'}|${sym}`,
      );

      if (tx === 'BUY') {
        while (rem > 0 && openSells.length > 0) {
          const s = openSells[0];
          const take = Math.min(rem, s.qty);
          const gross = Number(((s.price - px) * take).toFixed(2));
          const chg = Number(
            (leg.legCharges * (take / leg.quantity) + s.legCharges * (take / s.totalQty)).toFixed(
              2,
            ),
          );
          const net = Number((gross - chg).toFixed(2));
          const openIso = toIstIsoTimestamp(s.date);
          const closeIso = toIstIsoTimestamp(date);
          results.push({
            id: `HIST_FO_${s.leg.trade_id}_${leg.trade_id}_${take}`,
            symbol: sym,
            instrumentKey: token,
            productType: 'INTRADAY',
            quantity: take,
            buyPrice: Number(px.toFixed(2)),
            sellPrice: Number(s.price.toFixed(2)),
            realizedPnL: gross,
            brokerageCharges: chg,
            netRealizedPnL: net,
            isOption: isOpt,
            openedAt: openIso,
            openedAtMs: new Date(openIso).getTime(),
            closeTime: closeIso,
            exitReason: 'Upstox F&O Historical',
            mode: 'UPSTOX_LIVE',
          });
          s.qty -= take;
          rem -= take;
          if (s.qty <= 0) openSells.shift();
        }
        if (rem > 0)
          openBuys.push({
            qty: rem,
            totalQty: leg.quantity,
            legCharges: leg.legCharges,
            price: px,
            date,
            leg,
          });
      } else if (tx === 'SELL') {
        while (rem > 0 && openBuys.length > 0) {
          const b = openBuys[0];
          const take = Math.min(rem, b.qty);
          const gross = Number(((px - b.price) * take).toFixed(2));
          const chg = Number(
            (b.legCharges * (take / b.totalQty) + leg.legCharges * (take / leg.quantity)).toFixed(
              2,
            ),
          );
          const net = Number((gross - chg).toFixed(2));
          const openIso = toIstIsoTimestamp(b.date);
          const closeIso = toIstIsoTimestamp(date);
          results.push({
            id: `HIST_FO_${b.leg.trade_id}_${leg.trade_id}_${take}`,
            symbol: sym,
            instrumentKey: token,
            productType: 'INTRADAY',
            quantity: take,
            buyPrice: Number(b.price.toFixed(2)),
            sellPrice: Number(px.toFixed(2)),
            realizedPnL: gross,
            brokerageCharges: chg,
            netRealizedPnL: net,
            isOption: isOpt,
            openedAt: openIso,
            openedAtMs: new Date(openIso).getTime(),
            closeTime: closeIso,
            exitReason: 'Upstox F&O Historical',
            mode: 'UPSTOX_LIVE',
          });
          b.qty -= take;
          rem -= take;
          if (b.qty <= 0) openBuys.shift();
        }
        if (rem > 0)
          openSells.push({
            qty: rem,
            totalQty: leg.quantity,
            legCharges: leg.legCharges,
            price: px,
            date,
            leg,
          });
      }
    }

    // Expired long options (no sell leg because contract expired worthless OTM)
    for (const b of openBuys) {
      const expiry = String(b.leg.expiry || '');
      if (expiry && expiry < todayIst && b.qty > 0) {
        const sym = formatHistoricalOptionSymbol(b.leg);
        const gross = Number((-b.price * b.qty).toFixed(2));
        const chg = Number((b.legCharges * (b.qty / b.totalQty)).toFixed(2));
        const net = Number((gross - chg).toFixed(2));
        const openIso = toIstIsoTimestamp(b.date);
        const closeIso = toIstIsoTimestamp(expiry);
        results.push({
          id: `HIST_FO_EXP_${b.leg.trade_id}`,
          symbol: sym,
          instrumentKey: String(b.leg.instrument_token || `NSE_FO|${sym}`),
          productType: 'INTRADAY',
          quantity: b.qty,
          buyPrice: Number(b.price.toFixed(2)),
          sellPrice: 0,
          realizedPnL: gross,
          brokerageCharges: chg,
          netRealizedPnL: net,
          isOption: isOpt,
          openedAt: openIso,
          openedAtMs: new Date(openIso).getTime(),
          closeTime: closeIso,
          exitReason: 'Option Expired OTM (₹0)',
          mode: 'UPSTOX_LIVE',
        });
      }
    }
  }

  // 2. Equity FIFO round-trips (grouped by ISIN or base symbol; ignores pre-FY Demat sells without buy leg)
  const eqFiltered = [...(eqTrades || [])]
    .filter((t) => t && t.trade_date && t.trade_date < todayIst && Number(t.quantity || 0) > 0)
    .sort((a, b) => {
      const d = String(a.trade_date).localeCompare(String(b.trade_date));
      if (d !== 0) return d;
      return compareTradeIds(a.trade_id, b.trade_id);
    });

  const eqGroups = new Map<string, any[]>();
  for (const t of eqFiltered) {
    const key = t.isin || normalizeEquityBaseSymbol(t.symbol || t.scrip_name);
    if (!eqGroups.has(key)) eqGroups.set(key, []);
    eqGroups.get(key)!.push(t);
  }

  for (const [, rawLegs] of eqGroups.entries()) {
    const legs = consolidateHistoricalSplitFills(rawLegs, false);
    const openBuys: Array<{
      qty: number;
      totalQty: number;
      legCharges: number;
      price: number;
      date: string;
      leg: ConsolidatedHistoricalLeg;
    }> = [];
    for (const leg of legs) {
      const tx = leg.transaction_type;
      let rem = leg.quantity;
      const px = leg.price;
      const date = leg.trade_date;

      if (tx === 'BUY') {
        openBuys.push({
          qty: rem,
          totalQty: leg.quantity,
          legCharges: leg.legCharges,
          price: px,
          date,
          leg,
        });
      } else if (tx === 'SELL') {
        while (rem > 0 && openBuys.length > 0) {
          const b = openBuys[0];
          const take = Math.min(rem, b.qty);
          const rawSym =
            leg.symbol || b.leg.symbol || leg.scrip_name || b.leg.scrip_name || leg.isin;
          const sym = normalizeEquityBaseSymbol(rawSym);
          const gross = Number(((px - b.price) * take).toFixed(2));
          const chg = Number(
            (b.legCharges * (take / b.totalQty) + leg.legCharges * (take / leg.quantity)).toFixed(
              2,
            ),
          );
          const net = Number((gross - chg).toFixed(2));
          const openIso = toIstIsoTimestamp(b.date);
          const closeIso = toIstIsoTimestamp(date);
          results.push({
            id: `HIST_EQ_${b.leg.trade_id}_${leg.trade_id}_${take}`,
            symbol: sym,
            instrumentKey: String(
              b.leg.instrument_token || leg.instrument_token || `NSE_EQ|${sym}`,
            ),
            productType: b.date === date ? 'INTRADAY' : 'DELIVERY',
            quantity: take,
            buyPrice: Number(b.price.toFixed(2)),
            sellPrice: Number(px.toFixed(2)),
            realizedPnL: gross,
            brokerageCharges: chg,
            netRealizedPnL: net,
            isOption: false,
            openedAt: openIso,
            openedAtMs: new Date(openIso).getTime(),
            closeTime: closeIso,
            exitReason: b.date === date ? 'Upstox Equity Intraday' : 'Upstox Delivery Closed',
            mode: 'UPSTOX_LIVE',
          });
          b.qty -= take;
          rem -= take;
          if (b.qty <= 0) openBuys.shift();
        }
      }
    }
  }

  return results.sort((a, b) => new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime());
}
