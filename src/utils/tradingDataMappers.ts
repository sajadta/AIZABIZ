import type { Holding, Order, Position } from '../types';

/** Normalizes a raw /api/market/holdings row into the UI Holding shape. */
export const mapHoldingRow = (h: any): Holding => ({
  symbol: h.symbol,
  companyName: h.companyName || h.symbol,
  instrumentKey: h.instrumentKey,
  isin: h.isin,
  quantity: h.quantity,
  avgPrice: h.buyPrice ?? h.avgPrice,
  buyPrice: h.buyPrice ?? h.avgPrice,
  currentLTP: h.currentLTP,
  closePrice: h.closePrice,
  isBuyPriceLocked: h.isBuyPriceLocked,
  isUpstoxZeroPrice: h.isUpstoxZeroPrice,
  investedValue: h.investedValue || (h.quantity || 0) * (h.buyPrice || 0),
  currentValue: h.currentValue || (h.quantity || 0) * (h.currentLTP || 0),
  pnl: h.pnl || (h.currentLTP - (h.buyPrice || h.avgPrice)) * h.quantity,
  pnlPercent:
    h.pnlPercent || (h.buyPrice > 0 ? ((h.currentLTP - h.buyPrice) / h.buyPrice) * 100 : 0),
  fiftyPercentTarget: h.fiftyPercentTarget,
  algoForecast: h.algoForecast,
});

/** Normalizes a paper-trading position row, recomputing derived PnL fields. */
export const mapPaperPosition = (p: any): Position => ({
  ...p,
  mode: 'PAPER_TRADING',
  productType: p.productType || 'INTRADAY',
  pnl: Number((p.pnl || 0).toFixed(2)),
  pnlPercent:
    p.buyPrice > 0 ? Number((((p.currentLTP - p.buyPrice) / p.buyPrice) * 100).toFixed(2)) : 0,
  openedAt: p.openedAt || new Date().toLocaleTimeString(),
});

/** Normalizes a paper-trading order row into the UI Order shape. */
export const mapPaperOrder = (o: any): Order => ({
  id: o.id || o.orderId,
  orderId: o.orderId || o.id,
  positionId: o.positionId,
  symbol: o.symbol,
  instrumentKey: o.instrumentKey || `NSE_FO|${o.symbol}`,
  transactionType: o.transactionType || o.type || 'BUY',
  orderType: o.orderType || 'MARKET',
  productType: o.productType || 'INTRADAY',
  quantity: o.quantity,
  price: o.price,
  executedPrice: o.executedPrice || o.price,
  buyPrice: o.buyPrice,
  sellPrice: o.sellPrice,
  realizedPnL: o.realizedPnL,
  brokerageCharges: o.brokerageCharges,
  netRealizedPnL: o.netRealizedPnL,
  status: o.status || 'COMPLETE',
  timestamp: o.timestamp || new Date(o.time || Date.now()).toLocaleTimeString(),
  mode: 'PAPER_TRADING',
});

const tradeCloseMs = (t: any): number => new Date(t.closeTime || t.openedAt || 0).getTime();

/** Maps paper trade history rows and sorts them newest-first. */
export const mapPaperHistory = (rows: any[]): Position[] =>
  rows
    .map((t: any) => ({ ...t, mode: 'PAPER_TRADING' as const }))
    .sort((a: any, b: any) => tradeCloseMs(b) - tradeCloseMs(a));

/** Drops empty live positions and non-option delivery sells from the Upstox book. */
export const filterLivePositions = (rows: any[]): Position[] =>
  rows.filter(
    (p: any) =>
      p &&
      Number(p.quantity || 0) > 0 &&
      !(
        p.productType === 'DELIVERY' &&
        p.type === 'SELL' &&
        !p.isOption &&
        !String(p.symbol || '').includes('CE') &&
        !String(p.symbol || '').includes('PE')
      ),
  );

/** Merges live broker rows on top of locally known rows, newest-first when sorting is requested. */
export const mergeLiveRows = <T extends { mode?: string }>(
  prev: T[],
  liveRows: any[],
  sortByTime = true,
): T[] => {
  const nonLive = prev.filter((r) => (r.mode || 'PAPER_TRADING') !== 'UPSTOX_LIVE');
  if (liveRows.length === 0 && nonLive.length === prev.length) return prev;
  const liveMapped = liveRows.map((r: any) => ({ ...r, mode: 'UPSTOX_LIVE' as const }));
  const merged = [...liveMapped, ...nonLive];
  return sortByTime ? merged.sort((a: any, b: any) => tradeCloseMs(b) - tradeCloseMs(a)) : merged;
};

/** True when the incoming list is identical in size and boundary ids to the current one. */
export const isSameList = (prev: any[], next: any[], extraKey?: string): boolean => {
  if (prev.length !== next.length) return false;
  if (prev.length === 0) return false;
  if (prev[0]?.id !== next[0]?.id) return false;
  if (extraKey) return prev[0]?.[extraKey] === next[0]?.[extraKey];
  return prev[prev.length - 1]?.id === next[next.length - 1]?.id;
};
