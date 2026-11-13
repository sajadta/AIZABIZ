import { translations } from '../../translations';
import type { Language } from '../../types';

export type Translations = (typeof translations)[Language];
export type TabKey = 'POSITIONS' | 'HOLDINGS' | 'ORDERS' | 'TRADE_HISTORY';

export interface AccountSummary {
  totalGrossProfit: number;
  totalGrossLoss: number;
  totalBrokerageCharges: number;
  netPnLAfterCharges: number;
  totalWins: number;
  totalLosses: number;
  allTimeWinRate: number;
  totalTradesCount: number;
  today: {
    todayGrossProfit: number;
    todayGrossLoss: number;
    todayBrokerage: number;
    todayNetPnL: number;
    todayWins: number;
    todayLosses: number;
    todayWinRate: number;
    todayTradesCount: number;
  };
}

export interface TradeDateEntry {
  rawDate: string;
  displayLabel: string;
  count: number;
}

export type ViewChartFn = (symbol: string, instrumentKey?: string, context?: any) => void;
