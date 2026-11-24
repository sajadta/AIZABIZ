import { computeOpenFifoPositionsFromOrders, type OpenFifoLotSummary } from "./upstoxHistory";

export function isOptionInstrument(symbol?: string, instrumentToken?: string): boolean {
  const sym = String(symbol || "");
  const tok = String(instrumentToken || "");
  return /\b(CE|PE)\b/i.test(sym) || sym.includes("CE") || sym.includes("PE") || tok.includes("FO");
}

/**
 * In Indian cash equity (NSE/BSE), short-selling on DELIVERY ("D") is impossible.
 * Upstox returns an entry in /v2/portfolio/short-term-positions with product === "D"
 * and negative net quantity (e.g. TRIDENT qty: -39, buy_price: 0) strictly to represent
 * "Holding sold today" from the user's Demat holdings.
 * Treating it as an active short trade causes phantom -₹900+ MTM loss, fake SL alerts,
 * and dangerous buy-back attempts on square-off.
 */
export function isDeliverySoldHoldingPosition(rawPos: any): boolean {
  if (!rawPos) return false;
  const sym = String(rawPos.trading_symbol || rawPos.symbol || "");
  const tok = String(rawPos.instrument_token || rawPos.instrumentKey || "");
  if (isOptionInstrument(sym, tok)) return false;

  const prodRaw = String(rawPos.product || rawPos.productType || "D").toUpperCase();
  const isDelivery = prodRaw === "D" || prodRaw === "DELIVERY" || prodRaw === "CNC";
  if (!isDelivery) return false;

  // For raw Upstox positions, net qty is negative.
  if (rawPos.quantity !== undefined || rawPos.net_quantity !== undefined) {
    const netQty = Number(rawPos.quantity ?? rawPos.net_quantity ?? 0);
    if (netQty < 0) return true;
  }

  // For already-mapped app Position objects: productType === "DELIVERY" & type === "SELL".
  if (String(rawPos.type || "").toUpperCase() === "SELL" && isDelivery) {
    return true;
  }

  return false;
}

export interface NormalizedLivePosition {
  id: string;
  symbol: string;
  instrumentKey: string;
  product: string;
  productType: "INTRADAY" | "DELIVERY";
  type: "BUY" | "SELL";
  quantity: number;
  buyPrice: number;
  sellPrice?: number;
  currentLTP: number;
  pnl: number;
  pnlPercent: number;
  realizedPnL: number;
  mode: "UPSTOX_LIVE";
  isOption: boolean;
  isBotManaged: boolean;
  isBtstHoldRecommended: boolean;
  openedAt: string;
  openedAtMs?: number;
  highestLTP?: number;
  highestPnl?: number;
  highestNetPnl?: number;
  lockedStopLossPrice?: number;
  brokerageCharges?: number;
  brokerageSource?: string;
}

export function normalizeUpstoxShortTermPosition(
  rawPos: any,
  tracker?: {
    openedAtMs?: number;
    highestLTP?: number;
    highestPnl?: number;
    highestNetPnl?: number;
    lockedStopLossPrice?: number;
    brokerageCharges?: number;
    brokerageSource?: string;
  },
  openLotCost?: OpenFifoLotSummary | null,
): NormalizedLivePosition | null {
  if (!rawPos) return null;

  const netQty = Number(rawPos.quantity ?? rawPos.net_quantity ?? 0);
  if (!Number.isFinite(netQty) || netQty === 0) return null;

  if (isDeliverySoldHoldingPosition(rawPos)) {
    return null;
  }

  const symbol = String(rawPos.trading_symbol || rawPos.instrument_token || "UNKNOWN");
  const instrumentKey = String(rawPos.instrument_token || rawPos.trading_symbol || "");
  const isOpt = isOptionInstrument(symbol, instrumentKey);
  const prodCode = String(rawPos.product || "D").toUpperCase();
  const productType: "INTRADAY" | "DELIVERY" = prodCode === "I" ? "INTRADAY" : "DELIVERY";
  const isShort = netQty < 0;
  const absQty = Math.abs(netQty);

  let buyAvg = Number(
    rawPos.day_buy_price ||
      rawPos.buy_price ||
      rawPos.average_price ||
      (rawPos.day_buy_value && rawPos.day_buy_quantity
        ? rawPos.day_buy_value / rawPos.day_buy_quantity
        : 0) ||
      (rawPos.buy_value && rawPos.buy_quantity ? rawPos.buy_value / rawPos.buy_quantity : 0) ||
      0,
  );
  let sellAvg = Number(
    rawPos.day_sell_price ||
      rawPos.sell_price ||
      (rawPos.day_sell_value && rawPos.day_sell_quantity
        ? rawPos.day_sell_value / rawPos.day_sell_quantity
        : 0) ||
      (rawPos.sell_value && rawPos.sell_quantity ? rawPos.sell_value / rawPos.sell_quantity : 0) ||
      rawPos.average_price ||
      0,
  );

  const overnightQty = Number(rawPos.overnight_quantity || 0);
  let hasExactOpenFifoCost = false;
  if (openLotCost && overnightQty === 0) {
    if (!isShort && openLotCost.netOpenQty > 0 && openLotCost.openAvgBuyPrice > 0) {
      buyAvg = openLotCost.openAvgBuyPrice;
      hasExactOpenFifoCost = true;
    } else if (isShort && openLotCost.netOpenQty < 0 && openLotCost.openAvgSellPrice > 0) {
      sellAvg = openLotCost.openAvgSellPrice;
      hasExactOpenFifoCost = true;
    }
  }

  // For short trades (Intraday / Option Selling), the entry price is sellAvg.
  const entryPrice = Number((isShort ? sellAvg : buyAvg).toFixed(4));
  const currentLTP = Number(rawPos.last_price || entryPrice || 0);

  const rawBrokerPnl = rawPos.pnl ?? rawPos.m2m;
  let computedPnl: number;
  if (hasExactOpenFifoCost && entryPrice > 0) {
    // Open position Unrealized P&L calculated purely from exact open FIFO lot cost
    // (realizedPnL from prior closed round-trips on the same strike is preserved separately).
    computedPnl = isShort
      ? (entryPrice - currentLTP) * absQty
      : (currentLTP - entryPrice) * absQty;
  } else if (rawBrokerPnl !== undefined && rawBrokerPnl !== null && Number.isFinite(Number(rawBrokerPnl))) {
    computedPnl = Number(rawBrokerPnl);
  } else if (entryPrice > 0) {
    computedPnl = isShort
      ? (entryPrice - currentLTP) * absQty
      : (currentLTP - entryPrice) * absQty;
  } else {
    computedPnl = Number(rawPos.unrealised ?? rawPos.realised ?? 0);
  }

  const pnlPercent =
    entryPrice > 0 && absQty > 0
      ? Number(((computedPnl / (entryPrice * absQty)) * 100).toFixed(2))
      : 0;

  const resolvedOpenedMs =
    tracker?.openedAtMs ||
    (openLotCost ? openLotCost.latestOpenMs || openLotCost.oldestOpenMs : undefined);

  return {
    id: symbol,
    symbol,
    instrumentKey,
    product: prodCode,
    productType,
    type: isShort ? "SELL" : "BUY",
    quantity: absQty,
    buyPrice: entryPrice,
    ...(isShort && sellAvg > 0 ? { sellPrice: sellAvg } : {}),
    currentLTP,
    pnl: Number(computedPnl.toFixed(2)),
    pnlPercent,
    realizedPnL: Number(rawPos.realised ?? 0),
    mode: "UPSTOX_LIVE",
    isOption: isOpt,
    isBotManaged: Boolean(openLotCost?.isBotManaged),
    isBtstHoldRecommended: false,
    openedAt: resolvedOpenedMs
      ? new Date(resolvedOpenedMs).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })
      : new Date().toLocaleTimeString("en-IN"),
    ...(resolvedOpenedMs ? { openedAtMs: resolvedOpenedMs } : {}),
    ...(tracker
      ? {
          openedAtMs: resolvedOpenedMs ?? tracker.openedAtMs,
          highestLTP: tracker.highestLTP,
          highestPnl: tracker.highestPnl,
          highestNetPnl: tracker.highestNetPnl,
          lockedStopLossPrice: tracker.lockedStopLossPrice,
          brokerageCharges: tracker.brokerageCharges,
          brokerageSource: tracker.brokerageSource,
        }
      : {}),
  };
}

export function normalizeUpstoxShortTermPositionsList(rawList: any[]): NormalizedLivePosition[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map((item) => normalizeUpstoxShortTermPosition(item))
    .filter((item): item is NormalizedLivePosition => item !== null);
}

export function findOpenFifoLotForRawPosition(
  rawPos: any,
  openLotsByKey: Record<string, OpenFifoLotSummary>,
): OpenFifoLotSummary | null {
  if (!rawPos || !openLotsByKey) return null;
  const prod: "I" | "D" = String(rawPos.product || "D").toUpperCase() === "I" ? "I" : "D";
  const token = String(rawPos.instrument_token || rawPos.instrumentKey || "").trim();
  const sym = String(rawPos.trading_symbol || rawPos.symbol || "").trim().toUpperCase();
  return (
    (token ? openLotsByKey[`${token}|${prod}`] : undefined) ||
    (sym ? openLotsByKey[`${sym}|${prod}`] : undefined) ||
    null
  );
}

export function normalizeUpstoxShortTermPositionsWithOrders(
  rawList: any[],
  dayOrders?: any[],
  trackerMap?: Record<string, any>,
): NormalizedLivePosition[] {
  if (!Array.isArray(rawList)) return [];
  const openLots =
    Array.isArray(dayOrders) && dayOrders.length > 0
      ? computeOpenFifoPositionsFromOrders(dayOrders)
      : {};
  return rawList
    .map((item) => {
      const token = String(item?.instrument_token || item?.trading_symbol || "");
      const prod = String(item?.product || "D").toUpperCase() === "I" ? "I" : "D";
      const tracker =
        trackerMap?.[`${token}|${prod}`] ||
        (token ? trackerMap?.[token] : undefined);
      const lotCost = findOpenFifoLotForRawPosition(item, openLots);
      return normalizeUpstoxShortTermPosition(item, tracker, lotCost);
    })
    .filter((item): item is NormalizedLivePosition => item !== null);
}

/**
 * Matches Upstox Holdings UI quantity calculation:
 * When holdings have been sold today (cnc_used_quantity > 0), subtract sold units
 * from settled quantity so sold holdings show actual remaining shares (e.g. 0 or 14)
 * rather than double-counting t1_quantity + already-sold holdings.
 */
export function computeEffectiveHoldingQuantity(rawHolding: any): {
  remainingQty: number;
  soldTodayQty: number;
  rawTotalQty: number;
} {
  const baseQty = Math.max(0, Number(rawHolding?.quantity || 0));
  const cncUsedQty = Math.max(0, Number(rawHolding?.cnc_used_quantity || 0));
  const t1Qty = Math.max(0, Number(rawHolding?.t1_quantity || 0));
  const colQty = Math.max(0, Number(rawHolding?.collateral_quantity || 0));

  const remainingQty =
    cncUsedQty > 0
      ? Math.max(0, baseQty - cncUsedQty)
      : baseQty + t1Qty > 0
        ? baseQty + t1Qty
        : colQty;

  return {
    remainingQty,
    soldTodayQty: cncUsedQty,
    rawTotalQty: baseQty + t1Qty,
  };
}

/**
 * Equity position monitor must NEVER auto-trade/exit equity positions when:
 * 1. Bot is in OPTIONS_ONLY mode (user explicitly excluded Equity from algo).
 * 2. Position is a Delivery sold holding or invalid/zero-entry-price position.
 * 3. Live manual Delivery positions (productType === "DELIVERY" in UPSTOX_LIVE without isBotManaged).
 */
export function shouldMonitorEquityPosition(pos: any, tradeMode?: string): boolean {
  if (!pos) return false;
  const isOpt = isOptionInstrument(pos.symbol, pos.instrumentKey) || Boolean(pos.isOption);
  if (isOpt) return false;

  if (String(tradeMode || "").toUpperCase() === "OPTIONS_ONLY") {
    return false;
  }
  if (isDeliverySoldHoldingPosition(pos)) {
    return false;
  }
  if (Number(pos.buyPrice || 0) <= 0 || Number(pos.quantity || 0) <= 0) {
    return false;
  }
  if (pos.mode === "UPSTOX_LIVE" && pos.productType === "DELIVERY" && !pos.isBotManaged) {
    return false;
  }
  return true;
}
