import React, { useState } from 'react';
import { Order, Position, Holding, Language } from '../types';
import { translations } from '../translations';
import { formatTradeDateTime } from './orderbook/tradeUtils';
import { useOrderBookSummary } from './orderbook/useOrderBookSummary';
import { useNewlyAddedIds } from './orderbook/useNewlyAddedIds';
import { OrderBookHeader } from './orderbook/OrderBookHeader';
import { OrderBookBanners } from './orderbook/OrderBookBanners';
import { PositionsTab } from './orderbook/PositionsTab';
import { HoldingsTab } from './orderbook/HoldingsTab';
import { OrdersTab } from './orderbook/OrdersTab';
import { TradeHistoryTab } from './orderbook/TradeHistoryTab';

export { formatTradeDateTime, getTradeDuration, translateExitReason } from './orderbook/tradeUtils';

interface OrderBookPositionsProps {
  positions: Position[];
  orders: Order[];
  tradeHistory?: Position[];
  holdings?: Holding[];
  language: Language;
  onSquareOffPosition: (id: string) => void;
  onSquareOffAll: () => void;
  onSquareOffEquityOnly?: () => void;
  totalPnL: number;
  initialTab?: 'POSITIONS' | 'HOLDINGS' | 'ORDERS' | 'TRADE_HISTORY';
  onOpenOrderModal?: (
    type: 'BUY' | 'SELL',
    symbol: string,
    price: number,
    options?: {
      quantity?: number;
      heldQuantity?: number;
      productType?: 'INTRADAY' | 'DELIVERY';
      instrumentKey?: string;
    },
  ) => void;
  onRefreshHoldings?: () => void;
  isConnected?: boolean;
  onOpenApiModal?: () => void;
  onViewChart?: (symbol: string, instrumentKey?: string, context?: any) => void;
  onSyncHistoryBrokerage?: () => Promise<void>;
}

export const OrderBookPositions: React.FC<OrderBookPositionsProps> = ({
  positions,
  orders,
  tradeHistory = [],
  holdings = [],
  language,
  onSquareOffPosition,
  onSquareOffAll,
  onSquareOffEquityOnly,
  totalPnL,
  initialTab = 'POSITIONS',
  onOpenOrderModal,
  onRefreshHoldings,
  isConnected = false,
  onOpenApiModal,
  onViewChart,
  onSyncHistoryBrokerage,
}) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'POSITIONS' | 'HOLDINGS' | 'ORDERS' | 'TRADE_HISTORY'>(
    initialTab,
  );
  const [positionFilter, setPositionFilter] = useState<'ALL' | 'OPTIONS' | 'INDEX_EQUITY'>('ALL');

  // Date filter for Trade History (Default: 'ALL' to see all dates, with buttons to pick specific dates like 14 Oct, 15 Oct)
  const [selectedTradeDateFilter, setSelectedTradeDateFilter] = useState<string>('ALL');

  // Orders View Mode: 'PAIRED' (Round-trip Buy & Sell paired together) vs 'INDIVIDUAL' (Raw broker order fills)
  const [ordersViewMode, setOrdersViewMode] = useState<'PAIRED' | 'INDIVIDUAL'>('PAIRED');

  // Holding Buy Price Adjustment & Locking State
  const [editingHoldingSym, setEditingHoldingSym] = useState<string | null>(null);
  const [customBuyPriceInput, setCustomBuyPriceInput] = useState<string>('');
  const [savingBuyPrice, setSavingBuyPrice] = useState<boolean>(false);
  const [buyPriceSaveMessage, setBuyPriceSaveMessage] = useState<string | null>(null);

  const handleSaveCustomBuyPrice = async (symbol: string, isin?: string) => {
    const num = parseFloat(customBuyPriceInput);
    if (isNaN(num) || num <= 0) return;
    setSavingBuyPrice(true);
    try {
      const res = await fetch('/api/market/holdings/set-buy-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, isin, buyPrice: num }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBuyPriceSaveMessage(
          language === 'ml'
            ? `✅ ${symbol} വാങ്ങിയ വില ₹${num.toFixed(2)} ആയി സ്ഥിരപ്പെടുത്തി!`
            : `✅ Successfully locked buy price for ${symbol} at ₹${num.toFixed(2)}!`,
        );
        setEditingHoldingSym(null);
        setCustomBuyPriceInput('');
        if (onRefreshHoldings) onRefreshHoldings();
        setTimeout(() => setBuyPriceSaveMessage(null), 4000);
      }
    } catch (e) {
      console.error('Failed to set buy price', e);
    } finally {
      setSavingBuyPrice(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'HOLDINGS' && onRefreshHoldings) {
      onRefreshHoldings();
    }
  }, [activeTab, onRefreshHoldings]);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Compute available trade dates from trade history for instant filtering
  const availableTradeDates = React.useMemo(() => {
    const datesMap = new Map<string, { rawDate: string; displayLabel: string; count: number }>();
    tradeHistory.forEach((t) => {
      const dt = formatTradeDateTime(t.openedAtMs || t.closeTime || t.openedAt, language);
      if (dt.rawDate) {
        const existing = datesMap.get(dt.rawDate);
        if (existing) {
          existing.count += 1;
        } else {
          datesMap.set(dt.rawDate, {
            rawDate: dt.rawDate,
            displayLabel: dt.dateStr,
            count: 1,
          });
        }
      }
    });
    return Array.from(datesMap.values()).sort((a, b) => b.rawDate.localeCompare(a.rawDate));
  }, [tradeHistory, language]);

  // Filtered trade history based on selected date
  const filteredTradeHistory = React.useMemo(() => {
    if (selectedTradeDateFilter === 'ALL') return tradeHistory;
    return tradeHistory.filter((t) => {
      const dt = formatTradeDateTime(t.openedAtMs || t.closeTime || t.openedAt, language);
      return dt.rawDate === selectedTradeDateFilter;
    });
  }, [tradeHistory, selectedTradeDateFilter, language]);

  const filteredPositions = React.useMemo(() => {
    if (positionFilter === 'OPTIONS') {
      return positions.filter(
        (p) => p.isOption || p.symbol.includes('CE') || p.symbol.includes('PE'),
      );
    }
    if (positionFilter === 'INDEX_EQUITY') {
      return positions.filter(
        (p) => !p.isOption && !p.symbol.includes('CE') && !p.symbol.includes('PE'),
      );
    }
    return positions;
  }, [positions, positionFilter]);

  const newlyAddedIds = useNewlyAddedIds(orders, positions);

  const { accountSummary, holdingsTotals, todayIst } = useOrderBookSummary(
    positions,
    tradeHistory,
    holdings,
  );
  const { totalHoldingsInvested, totalHoldingsValue, totalHoldingsPnL, totalHoldingsPnLPercent } =
    holdingsTotals;

  return (
    <div className="flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden">
      <OrderBookHeader
        t={t}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        positions={positions}
        orders={orders}
        tradeHistory={tradeHistory}
        holdings={holdings}
        language={language}
        onSquareOffAll={onSquareOffAll}
        totalPnL={totalPnL}
      />

      <OrderBookBanners
        positions={positions}
        tradeHistory={tradeHistory}
        totalPnL={totalPnL}
        onSquareOffAll={onSquareOffAll}
        onSquareOffEquityOnly={onSquareOffEquityOnly}
        t={t}
        onViewChart={onViewChart}
        language={language}
      />

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto smooth-scroll p-3 sm:p-4 pb-20 sm:pb-6">
        {activeTab === 'POSITIONS' && (
          <PositionsTab
            positionFilter={positionFilter}
            setPositionFilter={setPositionFilter}
            filteredPositions={filteredPositions}
            newlyAddedIds={newlyAddedIds}
            todayIst={todayIst}
            accountSummary={accountSummary}
            positions={positions}
            language={language}
            onSquareOffPosition={onSquareOffPosition}
            onViewChart={onViewChart}
          />
        )}

        {activeTab === 'HOLDINGS' && (
          <HoldingsTab
            editingHoldingSym={editingHoldingSym}
            setEditingHoldingSym={setEditingHoldingSym}
            customBuyPriceInput={customBuyPriceInput}
            setCustomBuyPriceInput={setCustomBuyPriceInput}
            savingBuyPrice={savingBuyPrice}
            buyPriceSaveMessage={buyPriceSaveMessage}
            handleSaveCustomBuyPrice={handleSaveCustomBuyPrice}
            totalHoldingsInvested={totalHoldingsInvested}
            totalHoldingsValue={totalHoldingsValue}
            totalHoldingsPnL={totalHoldingsPnL}
            totalHoldingsPnLPercent={totalHoldingsPnLPercent}
            holdings={holdings}
            language={language}
            onOpenOrderModal={onOpenOrderModal}
            onRefreshHoldings={onRefreshHoldings}
            isConnected={isConnected}
            onOpenApiModal={onOpenApiModal}
            onViewChart={onViewChart}
          />
        )}

        {activeTab === 'ORDERS' && (
          <OrdersTab
            ordersViewMode={ordersViewMode}
            setOrdersViewMode={setOrdersViewMode}
            newlyAddedIds={newlyAddedIds}
            positions={positions}
            orders={orders}
            tradeHistory={tradeHistory}
            language={language}
            onViewChart={onViewChart}
          />
        )}

        {activeTab === 'TRADE_HISTORY' && (
          <TradeHistoryTab
            selectedTradeDateFilter={selectedTradeDateFilter}
            setSelectedTradeDateFilter={setSelectedTradeDateFilter}
            availableTradeDates={availableTradeDates}
            filteredTradeHistory={filteredTradeHistory}
            accountSummary={accountSummary}
            tradeHistory={tradeHistory}
            language={language}
            onViewChart={onViewChart}
            onSyncHistoryBrokerage={onSyncHistoryBrokerage}
          />
        )}
      </div>
    </div>
  );
};
