import React from 'react';
import { AdvancedAnalytics } from '../../AdvancedAnalytics';
import { CumulativePnLChart } from '../../CumulativePnLChart';
import { OrderBookPositions } from '../../OrderBookPositions';
import { PerformanceOverviewCard } from '../../PerformanceOverviewCard';
import type { Holding, Language, Order, Position, UpstoxApiConfig } from '../../../types';
import type { OrderModalData } from '../types';

interface OrdersTabProps {
  language: Language;
  setOrderModalData: (v: OrderModalData) => void;
  setIsOrderModalOpen: (v: boolean) => void;
  handleViewChart: (sym: string, key?: string, context?: any) => void;
  handleSquareOffPosition: (id: string) => Promise<void>;
  handleSquareOffAll: () => void;
  onSquareOffEquityOnly?: () => void;
  positions: Position[];
  holdings: Holding[];
  totalNetMtm: number;
  fetchHoldings: () => Promise<void>;
  apiConfig: UpstoxApiConfig;
  setIsApiModalOpen: (v: boolean) => void;
  handleSyncHistoryBrokerage: () => Promise<void>;
  modeOrders: Order[];
  modeTradeHistory: Position[];
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  language,
  setOrderModalData,
  setIsOrderModalOpen,
  handleViewChart,
  handleSquareOffPosition,
  handleSquareOffAll,
  onSquareOffEquityOnly,
  positions,
  holdings,
  totalNetMtm,
  fetchHoldings,
  apiConfig,
  setIsApiModalOpen,
  handleSyncHistoryBrokerage,
  modeOrders,
  modeTradeHistory,
}) => (
  <div className="h-full w-full max-w-full min-w-0 overflow-y-auto smooth-scroll space-y-4 pb-28 lg:pb-4">
    {/* Performance Overview: Total Realized + Open MTM PnL, Win/Loss Ratio, Avg Trade Duration */}
    <PerformanceOverviewCard
      tradeHistory={modeTradeHistory}
      activePositions={positions}
      language={language}
    />

    <OrderBookPositions
      positions={positions}
      orders={modeOrders}
      tradeHistory={modeTradeHistory}
      holdings={holdings}
      language={language}
      onSquareOffPosition={handleSquareOffPosition}
      onSquareOffAll={handleSquareOffAll}
      onSquareOffEquityOnly={onSquareOffEquityOnly}
      totalPnL={totalNetMtm}
      onRefreshHoldings={fetchHoldings}
      isConnected={apiConfig.isConnected}
      onOpenApiModal={() => setIsApiModalOpen(true)}
      onViewChart={handleViewChart}
      onSyncHistoryBrokerage={handleSyncHistoryBrokerage}
      onOpenOrderModal={(type, sym, prc, opts) => {
        setOrderModalData({ symbol: sym, price: prc, type, ...opts });
        setIsOrderModalOpen(true);
      }}
    />

    {/* Visual Performance Overview: Daily Cumulative PnL Line Chart */}
    <CumulativePnLChart tradeHistory={modeTradeHistory} language={language} />

    <div className="mt-4">
      <AdvancedAnalytics history={modeTradeHistory as any} />
    </div>
  </div>
);
