import React, { useState } from 'react';
import { Order, Position, Holding, Language } from '../types';
import { translations } from '../translations';
import { calculateTradeCharges } from '../utils/indicators';
import { formatTradeDateTime } from './orderbook/tradeUtils';
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

  // Track newly executed orders and positions for visual feedback
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const prevOrderIdsRef = React.useRef<Set<string>>(new Set(orders.map((o) => o.id)));
  const prevPositionIdsRef = React.useRef<Set<string>>(new Set(positions.map((p) => p.id)));

  React.useEffect(() => {
    const currentOrderIds = new Set(orders.map((o) => o.id));
    const newOrders = orders.filter((o) => !prevOrderIdsRef.current.has(o.id));

    const currentPositionIds = new Set(positions.map((p) => p.id));
    const newPositions = positions.filter((p) => !prevPositionIdsRef.current.has(p.id));

    if (newOrders.length > 0 || newPositions.length > 0) {
      const freshIds = new Set<string>();
      newOrders.forEach((o) => freshIds.add(o.id));
      newPositions.forEach((p) => freshIds.add(p.id));

      setNewlyAddedIds((prev) => new Set([...prev, ...freshIds]));

      const timer = setTimeout(() => {
        setNewlyAddedIds((prev) => {
          const next = new Set(prev);
          freshIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 4000);

      prevOrderIdsRef.current = currentOrderIds;
      prevPositionIdsRef.current = currentPositionIds;

      return () => clearTimeout(timer);
    } else {
      prevOrderIdsRef.current = currentOrderIds;
      prevPositionIdsRef.current = currentPositionIds;
    }
  }, [orders, positions]);

  const totalHoldingsInvested = holdings.reduce(
    (acc, h) => acc + (h.investedValue || h.quantity * (h.buyPrice ?? h.avgPrice ?? 0)),
    0,
  );
  const totalHoldingsValue = holdings.reduce(
    (acc, h) => acc + (h.currentValue || h.quantity * (h.currentLTP || 0)),
    0,
  );
  const totalHoldingsPnL = totalHoldingsValue - totalHoldingsInvested;
  const totalHoldingsPnLPercent =
    totalHoldingsInvested > 0 ? (totalHoldingsPnL / totalHoldingsInvested) * 100 : 0;

  const todayIst = React.useMemo(
    () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    [],
  );

  // Compute combined Summary Stats: Separate Today's Trading Performance and Total Cumulative Performance
  const accountSummary = React.useMemo(() => {
    let totalGrossProfit = 0;
    let totalGrossLoss = 0;
    let totalBrokerageCharges = 0;
    let totalWins = 0;
    let totalLosses = 0;

    let todayGrossProfit = 0;
    let todayGrossLoss = 0;
    let todayBrokerage = 0;
    let todayWins = 0;
    let todayLosses = 0;
    let todayTradesCount = 0;

    // 1. Open positions: track entry-side charges already paid + live open MTM cleanly
    // WITHOUT counting open positions as closed trades or double-counting pos.realizedPnL!
    let openBuyBrokeragePaid = 0;
    let openGrossMtm = 0;
    positions.forEach((p) => {
      const isOpt = Boolean(
        p.isOption ||
        /\b(CE|PE)\b/i.test(p.symbol || '') ||
        String(p.instrumentKey || '').includes('FO'),
      );
      const buyP = Number(p.buyPrice || 0);
      const curP = Number(p.currentLTP || buyP);
      const qty = Math.max(1, Number(p.quantity || 1));
      const pnl = p.pnl !== undefined ? Number(p.pnl) : (curP - buyP) * qty;
      const chg = calculateTradeCharges(buyP, qty, isOpt, curP, p.instrumentKey || p.symbol);
      const entrySideChg = p.type === 'SELL' ? chg.sellCharges : chg.buyCharges;

      openBuyBrokeragePaid += entrySideChg;
      openGrossMtm += pnl;
    });

    // 2. Closed trade history (realized wins, losses, and exact round-trip brokerage)
    tradeHistory.forEach((t) => {
      const isOpt = Boolean(
        t.isOption ||
        /\b(CE|PE)\b/i.test(t.symbol || '') ||
        String(t.instrumentKey || '').includes('FO'),
      );
      const buyP = Number(t.buyPrice || 0);
      const sellP = Number(t.sellPrice || t.currentLTP || buyP);
      const qty = Math.max(1, Number(t.quantity || 1));
      const pnl = t.realizedPnL !== undefined ? Number(t.realizedPnL) : (sellP - buyP) * qty;

      const chg =
        Number((t as any).brokerageCharges) > 0
          ? Number((t as any).brokerageCharges)
          : calculateTradeCharges(buyP, qty, isOpt, sellP, t.instrumentKey || t.symbol).roundTripCharges;
      totalBrokerageCharges += chg;

      if (pnl > 0) {
        totalGrossProfit += pnl;
        totalWins += 1;
      } else if (pnl < 0) {
        totalGrossLoss += Math.abs(pnl);
        totalLosses += 1;
      }

      // Check if trade was opened today in IST
      const tradeDate =
        t.openedAtMs && !isNaN(Number(t.openedAtMs))
          ? new Date(Number(t.openedAtMs)).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
          : t.openedAt && !isNaN(new Date(t.openedAt).getTime())
            ? new Date(t.openedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
            : t.closeTime
              ? new Date(t.closeTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
              : todayIst;

      if (tradeDate === todayIst) {
        todayTradesCount += 1;
        todayBrokerage += chg;
        if (pnl > 0) {
          todayGrossProfit += pnl;
          todayWins += 1;
        } else if (pnl < 0) {
          todayGrossLoss += Math.abs(pnl);
          todayLosses += 1;
        }
      }
    });

    totalBrokerageCharges += openBuyBrokeragePaid;
    todayBrokerage += openBuyBrokeragePaid;
    if (openGrossMtm > 0) {
      totalGrossProfit += openGrossMtm;
      todayGrossProfit += openGrossMtm;
    } else if (openGrossMtm < 0) {
      totalGrossLoss += Math.abs(openGrossMtm);
      todayGrossLoss += Math.abs(openGrossMtm);
    }

    const netPnLAfterCharges = totalGrossProfit - totalGrossLoss - totalBrokerageCharges;
    const todayNetPnL = todayGrossProfit - todayGrossLoss - todayBrokerage;
    const todayWinRate =
      todayTradesCount > 0 ? Math.round((todayWins / todayTradesCount) * 100) : 0;
    const totalTradesCount = tradeHistory.length;
    const allTimeWinRate =
      totalTradesCount > 0 ? Math.round((totalWins / totalTradesCount) * 100) : 0;

    return {
      totalGrossProfit,
      totalGrossLoss,
      totalBrokerageCharges,
      netPnLAfterCharges,
      totalWins,
      totalLosses,
      allTimeWinRate,
      totalTradesCount,
      today: {
        todayGrossProfit,
        todayGrossLoss,
        todayBrokerage,
        todayNetPnL,
        todayWins,
        todayLosses,
        todayWinRate,
        todayTradesCount,
      },
    };
  }, [positions, tradeHistory, todayIst]);

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
