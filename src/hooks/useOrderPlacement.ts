import { useCallback } from 'react';
import type {
  ExecutionMode,
  Holding,
  Order,
  OrderTransactionType,
  Position,
  StockQuote,
} from '../types';
import { safeStorage } from '../utils/storage';
import { soundEngine } from '../utils/audioAlerts';

export interface OrderDraft {
  symbol: string;
  instrumentKey?: string;
  transactionType: OrderTransactionType;
  orderType: any;
  productType: any;
  quantity: number;
  price: number;
  triggerPrice?: number;
  stopLoss?: number;
  target?: number;
}

interface UseOrderPlacementParams {
  mode: ExecutionMode;
  accessToken: string;
  quotes: StockQuote[];
  holdings: Holding[];
  positions: Position[];
  soundEnabled: boolean;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>;
  setBotLogs: React.Dispatch<React.SetStateAction<any[]>>;
  setIsOrderModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  squareOffPosition: (positionId: string) => void;
  fetchHoldings: () => void | Promise<void>;
  fetchLivePositions: () => void | Promise<void>;
}

const resolveInstrumentKey = (
  orderData: OrderDraft,
  holdings: Holding[],
  quotes: StockQuote[],
): string => {
  const matchedHolding = holdings.find((h) => h.symbol === orderData.symbol);
  const matchedQuote = quotes.find((q) => q.symbol === orderData.symbol);
  const isOption = /\b(CE|PE)\b/i.test(orderData.symbol);
  return (
    orderData.instrumentKey ||
    (matchedHolding as any)?.instrumentKey ||
    matchedQuote?.instrumentKey ||
    (isOption ? `NSE_FO|${orderData.symbol}` : `NSE_EQ|${orderData.symbol}`)
  );
};

export const useOrderPlacement = ({
  mode,
  accessToken,
  quotes,
  holdings,
  positions,
  soundEnabled,
  setOrders,
  setPositions,
  setBotLogs,
  setIsOrderModalOpen,
  squareOffPosition,
  fetchHoldings,
  fetchLivePositions,
}: UseOrderPlacementParams) => {
  const handlePlaceOrder = useCallback(
    async (orderData: OrderDraft) => {
      const executedPrice = orderData.price;
      if (executedPrice <= 0 && mode === 'PAPER_TRADING') return;

      const resolvedInstrumentKey = resolveInstrumentKey(orderData, holdings, quotes);

      try {
        const orderHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        const activeTok = accessToken || safeStorage.getItem('upstox_daily_token') || '';
        if (activeTok) orderHeaders['Authorization'] = `Bearer ${activeTok}`;

        const res = await fetch('/api/trading/order', {
          method: 'POST',
          headers: orderHeaders,
          body: JSON.stringify({
            mode,
            symbol: orderData.symbol,
            instrumentKey: resolvedInstrumentKey,
            productType: orderData.productType,
            orderType: orderData.orderType,
            initialType: orderData.transactionType,
            quantity: orderData.quantity,
            price: mode === 'UPSTOX_LIVE' && orderData.orderType === 'MARKET' ? 0 : executedPrice,
            triggerPrice: orderData.triggerPrice || 0,
            stopLoss: orderData.stopLoss,
            target: orderData.target,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          setBotLogs((prev) => [
            {
              id: Date.now().toString(),
              timestamp: new Date().toLocaleTimeString(),
              message: `[ORDER ERROR] ${data.error || 'Order rejected'}`,
              type: 'ERROR',
            },
            ...prev.slice(0, 199),
          ]);
          return;
        }
        if (mode === 'UPSTOX_LIVE') {
          fetchHoldings();
        }
        fetchLivePositions();
      } catch {
        if (mode === 'UPSTOX_LIVE') return;
      }

      const newOrder: Order = {
        id: `ord_${Date.now()}`,
        orderId: `UP_${Date.now().toString().slice(-6)}`,
        symbol: orderData.symbol,
        instrumentKey: resolvedInstrumentKey,
        transactionType: orderData.transactionType,
        orderType: orderData.orderType,
        productType: orderData.productType,
        quantity: orderData.quantity,
        price: orderData.price,
        executedPrice,
        status: 'COMPLETE',
        timestamp: new Date().toLocaleTimeString(),
        mode,
      };
      setOrders((prev) => [newOrder, ...prev]);

      if (orderData.transactionType === 'SELL') {
        const existing = positions.find((p) => p.symbol === orderData.symbol);
        if (existing) {
          squareOffPosition(existing.id);
          setIsOrderModalOpen(false);
          return;
        }
      }

      const newPos: Position = {
        id: `pos_${Date.now()}`,
        symbol: orderData.symbol,
        instrumentKey: resolvedInstrumentKey,
        productType: orderData.productType,
        quantity: orderData.quantity,
        buyPrice: executedPrice,
        currentLTP: executedPrice,
        pnl: 0,
        pnlPercent: 0,
        stopLoss: orderData.stopLoss,
        target: orderData.target,
        mode,
        openedAt: new Date().toLocaleTimeString(),
      };
      setPositions((prev) => [newPos, ...prev]);

      if (soundEnabled) {
        soundEngine.play('ORDER_FILLED');
      }
      setIsOrderModalOpen(false);
    },
    [
      mode,
      accessToken,
      quotes,
      holdings,
      positions,
      soundEnabled,
      setOrders,
      setPositions,
      setBotLogs,
      setIsOrderModalOpen,
      squareOffPosition,
      fetchHoldings,
      fetchLivePositions,
    ],
  );

  return { handlePlaceOrder };
};
