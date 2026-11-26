import { computeOpenFifoPositionsFromOrders, type OpenFifoLotSummary } from './upstoxHistory';

import { isDeliverySoldHoldingPosition, isOptionInstrument } from './portfolioGuards';

export { isDeliverySoldHoldingPosition, isOptionInstrument } from './portfolioGuards';
export { computeEffectiveHoldingQuantity } from './holdingQuantity';

export interface NormalizedLivePosition {
  id: string;
  symbol: string;
  instrumentKey: string;
  product: string;
  productType: 'INTRADAY' | 'DELIVERY';
  type: 'BUY' | 'SELL';
  quantity: number;
  buyPrice: number;
  sellPrice?: number;
  currentLTP: number;
  pnl: number;
  pnlPercent: number;
  realizedPnL: number;
  mode: 'UPSTOX_LIVE';
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

  const symbol = String(rawPos.trading_symbol || rawPos.instrument_token || 'UNKNOWN');
  const instrumentKey = String(rawPos.instrument_token || rawPos.trading_symbol || '');
  const isOpt = isOptionInstrument(symbol, instrumentKey);
  const prodCode = String(rawPos.product || 'D').toUpperCase();
  const productType: 'INTRADAY' | 'DELIVERY' = prodCode === 'I' ? 'INTRADAY' : 'DELIVERY';
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
    computedPnl = isShort ? (entryPrice - currentLTP) * absQty : (currentLTP - entryPrice) * absQty;
  } else if (
    rawBrokerPnl !== undefined &&
    rawBrokerPnl !== null &&
    Number.isFinite(Number(rawBrokerPnl))
  ) {
    computedPnl = Number(rawBrokerPnl);
  } else if (entryPrice > 0) {
    computedPnl = isShort ? (entryPrice - currentLTP) * absQty : (currentLTP - entryPrice) * absQty;
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
    type: isShort ? 'SELL' : 'BUY',
    quantity: absQty,
    buyPrice: entryPrice,
    ...(isShort && sellAvg > 0 ? { sellPrice: sellAvg } : {}),
    currentLTP,
    pnl: Number(computedPnl.toFixed(2)),
    pnlPercent,
    realizedPnL: Number(rawPos.realised ?? 0),
    mode: 'UPSTOX_LIVE',
    isOption: isOpt,
    isBotManaged: Boolean(openLotCost?.isBotManaged),
    isBtstHoldRecommended: false,
    openedAt: resolvedOpenedMs
      ? new Date(resolvedOpenedMs).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
      : new Date().toLocaleTimeString('en-IN'),
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
  const prod: 'I' | 'D' = String(rawPos.product || 'D').toUpperCase() === 'I' ? 'I' : 'D';
  const token = String(rawPos.instrument_token || rawPos.instrumentKey || '').trim();
  const sym = String(rawPos.trading_symbol || rawPos.symbol || '')
    .trim()
    .toUpperCase();
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
      const token = String(item?.instrument_token || item?.trading_symbol || '');
      const prod = String(item?.product || 'D').toUpperCase() === 'I' ? 'I' : 'D';
      const tracker = trackerMap?.[`${token}|${prod}`] || (token ? trackerMap?.[token] : undefined);
      const lotCost = findOpenFifoLotForRawPosition(item, openLots);
      return normalizeUpstoxShortTermPosition(item, tracker, lotCost);
    })
    .filter((item): item is NormalizedLivePosition => item !== null);
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

  if (String(tradeMode || '').toUpperCase() === 'OPTIONS_ONLY') {
    return false;
  }
  if (isDeliverySoldHoldingPosition(pos)) {
    return false;
  }
  if (Number(pos.buyPrice || 0) <= 0 || Number(pos.quantity || 0) <= 0) {
    return false;
  }
  if (pos.mode === 'UPSTOX_LIVE' && pos.productType === 'DELIVERY' && !pos.isBotManaged) {
    return false;
  }
  return true;
}
