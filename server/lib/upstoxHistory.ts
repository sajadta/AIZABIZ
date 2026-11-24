import { calculateTradeCharges } from "../../src/utils/indicators";

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

export function normalizeEquityBaseSymbol(symbol: string): string {
  return String(symbol || "")
    .trim()
    .toUpperCase()
    .replace(/-(EQ|BE|BZ|SM|ST)$/i, "");
}

export function toIstIsoTimestamp(raw?: string): string {
  const s = String(raw || "").trim();
  if (!s) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s}T15:30:00+05:30`;
  }
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(s)) {
    return s.replace(" ", "T") + "+05:30";
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function getTodayIstDateString(nowMs = Date.now()): string {
  return new Date(nowMs).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function getCurrentIndianFinancialYearStart(todayIst: string): string {
  const [yStr, mStr] = todayIst.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const fyStartYear = m >= 4 ? y : y - 1;
  return `${fyStartYear}-04-01`;
}

function isOptionSymbolOrToken(sym: string, token = "", optionType = ""): boolean {
  if (optionType === "CE" || optionType === "PE") return true;
  if (/\b(CE|PE)\b/i.test(sym) || /(CE|PE)$/i.test(sym.trim())) return true;
  if (token.includes("_FO|")) return true;
  return false;
}

function compareTradeIds(aId: unknown, bId: unknown): number {
  const sA = String(aId || "").trim();
  const sB = String(bId || "").trim();
  const nA = Number(sA);
  const nB = Number(sB);
  if (sA !== "" && sB !== "" && Number.isFinite(nA) && Number.isFinite(nB) && nA !== nB) {
    return nA - nB;
  }
  return sA.localeCompare(sB);
}

interface ConsolidatedHistoricalLeg {
  trade_id: string;
  last_trade_id: string;
  trade_date: string;
  transaction_type: string;
  quantity: number;
  price: number;
  totalAmount: number;
  symbol: string;
  scrip_name: string;
  isin: string;
  instrument_token: string;
  strike_price: string;
  option_type: string;
  expiry: string;
  exchange: string;
  segment: string;
  legCharges: number;
}

/**
 * Merges consecutive split exchange fills from the same placed order (identical price
 * or contiguous trade_ids within 250 and <= ₹0.05 price slippage) on the same date & side,
 * then computes one-side Upstox brokerage + taxes once per consolidated order leg.
 */
function consolidateHistoricalSplitFills(legs: any[], isOpt: boolean): ConsolidatedHistoricalLeg[] {
  const consolidated: ConsolidatedHistoricalLeg[] = [];
  for (const r of legs) {
    const qty = Number(r.quantity || 0);
    const px = Number(r.price || (qty > 0 ? Number(r.amount || 0) / qty : 0));
    const amt = Number(r.amount || qty * px);
    if (qty <= 0 || px <= 0) continue;

    const tx = String(r.transaction_type || "").toUpperCase();
    const date = String(r.trade_date || "");
    const tid = String(r.trade_id || "");
    const prev = consolidated[consolidated.length - 1];

    if (prev && prev.trade_date === date && prev.transaction_type === tx) {
      const nCur = Number(tid);
      const nPrev = Number(prev.last_trade_id);
      const idDiff =
        tid !== "" && prev.last_trade_id !== "" && Number.isFinite(nCur) && Number.isFinite(nPrev)
          ? Math.abs(nCur - nPrev)
          : 999999;
      const pxDiff = Math.abs(px - prev.price);

      if (pxDiff <= 0.005 || (pxDiff <= 0.05 && idDiff <= 250)) {
        prev.totalAmount += amt;
        prev.quantity += qty;
        prev.price = prev.totalAmount / prev.quantity;
        prev.last_trade_id = tid;
        continue;
      }
    }

    consolidated.push({
      trade_id: tid,
      last_trade_id: tid,
      trade_date: date,
      transaction_type: tx,
      quantity: qty,
      price: px,
      totalAmount: amt,
      symbol: String(r.symbol || "").trim(),
      scrip_name: String(r.scrip_name || "").trim(),
      isin: String(r.isin || "").trim(),
      instrument_token: String(r.instrument_token || "").trim(),
      strike_price: String(r.strike_price || "").trim(),
      option_type: String(r.option_type || "").trim(),
      expiry: String(r.expiry || "").trim(),
      exchange: String(r.exchange || "").trim(),
      segment: String(r.segment || "").trim(),
      legCharges: 0,
    });
  }

  for (const leg of consolidated) {
    const legCtx = leg.instrument_token || leg.exchange || leg.symbol;
    const breakdown = calculateTradeCharges(leg.price, leg.quantity, isOpt, leg.price, legCtx);
    leg.legCharges = leg.transaction_type === "BUY" ? breakdown.buyCharges : breakdown.sellCharges;
  }

  return consolidated;
}

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

function formatHistoricalOptionSymbol(t: any): string {
  const base = String(t.symbol || t.scrip_name || "").trim();
  const strike = t.strike_price ? String(t.strike_price).replace(/\.0+$/, "") : "";
  const opt = String(t.option_type || "").trim();
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
    const key = [t.symbol, t.strike_price, t.option_type, t.expiry].join("|");
    if (!foGroups.has(key)) foGroups.set(key, []);
    foGroups.get(key)!.push(t);
  }

  for (const [, rawLegs] of foGroups.entries()) {
    const sampleSym = formatHistoricalOptionSymbol(rawLegs[0]);
    const isOpt = isOptionSymbolOrToken(sampleSym, rawLegs[0].instrument_token, rawLegs[0].option_type);
    const legs = consolidateHistoricalSplitFills(rawLegs, isOpt);

    const openBuys: Array<{ qty: number; totalQty: number; legCharges: number; price: number; date: string; leg: ConsolidatedHistoricalLeg }> = [];
    const openSells: Array<{ qty: number; totalQty: number; legCharges: number; price: number; date: string; leg: ConsolidatedHistoricalLeg }> = [];

    for (const leg of legs) {
      const tx = leg.transaction_type;
      let rem = leg.quantity;
      const px = leg.price;
      const date = leg.trade_date;
      const sym = formatHistoricalOptionSymbol(leg);
      const token = String(leg.instrument_token || `${leg.exchange === "BFO" ? "BSE_FO" : "NSE_FO"}|${sym}`);

      if (tx === "BUY") {
        while (rem > 0 && openSells.length > 0) {
          const s = openSells[0];
          const take = Math.min(rem, s.qty);
          const gross = Number(((s.price - px) * take).toFixed(2));
          const chg = Number(
            (leg.legCharges * (take / leg.quantity) + s.legCharges * (take / s.totalQty)).toFixed(2),
          );
          const net = Number((gross - chg).toFixed(2));
          const openIso = toIstIsoTimestamp(s.date);
          const closeIso = toIstIsoTimestamp(date);
          results.push({
            id: `HIST_FO_${s.leg.trade_id}_${leg.trade_id}_${take}`,
            symbol: sym,
            instrumentKey: token,
            productType: "INTRADAY",
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
            exitReason: "Upstox F&O Historical",
            mode: "UPSTOX_LIVE",
          });
          s.qty -= take;
          rem -= take;
          if (s.qty <= 0) openSells.shift();
        }
        if (rem > 0) openBuys.push({ qty: rem, totalQty: leg.quantity, legCharges: leg.legCharges, price: px, date, leg });
      } else if (tx === "SELL") {
        while (rem > 0 && openBuys.length > 0) {
          const b = openBuys[0];
          const take = Math.min(rem, b.qty);
          const gross = Number(((px - b.price) * take).toFixed(2));
          const chg = Number(
            (b.legCharges * (take / b.totalQty) + leg.legCharges * (take / leg.quantity)).toFixed(2),
          );
          const net = Number((gross - chg).toFixed(2));
          const openIso = toIstIsoTimestamp(b.date);
          const closeIso = toIstIsoTimestamp(date);
          results.push({
            id: `HIST_FO_${b.leg.trade_id}_${leg.trade_id}_${take}`,
            symbol: sym,
            instrumentKey: token,
            productType: "INTRADAY",
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
            exitReason: "Upstox F&O Historical",
            mode: "UPSTOX_LIVE",
          });
          b.qty -= take;
          rem -= take;
          if (b.qty <= 0) openBuys.shift();
        }
        if (rem > 0) openSells.push({ qty: rem, totalQty: leg.quantity, legCharges: leg.legCharges, price: px, date, leg });
      }
    }

    // Expired long options (no sell leg because contract expired worthless OTM)
    for (const b of openBuys) {
      const expiry = String(b.leg.expiry || "");
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
          productType: "INTRADAY",
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
          exitReason: "Option Expired OTM (₹0)",
          mode: "UPSTOX_LIVE",
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
    const openBuys: Array<{ qty: number; totalQty: number; legCharges: number; price: number; date: string; leg: ConsolidatedHistoricalLeg }> = [];
    for (const leg of legs) {
      const tx = leg.transaction_type;
      let rem = leg.quantity;
      const px = leg.price;
      const date = leg.trade_date;

      if (tx === "BUY") {
        openBuys.push({ qty: rem, totalQty: leg.quantity, legCharges: leg.legCharges, price: px, date, leg });
      } else if (tx === "SELL") {
        while (rem > 0 && openBuys.length > 0) {
          const b = openBuys[0];
          const take = Math.min(rem, b.qty);
          const rawSym = leg.symbol || b.leg.symbol || leg.scrip_name || b.leg.scrip_name || leg.isin;
          const sym = normalizeEquityBaseSymbol(rawSym);
          const gross = Number(((px - b.price) * take).toFixed(2));
          const chg = Number(
            (b.legCharges * (take / b.totalQty) + leg.legCharges * (take / leg.quantity)).toFixed(2),
          );
          const net = Number((gross - chg).toFixed(2));
          const openIso = toIstIsoTimestamp(b.date);
          const closeIso = toIstIsoTimestamp(date);
          results.push({
            id: `HIST_EQ_${b.leg.trade_id}_${leg.trade_id}_${take}`,
            symbol: sym,
            instrumentKey: String(b.leg.instrument_token || leg.instrument_token || `NSE_EQ|${sym}`),
            productType: b.date === date ? "INTRADAY" : "DELIVERY",
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
            exitReason: b.date === date ? "Upstox Equity Intraday" : "Upstox Delivery Closed",
            mode: "UPSTOX_LIVE",
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
