import type { Holding, Order, Position } from '../types';
import type { RawHoldingRow, RawModeRow, RawOrderRow, RawPositionRow } from '../types/raw';

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const str = (v: unknown, fallback = ''): string =>
  v === undefined || v === null ? fallback : String(v);

/** Normalizes a raw /api/market/holdings row into the UI Holding shape. */
export const mapHoldingRow = (h: RawHoldingRow): Holding => {
  const quantity = num(h.quantity);
  const buyPrice = num(h.buyPrice ?? h.avgPrice);
  const currentLTP = num(h.currentLTP);
  return {
    symbol: str(h.symbol),
    companyName: str(h.companyName) || str(h.symbol),
    instrumentKey: h.instrumentKey,
    isin: h.isin,
    quantity,
    avgPrice: buyPrice,
    buyPrice,
    currentLTP,
    closePrice: h.closePrice,
    isBuyPriceLocked: h.isBuyPriceLocked,
    isUpstoxZeroPrice: h.isUpstoxZeroPrice,
    investedValue: num(h.investedValue) || quantity * buyPrice,
    currentValue: num(h.currentValue) || quantity * currentLTP,
    pnl: num(h.pnl) || (currentLTP - buyPrice) * quantity,
    pnlPercent:
      num(h.pnlPercent) || (buyPrice > 0 ? ((currentLTP - buyPrice) / buyPrice) * 100 : 0),
    fiftyPercentTarget: h.fiftyPercentTarget as Holding['fiftyPercentTarget'],
    algoForecast: h.algoForecast as Holding['algoForecast'],
  };
};

/** Normalizes a paper-trading position row, recomputing derived PnL fields. */
export const mapPaperPosition = (p: RawPositionRow): Position => {
  const buyPrice = num(p.buyPrice);
  const currentLTP = num(p.currentLTP);
  return {
    ...(p as unknown as Position),
    mode: 'PAPER_TRADING',
    productType: (p.productType as Position['productType']) || 'INTRADAY',
    pnl: Number(num(p.pnl).toFixed(2)),
    pnlPercent: buyPrice > 0 ? Number((((currentLTP - buyPrice) / buyPrice) * 100).toFixed(2)) : 0,
    openedAt: str(p.openedAt) || new Date().toLocaleTimeString(),
  };
};

/** Normalizes a paper-trading order row into the UI Order shape. */
export const mapPaperOrder = (o: RawOrderRow): Order => ({
  id: str(o.id || o.orderId),
  orderId: str(o.orderId || o.id),
  positionId: o.positionId,
  symbol: str(o.symbol),
  instrumentKey: str(o.instrumentKey) || `NSE_FO|${str(o.symbol)}`,
  transactionType: (o.transactionType || o.type || 'BUY') as Order['transactionType'],
  orderType: (o.orderType || 'MARKET') as Order['orderType'],
  productType: (o.productType || 'INTRADAY') as Order['productType'],
  quantity: num(o.quantity),
  price: num(o.price),
  executedPrice: o.executedPrice ?? o.price,
  buyPrice: o.buyPrice,
  sellPrice: o.sellPrice,
  realizedPnL: o.realizedPnL,
  brokerageCharges: o.brokerageCharges,
  netRealizedPnL: o.netRealizedPnL,
  status: (o.status || 'COMPLETE') as Order['status'],
  timestamp: str(o.timestamp) || new Date(str(o.time) || Date.now()).toLocaleTimeString(),
  mode: 'PAPER_TRADING',
});

const tradeCloseMs = (t: RawModeRow): number =>
  new Date(str(t.closeTime) || str(t.openedAt) || 0).getTime();

/** Maps paper trade history rows and sorts them newest-first. */
export const mapPaperHistory = (rows: RawPositionRow[]): Position[] =>
  rows
    .map((t) => ({ ...(t as unknown as Position), mode: 'PAPER_TRADING' as const }))
    .sort((a, b) => tradeCloseMs(b as RawModeRow) - tradeCloseMs(a as RawModeRow));

/** Drops empty live positions and non-option delivery sells from the Upstox book. */
export const filterLivePositions = (rows: RawPositionRow[]): Position[] =>
  rows.filter(
    (p) =>
      p &&
      num(p.quantity) > 0 &&
      !(
        p.productType === 'DELIVERY' &&
        p.type === 'SELL' &&
        !p.isOption &&
        !str(p.symbol).includes('CE') &&
        !str(p.symbol).includes('PE')
      ),
  ) as unknown as Position[];

/** Merges live broker rows on top of locally known rows, newest-first when sorting is requested. */
export const mergeLiveRows = <T extends { mode?: string }>(
  prev: T[],
  liveRows: RawPositionRow[],
  sortByTime = true,
): T[] => {
  const nonLive = prev.filter((r) => (r.mode || 'PAPER_TRADING') !== 'UPSTOX_LIVE');
  if (liveRows.length === 0 && nonLive.length === prev.length) return prev;
  const liveMapped = liveRows.map((r) => ({
    ...(r as unknown as T),
    mode: 'UPSTOX_LIVE' as const,
  }));
  const merged = [...liveMapped, ...nonLive] as T[];
  return sortByTime
    ? merged.sort((a, b) => tradeCloseMs(b as RawModeRow) - tradeCloseMs(a as RawModeRow))
    : merged;
};

/** True when the incoming list is identical in size and boundary ids to the current one. */
export const isSameList = <T extends { id?: string }>(
  prev: T[],
  next: T[],
  extraKey?: keyof T,
): boolean => {
  if (prev.length !== next.length) return false;
  if (prev.length === 0) return false;
  if (prev[0]?.id !== next[0]?.id) return false;
  if (extraKey) return prev[0]?.[extraKey] === next[0]?.[extraKey];
  return prev[prev.length - 1]?.id === next[next.length - 1]?.id;
};
