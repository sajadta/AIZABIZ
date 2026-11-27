// Upstox trade-history facade: live-day pairing, FIFO open lots, order cache and
// FY-to-date historical trades each live in their own module under ./history.
import { calculateTradeCharges } from '../../src/utils/indicators';

export interface NormalizedTradeHistoryEntry {
  id: string;
  symbol: string;
  instrumentKey: string;
  productType: 'INTRADAY' | 'DELIVERY';
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
  mode: 'UPSTOX_LIVE';
}

export {
  normalizeEquityBaseSymbol,
  toIstIsoTimestamp,
  getTodayIstDateString,
  getCurrentIndianFinancialYearStart,
} from './history/timeUtils';

export { pairLiveDayOrders } from './history/liveDayPairing';
export {
  computeOpenFifoPositionsFromOrders,
  type OpenFifoLotSummary,
} from './history/openFifoPositions';
export {
  invalidateCachedLiveDayOrders,
  getCachedLiveDayOrders,
} from './history/liveDayOrdersCache';
export { getCachedHistoricalUpstoxTrades } from './history/historicalTrades';
export { pairHistoricalUpstoxTrades } from './history/pairHistorical';
