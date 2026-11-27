import { translations } from '../../translations';
import type { Language } from '../../types';

export type Translations = (typeof translations)[Language];
export type TabKey =
  'WATCHLIST' | 'CHART' | 'BOT' | 'OPTIONS' | 'ORDERS' | 'HOLDINGS' | 'HEATMAP' | 'AI' | 'INVEST';

export interface OrderModalData {
  symbol: string;
  price: number;
  type: import('../../types').OrderTransactionType;
  quantity?: number;
  lotSize?: number;
  heldQuantity?: number;
  productType?: 'INTRADAY' | 'DELIVERY';
  instrumentKey?: string;
}

export interface PlaceOrderInput {
  symbol: string;
  instrumentKey?: string;
  transactionType: import('../../types').OrderTransactionType;
  orderType: import('../../types').OrderType;
  productType: import('../../types').ProductType;
  quantity: number;
  price: number;
  triggerPrice?: number;
  stopLoss?: number;
  target?: number;
}
