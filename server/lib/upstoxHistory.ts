import { calculateTradeCharges } from "../../src/utils/indicators";
import {
  consolidateHistoricalSplitFills,
  type ConsolidatedHistoricalLeg,
} from "./history/consolidate";

export interface NormalizedTradeHistoryEntry {
  id: string;
  symbol: string;
  instrumentKey: string;
  productType: "INTRADAY" | "DELIVERY";
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  realizedPnL: number;
  brokerageCharges: number;
  netRealizedPnL: number;
  isOption: boolean;
  openedAt: string;
  openedAtMs: number;
  closeTime: string;
  exitReason?: string;
  mode: "UPSTOX_LIVE";
}

export {
  normalizeEquityBaseSymbol,
  toIstIsoTimestamp,
  getTodayIstDateString,
  getCurrentIndianFinancialYearStart,
} from "./history/timeUtils";
import {
  normalizeEquityBaseSymbol,
  toIstIsoTimestamp,
  getTodayIstDateString,
  getCurrentIndianFinancialYearStart,
  isOptionSymbolOrToken,
  compareTradeIds,
} from "./history/timeUtils";

/**
 * Chronologically pairs today's completed Upstox orders using FIFO per normalized instrument
 * (grouping NSE/BSE or -EQ variants together via ISIN or normalized base symbol).
 */
export function pairLiveDayOrders(completedOrders: any[]): NormalizedTradeHistoryEntry[] {
  if (!Array.isArray(completedOrders) || completedOrders.length === 0) return [];

  const sorted = [...completedOrders]
    .filter((o) => o && String(o.status || "").toLowerCase() === "complete" && Number(o.quantity || 0) > 0)
    .sort((a, b) => {
      const tA = new Date(toIstIsoTimestamp(a.order_timestamp || a.exchange_timestamp)).getTime();
      const tB = new Date(toIstIsoTimestamp(b.order_timestamp || b.exchange_timestamp)).getTime();
      if (tA !== tB) return tA - tB;
      return compareTradeIds(a.order_id, b.order_id);
    });

  const groups = new Map<string, any[]>();
  for (const o of sorted) {
    const sym = String(o.trading_symbol || o.symbol || "").trim();
    const token = String(o.instrument_token || "").trim();
    const isOpt = isOptionSymbolOrToken(sym, token);
    const key = isOpt
      ? token || sym.toUpperCase()
      : o.isin || normalizeEquityBaseSymbol(sym) || token;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }

  const paired: NormalizedTradeHistoryEntry[] = [];

  for (const [, legs] of groups.entries()) {
    const openBuys: Array<{ qty: number; totalQty: number; legCharges: number; price: number; ts: string; order: any }> = [];
    const openSells: Array<{ qty: number; totalQty: number; legCharges: number; price: number; ts: string; order: any }> = [];

    for (const o of legs) {
      const tx = String(o.transaction_type || "").toUpperCase();
      const origQty = Number(o.filled_quantity || o.quantity || 0);
      let remQty = origQty;
      const px = Number(o.average_price || o.price || 0);
      const ts = toIstIsoTimestamp(o.order_timestamp || o.exchange_timestamp);
      if (origQty <= 0 || px <= 0) continue;

      const legSym = String(o.trading_symbol || o.symbol || "").trim();
      const legToken = String(o.instrument_token || "");
      const legIsOpt = isOptionSymbolOrToken(legSym, legToken);
      const legChgBreakdown = calculateTradeCharges(px, origQty, legIsOpt, px, legToken || legSym || String(o.exchange || ""));
      const curLegTotalCharges = tx === "BUY" ? legChgBreakdown.buyCharges : legChgBreakdown.sellCharges;

      if (tx === "BUY") {
        while (remQty > 0 && openSells.length > 0) {
          const s = openSells[0];
          const take = Math.min(remQty, s.qty);
          const sym = String(o.trading_symbol || s.order.trading_symbol || o.symbol || "").trim();
          const token = String(o.instrument_token || s.order.instrument_token || "");
          const isOpt = isOptionSymbolOrToken(sym, token);
          const gross = Number(((s.price - px) * take).toFixed(2));
          const allocChg = Number(
            (curLegTotalCharges * (take / origQty) + s.legCharges * (take / s.totalQty)).toFixed(2),
          );
          const net = Number((gross - allocChg).toFixed(2));
          const closeMs = new Date(ts).getTime();
          paired.push({
            id: `TRD_${s.order.order_id}_${o.order_id}`,
            symbol: normalizeEquityBaseSymbol(sym) === sym.toUpperCase() || isOpt ? sym : normalizeEquityBaseSymbol(sym),
            instrumentKey: token || (isOpt ? `NSE_FO|${sym}` : `NSE_EQ|${sym}`),
            productType: (o.product || s.order.product) === "I" ? "INTRADAY" : "DELIVERY",
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
            exitReason: "Upstox Short Cover (Today)",
            mode: "UPSTOX_LIVE",
          });
          s.qty -= take;
          remQty -= take;
          if (s.qty <= 0) openSells.shift();
        }
        if (remQty > 0) {
          openBuys.push({ qty: remQty, totalQty: origQty, legCharges: curLegTotalCharges, price: px, ts, order: o });
        }
      } else if (tx === "SELL") {
        while (remQty > 0 && openBuys.length > 0) {
          const b = openBuys[0];
          const take = Math.min(remQty, b.qty);
          const sym = String(b.order.trading_symbol || o.trading_symbol || o.symbol || "").trim();
          const token = String(b.order.instrument_token || o.instrument_token || "");
          const isOpt = isOptionSymbolOrToken(sym, token);
          const gross = Number(((px - b.price) * take).toFixed(2));
          const allocChg = Number(
            (b.legCharges * (take / b.totalQty) + curLegTotalCharges * (take / origQty)).toFixed(2),
          );
          const net = Number((gross - allocChg).toFixed(2));
          const closeMs = new Date(ts).getTime();
          paired.push({
            id: `TRD_${b.order.order_id}_${o.order_id}`,
            symbol: normalizeEquityBaseSymbol(sym) === sym.toUpperCase() || isOpt ? sym : normalizeEquityBaseSymbol(sym),
            instrumentKey: token || (isOpt ? `NSE_FO|${sym}` : `NSE_EQ|${sym}`),
            productType: (b.order.product || o.product) === "I" ? "INTRADAY" : "DELIVERY",
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
            exitReason: "Upstox Long Exit (Today)",
            mode: "UPSTOX_LIVE",
          });
          b.qty -= take;
          remQty -= take;
          if (b.qty <= 0) openBuys.shift();
        }
        if (remQty > 0) {
          openSells.push({ qty: remQty, totalQty: origQty, legCharges: curLegTotalCharges, price: px, ts, order: o });
        }
      }
    }
  }

  return paired.sort((a, b) => new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime());
}

export interface OpenFifoLotSummary {
  instrumentKey: string;
  symbol: string;
  product: "I" | "D";
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
    .filter((o) => o && String(o.status || "").toLowerCase() === "complete" && Number(o.filled_quantity || o.quantity || 0) > 0)
    .sort((a, b) => {
      const tA = new Date(toIstIsoTimestamp(a.order_timestamp || a.exchange_timestamp)).getTime();
      const tB = new Date(toIstIsoTimestamp(b.order_timestamp || b.exchange_timestamp)).getTime();
      if (tA !== tB) return tA - tB;
      return compareTradeIds(a.order_id, b.order_id);
    });

  const groups = new Map<string, any[]>();
  for (const o of sorted) {
    const sym = String(o.trading_symbol || o.symbol || "").trim();
    const token = String(o.instrument_token || o.instrumentKey || "").trim();
    const prodRaw = String(o.product || o.productType || "D").toUpperCase();
    const prod: "I" | "D" = prodRaw === "I" || prodRaw === "INTRADAY" ? "I" : "D";
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
    let lastSym = "";
    let lastToken = "";
    let lastProd: "I" | "D" = "D";

    for (const o of legs) {
      const tx = String(o.transaction_type || o.transactionType || o.type || "").toUpperCase();
      let remQty = Number(o.filled_quantity || o.quantity || 0);
      const px = Number(o.average_price || o.price || 0);
      const tsMs = new Date(toIstIsoTimestamp(o.order_timestamp || o.exchange_timestamp || o.time)).getTime() || Date.now();
      if (remQty <= 0 || px <= 0) continue;

      lastSym = String(o.trading_symbol || o.symbol || lastSym).trim();
      lastToken = String(o.instrument_token || o.instrumentKey || lastToken).trim();
      const prodRaw = String(o.product || o.productType || "D").toUpperCase();
      lastProd = prodRaw === "I" || prodRaw === "INTRADAY" ? "I" : "D";
      const tag = String(o.tag || "").toLowerCase();
      const isBot = tag.startsWith("bot_");

      if (tx === "BUY") {
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
      } else if (tx === "SELL") {
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

let cachedLiveOrders: { token: string; fetchedAt: number; orders: any[] } = {
  token: "",
  fetchedAt: 0,
  orders: [],
};

export function invalidateCachedLiveDayOrders() {
  cachedLiveOrders.fetchedAt = 0;
}

export async function getCachedLiveDayOrders(
  token: string,
  maxAgeMs = 2500,
): Promise<any[]> {
  if (!token) return [];
  if (
    cachedLiveOrders.token === token &&
    Date.now() - cachedLiveOrders.fetchedAt < maxAgeMs
  ) {
    return cachedLiveOrders.orders;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://api.upstox.com/v2/order/retrieve-all", {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Api-Version": "2.0",
      },
    });
    clearTimeout(timer);
    if (res.ok) {
      const json: any = await res.json().catch(() => null);
      if (json?.status === "success" && Array.isArray(json?.data)) {
        cachedLiveOrders = {
          token,
          fetchedAt: Date.now(),
          orders: json.data,
        };
        return json.data;
      }
    }
  } catch {
    // Retain last cached day orders on transient network hiccup
  }
  return cachedLiveOrders.token === token ? cachedLiveOrders.orders : [];
}

import { pairHistoricalUpstoxTrades } from "./history/pairHistorical";
export { pairHistoricalUpstoxTrades };

let cachedHistoricalSummary: {
  token: string;
  fetchedAt: number;
  trades: NormalizedTradeHistoryEntry[];
} = { token: "", fetchedAt: 0, trades: [] };

async function fetchPaginatedHistoricalSegment(
  token: string,
  segment: "FO" | "EQ",
  startDate: string,
  endDate: string,
): Promise<any[]> {
  const all: any[] = [];
  const pageSize = 500;
  for (let page = 1; page <= 10; page++) {
    const url = `https://api.upstox.com/v2/charges/historical-trades?segment=${segment}&start_date=${startDate}&end_date=${endDate}&page_number=${page}&page_size=${pageSize}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Api-Version": "2.0",
      },
    });
    if (!res.ok) break;
    const json: any = await res.json().catch(() => null);
    const list = Array.isArray(json?.data) ? json.data : [];
    if (list.length === 0) break;
    all.push(...list);
    if (list.length < pageSize) break;
  }
  return all;
}

export async function getCachedHistoricalUpstoxTrades(
  token: string,
  forceRefresh = false,
): Promise<NormalizedTradeHistoryEntry[]> {
  if (!token) return [];
  const isFresh =
    !forceRefresh &&
    cachedHistoricalSummary.token === token &&
    Date.now() - cachedHistoricalSummary.fetchedAt < 5 * 60 * 1000 &&
    cachedHistoricalSummary.trades.length > 0;
  if (isFresh) {
    return cachedHistoricalSummary.trades;
  }

  const todayIst = getTodayIstDateString();
  const startDate = getCurrentIndianFinancialYearStart(todayIst);

  try {
    const [foTrades, eqTrades] = await Promise.all([
      fetchPaginatedHistoricalSegment(token, "FO", startDate, todayIst).catch(() => []),
      fetchPaginatedHistoricalSegment(token, "EQ", startDate, todayIst).catch(() => []),
    ]);
    const paired = pairHistoricalUpstoxTrades(foTrades, eqTrades, todayIst);
    if (paired.length > 0 || foTrades.length > 0 || eqTrades.length > 0) {
      cachedHistoricalSummary = {
        token,
        fetchedAt: Date.now(),
        trades: paired,
      };
    }
    return cachedHistoricalSummary.trades;
  } catch {
    return cachedHistoricalSummary.token === token ? cachedHistoricalSummary.trades : [];
  }
}
