import { useState } from 'react';
import type {
  CandleData,
  GeminiMarketAnalysis,
  Holding,
  OptionChainData,
  Order,
  Position,
  StockQuote,
  TradingSignal,
  UpstoxApiConfig,
} from '../types';
import { INITIAL_WATCHLIST_SYMBOLS } from '../data/initialWatchlist';
import { safeStorage } from '../utils/storage';
import { usePersistedCollections } from './usePersistedCollections';

const DEFAULT_API_CONFIG: UpstoxApiConfig = {
  apiKey: '',
  apiSecret: '',
  redirectUri: '',
  accessToken: '',
  isConnected: false,
  userName: '',
  userEmail: '',
  userClientCode: '',
  broker: 'Live Market Feed Active',
  availableMargin: 0,
  usedMargin: 0,
  utilizedMargin: 0,
  payin: 0,
  payout: 0,
  totalBalance: 0,
};

const loadPersisted = <T>(legacyKey: string, key: string): T[] => {
  safeStorage.removeItem(legacyKey);
  const parsed = safeStorage.getJson<T[]>(key);
  return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
};

/** Market, position and broker data owned by the trading session. */
export function useTradingState() {
  const [quotes, setQuotes] = useState<StockQuote[]>(INITIAL_WATCHLIST_SYMBOLS);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [activeSignal, setActiveSignal] = useState<TradingSignal | null>(null);

  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>(() =>
    loadPersisted<Order>('aizabiz_persisted_orders_v2', 'aizabiz_persisted_orders_v3'),
  );
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Position[]>(() =>
    loadPersisted<Position>(
      'aizabiz_persisted_trade_history_v2',
      'aizabiz_persisted_trade_history_v3',
    ),
  );

  usePersistedCollections(orders, tradeHistory);

  const [optionChainData, setOptionChainData] = useState<OptionChainData | null>(null);
  const [optionChainLoading, setOptionChainLoading] = useState(false);
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiMarketAnalysis | null>(null);
  const [apiConfig, setApiConfig] = useState<UpstoxApiConfig>(DEFAULT_API_CONFIG);

  return {
    quotes,
    setQuotes,
    candles,
    setCandles,
    activeSignal,
    setActiveSignal,
    positions,
    setPositions,
    orders,
    setOrders,
    holdings,
    setHoldings,
    tradeHistory,
    setTradeHistory,
    optionChainData,
    setOptionChainData,
    optionChainLoading,
    setOptionChainLoading,
    geminiAnalysis,
    setGeminiAnalysis,
    apiConfig,
    setApiConfig,
  };
}
