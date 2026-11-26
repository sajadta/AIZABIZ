import React from 'react';
import { OrderBookPositions } from '../../OrderBookPositions';
import type {
  ChartTradeContext,
  Holding,
  Language,
  Order,
  Position,
  UpstoxApiConfig,
} from '../../../types';
import type { OrderModalData } from '../types';

interface HoldingsTabProps {
  language: Language;
  setOrderModalData: (v: OrderModalData) => void;
  setIsOrderModalOpen: (v: boolean) => void;
  handleViewChart: (sym: string, key?: string, context?: ChartTradeContext) => void;
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

export const HoldingsTab: React.FC<HoldingsTabProps> = ({
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
      initialTab="HOLDINGS"
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
  </div>
);
