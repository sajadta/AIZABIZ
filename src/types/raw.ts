// Wire shapes for payloads that cross the API boundary. These stay permissive
// (every field optional) because the backend and broker return partial rows;
// the mapper functions are responsible for narrowing them into domain types.
import type { ExecutionMode } from './trading';

/** Any row coming back from /api/* before it is normalised. */
export interface RawRow {
  [key: string]: unknown;
}

/** A broker/paper position row prior to normalisation. */
export interface RawPositionRow extends RawRow {
  id?: string;
  positionId?: string;
  orderId?: string;
  symbol?: string;
  instrumentKey?: string;
  productType?: string;
  transactionType?: string;
  type?: string;
  quantity?: number;
  buyPrice?: number;
  avgPrice?: number;
  sellPrice?: number;
  currentLTP?: number;
  lastPrice?: number;
  closePrice?: number;
  pnl?: number;
  realizedPnL?: number;
  netRealizedPnL?: number;
  brokerageCharges?: number;
  stopLoss?: number;
  target?: number;
  isOption?: boolean;
  openedAt?: string;
  openedAtMs?: number;
  closeTime?: string;
  exitReason?: string;
  mode?: ExecutionMode;
}

/** An order row prior to normalisation. */
export interface RawOrderRow extends RawRow {
  id?: string;
  orderId?: string;
  positionId?: string;
  symbol?: string;
  instrumentKey?: string;
  transactionType?: string;
  type?: string;
  orderType?: string;
  productType?: string;
  quantity?: number;
  price?: number;
  executedPrice?: number;
  triggerPrice?: number;
  buyPrice?: number;
  sellPrice?: number;
  realizedPnL?: number;
  brokerageCharges?: number;
  netRealizedPnL?: number;
  status?: string;
  timestamp?: string;
  time?: string;
  mode?: ExecutionMode;
}

/** A holdings row prior to normalisation. */
export interface RawHoldingRow extends RawRow {
  symbol?: string;
  companyName?: string;
  instrumentKey?: string;
  isin?: string;
  quantity?: number;
  buyPrice?: number;
  avgPrice?: number;
  currentLTP?: number;
  closePrice?: number;
  isBuyPriceLocked?: boolean;
  isUpstoxZeroPrice?: boolean;
  investedValue?: number;
  currentValue?: number;
  pnl?: number;
  pnlPercent?: number;
  fiftyPercentTarget?: unknown;
  algoForecast?: unknown;
}

/** Any row carrying an optional execution mode, used by the merge helpers. */
export interface RawModeRow extends RawRow {
  mode?: string;
  id?: string;
}
