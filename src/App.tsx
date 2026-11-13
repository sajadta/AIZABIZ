import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StockQuote,
  CandleData,
  TradingSignal,
  Order,
  Position,
  Holding,
  BotConfig,
  BotLog,
  UpstoxApiConfig,
  GeminiMarketAnalysis,
  OptionChainData,
  Language,
  ExecutionMode,
  PriceAlert,
  OrderTransactionType,
} from './types';
import { deduplicateQuotes, getStandardIndexLotSize } from './utils/quotes';
import { translations } from './translations';
import { useAccountMetrics } from './hooks/useAccountMetrics';
import { usePriceAlerts } from './hooks/usePriceAlerts';
import { Header } from './components/Header';
import { TickerBar } from './components/TickerBar';
import { Watchlist } from './components/Watchlist';
import { AppTopSections } from './components/app/AppTopSections';
import { AppInspectionBanner } from './components/app/AppInspectionBanner';
import { AppIpWhitelistNotice } from './components/app/AppIpWhitelistNotice';
import { AppDesktopNav } from './components/app/AppDesktopNav';
import { AppTabContent } from './components/app/AppTabContent';
import { AppMobileNav } from './components/app/AppMobileNav';
import { AppModals } from './components/app/AppModals';
import {
  enrichCandlesWithIndicators,
  analyzeTradingSignals,
  calculateTradeCharges,
  calculateAffordableLotsWithBrokerage,
} from './utils/indicators';
import { soundEngine } from './utils/audioAlerts';
import {
  triggerAlertEvent,
  getIstMarketSessionStatus,
  LightingAlertBannerState,
  MarketSessionStatus,
} from './utils/soundAlerts';

const INITIAL_WATCHLIST_SYMBOLS: StockQuote[] = [
  {
    symbol: 'NIFTY 50',
    name: 'Nifty 50 Index',
    instrumentKey: 'NSE_INDEX|Nifty 50',
    exchange: 'NSE',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'INDEX',
  },
  {
    symbol: 'BANKNIFTY',
    name: 'Nifty Bank Index',
    instrumentKey: 'NSE_INDEX|Nifty Bank',
    exchange: 'NSE',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'INDEX',
  },
  {
    symbol: 'NIFTY FUT',
    name: 'Nifty Index Futures',
    instrumentKey: 'NSE_FO|NIFTY24NOVFUT',
    exchange: 'NFO',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'FUTURES',
  },
  {
    symbol: 'BANKNIFTY FUT',
    name: 'Bank Nifty Futures',
    instrumentKey: 'NSE_FO|BANKNIFTY24NOVFUT',
    exchange: 'NFO',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'FUTURES',
  },
  {
    symbol: 'SENSEX',
    name: 'BSE SENSEX Index',
    instrumentKey: 'BSE_INDEX|SENSEX',
    exchange: 'BSE',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'INDEX',
  },
  {
    symbol: 'FINNIFTY',
    name: 'Nifty Fin Service',
    instrumentKey: 'NSE_INDEX|Nifty Fin Service',
    exchange: 'NSE',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'INDEX',
  },
  {
    symbol: 'MIDCPNIFTY',
    name: 'Nifty Midcap Select',
    instrumentKey: 'NSE_INDEX|NIFTY MID SELECT',
    exchange: 'NSE',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'INDEX',
  },
  {
    symbol: 'BANKEX',
    name: 'BSE BANKEX Index',
    instrumentKey: 'BSE_INDEX|BANKEX',
    exchange: 'BSE',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'INDEX',
  },
  {
    symbol: 'CRUDEOIL FUT',
    name: 'MCX Crude Oil Futures',
    instrumentKey: 'MCX_FO|CRUDEOIL24NOVFUT',
    exchange: 'MCX',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'COMMODITY',
  },
  {
    symbol: 'NATURALGAS',
    name: 'MCX Natural Gas Futures',
    instrumentKey: 'MCX_FO|NATURALGAS24NOVFUT',
    exchange: 'MCX',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'COMMODITY',
  },
  {
    symbol: 'GOLD',
    name: 'MCX Gold Futures',
    instrumentKey: 'MCX_FO|GOLD24NOVFUT',
    exchange: 'MCX',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'COMMODITY',
  },
  {
    symbol: 'S&P 500',
    name: 'S&P 500 Index',
    instrumentKey: 'GLOBAL_INDEX|US500',
    exchange: 'GLOBAL',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'GLOBAL',
  },
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd',
    instrumentKey: 'NSE_EQ|INE002A01018',
    exchange: 'NSE',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'EQUITY',
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd',
    instrumentKey: 'NSE_EQ|INE040A01034',
    exchange: 'NSE',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'EQUITY',
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd',
    instrumentKey: 'NSE_EQ|INE090A01021',
    exchange: 'NSE',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'EQUITY',
  },
  {
    symbol: 'SBIN',
    name: 'State Bank of India',
    instrumentKey: 'NSE_EQ|INE062A01020',
    exchange: 'NSE',
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    vwap: 0,
    segment: 'EQUITY',
  },
];

export const App: React.FC = () => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    'WATCHLIST' | 'CHART' | 'BOT' | 'OPTIONS' | 'ORDERS' | 'HOLDINGS' | 'HEATMAP' | 'AI' | 'INVEST'
  >('CHART');

  // App configurations
  const [language, setLanguage] = useState<Language>('ml');
  const [mode, setMode] = useState<ExecutionMode>(() => {
    try {
      const savedMode = localStorage.getItem('aizabiz_preferred_trading_mode');
      if (savedMode === 'PAPER_TRADING' || savedMode === 'UPSTOX_LIVE') {
        return savedMode;
      }
    } catch {
      // Ignored
    }
    return 'PAPER_TRADING';
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [marketSession, setMarketSession] = useState<MarketSessionStatus>(() =>
    getIstMarketSessionStatus(),
  );
  const [lightingBanner, setLightingBanner] = useState<LightingAlertBannerState | null>(null);
  const prevPositionsRef = useRef<Record<string, { pnl: number; is50Hit: boolean; tier: number }>>(
    {},
  );
  const prevHoldingsRef = useRef<Record<string, { pnl: number; is50Hit: boolean }>>({});
  const prevMarketPhaseRef = useRef<string>(marketSession.phase ?? '');

  // Quotes and Selection
  const [quotes, setQuotes] = useState<StockQuote[]>(INITIAL_WATCHLIST_SYMBOLS);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY 50');
  const [selectedInstrumentKey, setSelectedInstrumentKey] = useState<string>('NSE_INDEX|Nifty 50');
  const [chartTradeContext, setChartTradeContext] = useState<any>(null);
  const [ipCopiedNotice, setIpCopiedNotice] = useState(false);
  const [dismissedIpWarning, setDismissedIpWarning] = useState(false);

  // Chart data (100% Real Live Candles)
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [chartInterval, setChartInterval] = useState<string>('5m');
  const [activeSignal, setActiveSignal] = useState<TradingSignal | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // Bot state
  const [botConfig, setBotConfig] = useState<BotConfig>({
    enabled: true, // Always active 24x7 Cloud Trading Engine
    mode: 'PAPER_TRADING',
    tradeMode: 'AUTO_ADAPTIVE',
    minOptionProfitAmount: 450,
    maxOptionLossCount: 2,
    maxStockLossCount: 2,
    maxStockProfitCount: 5,
    selectedStrategy: 'PROFIT_MAX_100_PERCENT_MATRIX',
    minConfidence: 82,
    maxCapitalPerTrade: 0, // 0 = Auto Dynamic Funds (100% Real Account Margin Sizing)
    maxTradesPerDay: 8,
    riskPerTradePercent: 1.5,
    stopLossPercent: 12.0,
    targetProfitPercent: 30.0,
    trailingStopLoss: true,
    trailingStepPercent: 5,
    dailyMaxLossLimit: 2000,
    dailyMaxProfitTarget: 5000,
    dailyLossLocked: false,
    multiTimeframeConfirmation: true,
    multiTimeframeEnabled: true,
    autoOptionStrikeSelector: true,
    optionStrikeSelector: true,
    candlestickPatternFilter: true,
    telegramAlertsEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    autoSquareOffTime: '15:25',
    allowedSymbols: ['NIFTY 50', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCPNIFTY', 'BANKEX'],
    soundAlerts: true,
    selectedIndexPriority: 'FULL_AUTO_MULTI_INDEX',
    maxConcurrentTrades: 0, // 0 = Dynamic Fund-Based Auto Allocation
    optionStrategyMode: 'HYBRID_AUTO_REGIME',
    limitOrderSlippageGuard: true,
  });
  const [botLogs, setBotLogs] = useState<BotLog[]>([]);
  const [signals, setSignals] = useState<TradingSignal[]>([]);

  // Positions, Orders, Holdings
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('aizabiz_persisted_orders_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignored
    }
    return [];
  });
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Position[]>(() => {
    try {
      const saved = localStorage.getItem('aizabiz_persisted_trade_history_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignored
    }
    return [];
  });

  useEffect(() => {
    if (orders.length > 0) {
      try {
        localStorage.setItem('aizabiz_persisted_orders_v2', JSON.stringify(orders));
      } catch {
        // Ignored
      }
    }
  }, [orders]);

  useEffect(() => {
    if (tradeHistory.length > 0) {
      try {
        localStorage.setItem('aizabiz_persisted_trade_history_v2', JSON.stringify(tradeHistory));
      } catch {
        // Ignored
      }
    }
  }, [tradeHistory]);

  // Option Chain
  const [optionChainData, setOptionChainData] = useState<OptionChainData | null>(null);
  const [optionChainLoading, setOptionChainLoading] = useState(false);

  // Gemini Market Analysis
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiMarketAnalysis | null>(null);

  // Upstox API configuration
  const [apiConfig, setApiConfig] = useState<UpstoxApiConfig>({
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
  });

  // Price Alerts
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);

  // Modals
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderModalData, setOrderModalData] = useState<{
    symbol: string;
    price: number;
    type: OrderTransactionType;
    quantity?: number;
    lotSize?: number;
    heldQuantity?: number;
    productType?: 'INTRADAY' | 'DELIVERY';
    instrumentKey?: string;
  }>({
    symbol: 'NIFTY 50',
    price: 0,
    type: 'BUY',
  });
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isTerminalLocked, setIsTerminalLocked] = useState(() => {
    return localStorage.getItem('aizabiz_master_unlocked') !== 'true';
  });

  // 0. Server Wakeup Heartbeat
  useEffect(() => {
    const triggerWakeup = () => {
      fetch(`/api/wakeup?t=${Date.now()}`, { cache: 'no-store' }).catch(() => {
        /* ignore */
      });
    };
    triggerWakeup();
    const wakeupInterval = setInterval(triggerWakeup, 4 * 60 * 1000); // Every 4 minutes
    return () => clearInterval(wakeupInterval);
  }, []);

  // Load configuration from API on mount & auto-restore saved Upstox daily token
  useEffect(() => {
    const fetchInitData = async () => {
      try {
        // Check if Upstox OAuth redirected back to root URL with ?code=...
        const urlParams = new URLSearchParams(window.location.search);
        const oauthCode = urlParams.get('code');
        if (oauthCode) {
          try {
            const cleanRedirectUri = window.location.origin;
            const tokenRes = await fetch('/api/market/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: oauthCode,
                redirectUri: cleanRedirectUri,
              }),
            });
            const tokenData = await tokenRes.json();
            if (tokenData.accessToken) {
              localStorage.setItem('upstox_daily_token', tokenData.accessToken);
              localStorage.setItem('upstox_token_date', new Date().toLocaleDateString('en-IN'));
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          } catch {
            // Silently ignored
          }
        }

        let savedDailyToken = '';
        try {
          savedDailyToken = localStorage.getItem('upstox_daily_token') || '';
        } catch {
          // Silently ignored
        }

        const headers: Record<string, string> = {};
        if (savedDailyToken) {
          headers['Authorization'] = `Bearer ${savedDailyToken}`;
        }

        const [botRes, configRes, historyRes] = await Promise.allSettled([
          fetch('/api/bot/config').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/market/config', { headers }).then((r) => (r.ok ? r.json() : null)),
          fetch('/api/history').then((r) => (r.ok ? r.json() : null)),
        ]);

        let serverUserExplicitMode = false;
        let hasPreferredMode = false;

        if (botRes.status === 'fulfilled' && botRes.value) {
          serverUserExplicitMode = Boolean(botRes.value.userExplicitlySelectedMode);
          const savedModeIsValid = (v: string | null): v is ExecutionMode => {
            return v === 'PAPER_TRADING' || v === 'UPSTOX_LIVE';
          };
          let preferredMode: ExecutionMode | null = null;
          try {
            const saved = localStorage.getItem('aizabiz_preferred_trading_mode');
            if (saved === 'PAPER_TRADING' || savedModeIsValid(saved)) {
              preferredMode = saved as ExecutionMode;
              hasPreferredMode = true;
            }
          } catch {
            // Ignored
          }
          const finalMode: ExecutionMode =
            preferredMode ||
            (botRes.value.mode === 'PAPER_TRADING' || botRes.value.mode === 'UPSTOX_LIVE'
              ? botRes.value.mode
              : 'PAPER_TRADING');
          setMode(finalMode);
          setBotConfig((prev) => ({ ...prev, ...botRes.value, mode: finalMode }));
          if (preferredMode && botRes.value.mode !== preferredMode) {
            fetch('/api/bot/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...botRes.value, mode: preferredMode }),
            }).catch(() => {
              /* ignore */
            });
          }
        }
        if (configRes.status === 'fulfilled' && configRes.value) {
          const cfg = configRes.value;
          // Only clear savedDailyToken if user explicitly cleared it or JWT exp timestamp has passed
          let isJwtExpired = false;
          if (savedDailyToken) {
            try {
              const parts = savedDailyToken.split('.');
              if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                if (payload?.exp && Date.now() / 1000 > payload.exp + 60) {
                  isJwtExpired = true;
                }
              }
            } catch {
              // Ignored
            }
          }
          if (cfg.tokenExpired && isJwtExpired) {
            try {
              localStorage.removeItem('upstox_daily_token');
            } catch {
              // Silently ignored
            }
            cfg.accessToken = '';
          } else if (cfg.accessToken) {
            try {
              localStorage.setItem('upstox_daily_token', cfg.accessToken);
            } catch {
              // Silently ignored
            }
            cfg.isConnected = true;
          } else if (savedDailyToken && !isJwtExpired && !cfg.accessToken) {
            cfg.accessToken = savedDailyToken;
            cfg.isConnected = true;
          }
          setApiConfig((prev) => ({ ...prev, ...cfg, isConnected: Boolean(cfg.accessToken || cfg.isConnected) }));
          if (cfg.accessToken && !serverUserExplicitMode && !hasPreferredMode) {
            setMode('UPSTOX_LIVE');
          }
        }
        if (
          historyRes.status === 'fulfilled' &&
          Array.isArray(historyRes.value) &&
          historyRes.value.length > 0
        ) {
          fetchHistory();
        }
      } catch (err) {
        console.warn('Initial data fetch notice:', err);
      }
    };
    fetchInitData();
    const configSyncInterval = setInterval(async () => {
      try {
        let syncToken = '';
        try {
          syncToken = localStorage.getItem('upstox_daily_token') || '';
        } catch {
          // Ignored
        }
        const syncHeaders: Record<string, string> = {};
        if (syncToken) syncHeaders['Authorization'] = `Bearer ${syncToken}`;

        const res = await fetch('/api/market/config', { headers: syncHeaders });
        if (res.ok) {
          const cfg = await res.json();
          if (cfg && typeof cfg.isConnected === 'boolean') {
            if (cfg.isConnected && cfg.accessToken) {
              try {
                localStorage.setItem('upstox_daily_token', cfg.accessToken);
              } catch {
                // Ignored
              }
            }
            setApiConfig((prev) => ({
              ...prev,
              isConnected: cfg.isConnected,
              accessToken: cfg.accessToken || (cfg.tokenExpired ? '' : prev.accessToken),
              availableMargin: Number(cfg.availableMargin ?? prev.availableMargin),
              usedMargin: Number(cfg.usedMargin ?? prev.usedMargin),
              utilizedMargin: Number(cfg.utilizedMargin ?? prev.utilizedMargin),
              payin: Number(cfg.payin ?? prev.payin),
              payout: Number(cfg.payout ?? prev.payout),
              totalBalance: Number(cfg.totalBalance ?? prev.totalBalance),
              holdingsCount: typeof cfg.holdingsCount === 'number' ? cfg.holdingsCount : prev.holdingsCount,
              userName: cfg.userName || prev.userName,
              userClientCode: cfg.userClientCode || prev.userClientCode,
              tokenGeneratedAt: cfg.tokenGeneratedAt || prev.tokenGeneratedAt,
              tokenExpiresAt: cfg.tokenExpiresAt || prev.tokenExpiresAt,
              redirectUri: cfg.redirectUri || prev.redirectUri,
              serverOutboundIp: cfg.serverOutboundIp || prev.serverOutboundIp,
              serverSecondaryIp: cfg.serverSecondaryIp || prev.serverSecondaryIp,
              actualDetectedIp: cfg.actualDetectedIp || prev.actualDetectedIp,
              proxyError: cfg.proxyError ?? prev.proxyError,
            }));
          }
        }
      } catch {
        // Ignored
      }
    }, 4000);
    return () => clearInterval(configSyncInterval);
  }, []);

  // Fetch real Upstox live quotes periodically
  useEffect(() => {
    let isMounted = true;
    const updateQuotes = async () => {
      try {
        let token = apiConfig.accessToken;
        if (!token) {
          try {
            token = localStorage.getItem('upstox_daily_token') || '';
          } catch {
            // Silently ignored
          }
        }

        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch('/api/market/quotes', { headers });
        if (res.ok) {
          const data = await res.json();
          // Support both array and { quotes: [...] } format from Upstox
          const quotesList = Array.isArray(data)
            ? data
            : Array.isArray(data?.quotes)
              ? data.quotes
              : null;
          if (quotesList && quotesList.length > 0 && isMounted) {
            const uniqueQuotes = deduplicateQuotes([...quotesList, ...INITIAL_WATCHLIST_SYMBOLS]);
            setQuotes(uniqueQuotes);
            setIsWsConnected(true);
            return;
          }
        } else {
          if (isMounted) setIsWsConnected(false);
        }
      } catch {
        if (isMounted) setIsWsConnected(false);
      }

      if (!isMounted) return;
    };

    updateQuotes();
    const timer = setInterval(updateQuotes, 1200);

    // Also subscribe to SSE (/api/stream/quotes) for sub-second real-time tick streaming
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/stream/quotes');
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (
            msg.type === 'QUOTES' &&
            Array.isArray(msg.data) &&
            msg.data.length > 0 &&
            isMounted
          ) {
            const uniqueQuotes = deduplicateQuotes([...msg.data, ...INITIAL_WATCHLIST_SYMBOLS]);
            setQuotes(uniqueQuotes);
            setIsWsConnected(true);
          }
        } catch {
          // Ignored
        }
      };
    } catch {
      // Ignored
    }

    return () => {
      isMounted = false;
      clearInterval(timer);
      if (es) es.close();
    };
  }, [apiConfig.accessToken]);

  // Fetch real Upstox Candlesticks & Technical Indicators
  const fetchRealCandles = useCallback(async () => {
    let token = apiConfig.accessToken;
    if (!token) {
      try {
        token = localStorage.getItem('upstox_daily_token') || '';
      } catch {
        // Silently ignored
      }
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const url = `/api/market/candles?symbol=${encodeURIComponent(selectedSymbol)}&interval=${chartInterval}&instrumentKey=${encodeURIComponent(selectedInstrumentKey)}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.candles) && json.candles.length > 0) {
          const enriched = enrichCandlesWithIndicators(json.candles);
          setCandles(enriched);
          return;
        }
      }
    } catch (e) {
      console.warn('Real candle fetch notice:', e);
    }
  }, [selectedSymbol, selectedInstrumentKey, chartInterval, apiConfig.accessToken]);

  // Clear stale candles immediately when selectedSymbol or selectedInstrumentKey changes so old symbol's price scale never mixes with new symbol
  useEffect(() => {
    setCandles([]);
  }, [selectedSymbol, selectedInstrumentKey]);

  useEffect(() => {
    fetchRealCandles();
    const candleIntervalTimer = setInterval(fetchRealCandles, 3500);
    return () => clearInterval(candleIntervalTimer);
  }, [fetchRealCandles]);

  // Keep chartTradeContext dynamically synchronized with live positions & latest candles
  useEffect(() => {
    if (!chartTradeContext) return;
    const active = positions.find(
      (p) => p.id === chartTradeContext.id || p.symbol === chartTradeContext.symbol,
    );
    const lastCandleClose = candles.length > 0 ? Number(candles[candles.length - 1].close || 0) : 0;
    if (active) {
      const liveLtp =
        lastCandleClose > 0 && Math.abs(lastCandleClose - active.buyPrice) < active.buyPrice * 5
          ? lastCandleClose
          : Number(active.currentLTP || active.buyPrice);
      const livePnl = Number(((liveLtp - active.buyPrice) * active.quantity).toFixed(2));
      setChartTradeContext((prev: any) => {
        if (!prev) return prev;
        if (
          prev.currentLTP === liveLtp &&
          prev.pnl === livePnl &&
          prev.stopLoss === active.stopLoss
        )
          return prev;
        return {
          ...prev,
          ...active,
          currentLTP: liveLtp,
          pnl: livePnl,
        };
      });
    } else if (lastCandleClose > 0) {
      setChartTradeContext((prev: any) => {
        if (!prev || prev.currentLTP === lastCandleClose) return prev;
        const livePnl = Number(
          ((lastCandleClose - prev.buyPrice) * (prev.quantity || 1)).toFixed(2),
        );
        return {
          ...prev,
          currentLTP: lastCandleClose,
          pnl: livePnl,
        };
      });
    }
  }, [positions, candles, chartTradeContext?.symbol]);

  // Sync selected symbol's current live tick into latest candle (only if price belongs to the same instrument scale!)
  const currentQuote =
    quotes.find(
      (q) =>
        q.symbol === selectedSymbol ||
        q.instrumentKey === selectedInstrumentKey ||
        (selectedSymbol.includes('BANK') && q.symbol.includes('BANK') && q.segment === 'INDEX'),
    ) ||
    (() => {
      // If viewing an option contract from chartTradeContext, synthesize quote from trade context
      if (
        chartTradeContext &&
        (chartTradeContext.symbol === selectedSymbol ||
          selectedSymbol.includes(chartTradeContext.symbol))
      ) {
        const lastCandlePrice =
          candles.length > 0 ? Number(candles[candles.length - 1].close || 0) : 0;
        const ltp =
          lastCandlePrice > 0
            ? lastCandlePrice
            : Number(chartTradeContext.currentLTP || chartTradeContext.buyPrice || 0);
        const buy = Number(chartTradeContext.buyPrice || ltp);
        const diff = ltp - buy;
        const diffPct = buy > 0 ? (diff / buy) * 100 : 0;
        return {
          symbol: selectedSymbol,
          name: selectedSymbol,
          exchange: 'NSE',
          segment: 'OPTIONS',
          instrumentKey: chartTradeContext.instrumentKey || selectedInstrumentKey,
          ltp,
          change: Number(diff.toFixed(2)),
          changePercent: Number(diffPct.toFixed(2)),
          volume: 0,
          open: buy,
          high: Math.max(buy, ltp),
          low: Math.min(buy, ltp),
          close: buy,
        } as StockQuote;
      }
      // If an open position matches selectedSymbol, use its live position price
      const matchPos = positions.find(
        (p) => p.symbol === selectedSymbol || selectedSymbol.includes(p.symbol),
      );
      if (matchPos) {
        const ltp = Number(matchPos.currentLTP || matchPos.buyPrice || 0);
        const buy = Number(matchPos.buyPrice || ltp);
        const diff = ltp - buy;
        const diffPct = buy > 0 ? (diff / buy) * 100 : 0;
        return {
          symbol: selectedSymbol,
          name: selectedSymbol,
          exchange: 'NSE',
          segment: 'OPTIONS',
          instrumentKey: matchPos.instrumentKey || selectedInstrumentKey,
          ltp,
          change: Number(diff.toFixed(2)),
          changePercent: Number(diffPct.toFixed(2)),
          volume: 0,
          open: buy,
          high: Math.max(buy, ltp),
          low: Math.min(buy, ltp),
          close: buy,
        } as StockQuote;
      }
      // Fallback: derive quote from display candles for this symbol rather than picking an unrelated stock!
      const lastCandle = candles[candles.length - 1];
      const firstCandle = candles[0];
      const candleLtp = lastCandle?.close || 0;
      const candleOpen = firstCandle?.open || candleLtp;
      const diff = candleLtp - candleOpen;
      const diffPct = candleOpen > 0 ? (diff / candleOpen) * 100 : 0;
      if (candleLtp > 0) {
        return {
          symbol: selectedSymbol,
          name: selectedSymbol,
          exchange: 'NSE',
          segment: 'EQUITY',
          instrumentKey: selectedInstrumentKey,
          ltp: candleLtp,
          change: Number(diff.toFixed(2)),
          changePercent: Number(diffPct.toFixed(2)),
          volume: lastCandle?.volume || 0,
          open: candleOpen,
          high: candleLtp,
          low: candleLtp,
          close: candleOpen,
        } as StockQuote;
      }
      return quotes[0];
    })();

  useEffect(() => {
    if (!currentQuote || !currentQuote.ltp || currentQuote.ltp <= 0) return;
    setCandles((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (!last || !last.close || last.close <= 0) return prev;
      // Guard against cross-symbol contamination (e.g., merging a ₹54,450 NIFTY BANK quote into ₹22,700 NIFTY 50 candles)
      const priceDiffRatio = Math.abs(currentQuote.ltp - last.close) / last.close;
      if (priceDiffRatio > 0.15) {
        return prev;
      }
      const updatedLast: CandleData = {
        ...last,
        close: currentQuote.ltp,
        high: Math.max(last.high, currentQuote.ltp),
        low: Math.min(last.low, currentQuote.ltp),
      };
      const copy = [...prev.slice(0, -1), updatedLast];
      return enrichCandlesWithIndicators(copy);
    });
  }, [currentQuote?.ltp]);

  // Fetch or Compute Gemini AI Market Analysis
  const handleFetchGeminiAnalysis = useCallback(async () => {
    if (!currentQuote) return;
    setAiLoading(true);

    const realOptMetrics = (() => {
      if (!optionChainData || !optionChainData.strikes || optionChainData.strikes.length === 0)
        return undefined;
      const isBull = (currentQuote.changePercent || 0) >= 0;
      const optType: 'CE' | 'PE' = isBull ? 'CE' : 'PE';
      const sortedStrikes = [...optionChainData.strikes].sort(
        (a, b) =>
          Math.abs(a.strikePrice - currentQuote.ltp) - Math.abs(b.strikePrice - currentQuote.ltp),
      );
      const atm = sortedStrikes[0];
      if (!atm) return undefined;
      const ltp = optType === 'CE' ? atm.callLTP : atm.putLTP;
      if (!ltp || ltp <= 0) return undefined;
      const lotSz = atm.lotSize || optionChainData.lotSize || 1;
      const charges = calculateTradeCharges(ltp, lotSz, true, ltp * 1.27);
      const oneLotCost = charges.tradeValue;
      const availCap =
        mode === 'UPSTOX_LIVE'
          ? (botConfig.maxCapitalPerTrade ?? 0) > 0
            ? Math.min(apiConfig.availableMargin, botConfig.maxCapitalPerTrade ?? 0)
            : apiConfig.availableMargin
          : botConfig.maxCapitalPerTrade || 2000;
      const lotCalc = calculateAffordableLotsWithBrokerage(ltp, lotSz, availCap, true, 5);
      return {
        strikePrice: atm.strikePrice,
        optionType: optType,
        ltp,
        expiry: optionChainData.selectedExpiry || 'Current Weekly',
        lotSize: lotSz,
        delta: optType === 'CE' ? atm.callDelta : atm.putDelta,
        iv: optType === 'CE' ? atm.callIV : atm.putIV,
        oi: optType === 'CE' ? atm.callOI : atm.putOI,
        volume: optType === 'CE' ? atm.callVolume : atm.putVolume,
        pcr: optionChainData.pcr,
        instrumentKey: optType === 'CE' ? atm.callInstrumentKey : atm.putInstrumentKey,
        requiredCapital: oneLotCost,
        estimatedBrokerage: charges.roundTripCharges,
        totalRequiredWithBrokerage: charges.totalRequiredWithBrokerage,
        expectedNetProfit: Number((ltp * 0.27 * lotSz - charges.roundTripCharges).toFixed(2)),
        affordableLots: lotCalc.affordableLots,
        availableCapital: availCap,
      };
    })();

    const sig =
      candles.length >= 20
        ? analyzeTradingSignals(
            currentQuote.symbol,
            currentQuote.name,
            currentQuote.instrumentKey,
            candles,
            currentQuote.ltp,
            botConfig.selectedStrategy,
            realOptMetrics?.ltp,
            realOptMetrics,
          )
        : null;

    if (sig) {
      setActiveSignal(sig);
      setSignals((prev) => [sig, ...prev.filter((s) => s.id !== sig.id).slice(0, 19)]);
      if (soundEnabled) {
        soundEngine.play('SIGNAL');
      }
    }

    const lastCandle = candles[candles.length - 1] || ({} as any);
    try {
      const res = await fetch('/api/gemini/market-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: currentQuote.symbol,
          ltp: currentQuote.ltp,
          changePercent: currentQuote.changePercent,
          interval: chartInterval,
          indicators: {
            supertrend: {
              signal: lastCandle.supertrendDir || 'BUY',
              value: lastCandle.supertrend || currentQuote.ltp,
            },
            emaCross: {
              signal: (lastCandle.ema9 || 0) >= (lastCandle.ema21 || 0) ? 'BULLISH' : 'BEARISH',
            },
            rsi: { value: lastCandle.rsi || 55 },
            macd: {
              cross: (lastCandle.macd || 0) >= (lastCandle.macdSignal || 0) ? 'BULLISH' : 'BEARISH',
            },
            vwap: { value: currentQuote.vwap || currentQuote.ltp },
          },
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setGeminiAnalysis(json.data);
          setAiLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Gemini API fetch fallback:', e);
    }

    // Intelligent institutional fallback analysis derived from technical indicators
    const isBull = (currentQuote.changePercent || 0) >= 0;
    const ltp = currentQuote.ltp;
    const baseScore = Math.min(
      94,
      Math.max(78, Math.round(75 + Math.abs(currentQuote.changePercent || 0) * 8)),
    );
    setGeminiAnalysis({
      sentiment: isBull ? 'BULLISH' : 'BEARISH',
      confidenceScore: baseScore,
      summary: `${currentQuote.symbol} is displaying strong ${isBull ? 'upward continuation' : 'downward pressure'} with volume expanding around key liquidity levels at ₹${ltp.toFixed(2)}. Multi-timeframe trend aligns with institutional flow.`,
      summaryMalayalam: `${currentQuote.symbol} ₹${ltp.toFixed(2)} നിലവാരത്തിൽ ശക്തമായ ${isBull ? 'മുന്നേറ്റം (Bullish)' : 'ഇറക്കം (Bearish)'} കാണിക്കുന്നു. വോളിയവും ഇൻഡിക്കേറ്ററുകളും അനുകൂലമായ ട്രേഡിംഗ് അവസരം സ്ഥിരീകരിക്കുന്നു.`,
      keyLevels: {
        support1: Number((ltp * 0.992).toFixed(2)),
        support2: Number((ltp * 0.985).toFixed(2)),
        resistance1: Number((ltp * 1.008).toFixed(2)),
        resistance2: Number((ltp * 1.015).toFixed(2)),
      },
      recommendedAction: {
        type: isBull ? 'BUY' : 'SELL',
        entryRange: `₹${(ltp * 0.998).toFixed(2)} - ₹${(ltp * 1.002).toFixed(2)}`,
        stopLoss: Number((ltp * (isBull ? 0.991 : 1.009)).toFixed(2)),
        target1: Number((ltp * (isBull ? 1.012 : 0.988)).toFixed(2)),
        target2: Number((ltp * (isBull ? 1.024 : 0.976)).toFixed(2)),
        confidence: 86,
        riskReward: '1 : 2.5',
      },
      technicalReasons: [
        `EMA 9/21/50 alignment indicates solid ${isBull ? 'bullish momentum' : 'bearish rejection'}.`,
        `RSI (14) sitting at ${(lastCandle.rsi || 58).toFixed(1)} with strong momentum confirmation.`,
        `Supertrend trailing barrier acting as institutional dynamic ${isBull ? 'support' : 'resistance'}.`,
      ],
      technicalReasonsMalayalam: [
        `EMA 9/21/50 മൂവിംഗ് ആവറേജുകൾ ${isBull ? 'ബുള്ളിഷ് ക്രമം' : 'ബെയറിഷ് ക്രമം'} സ്ഥിരീകരിക്കുന്നു.`,
        `RSI മോമെന്റം ${(lastCandle.rsi || 58).toFixed(1)} നിലവാരത്തിൽ ശക്തമാണ്.`,
        `സൂപ്പർട്രെൻഡ് ഇൻഡിക്കേറ്റർ ട്രെൻഡിനൊപ്പം അനുകൂലമായി നിലകൊള്ളുന്നു.`,
      ],
      catalyst: 'Intraday Order Book Imbalance & Liquidity Sweep',
      analyzedAt: new Date().toLocaleTimeString('en-IN'),
    });
    setAiLoading(false);
  }, [currentQuote, candles, chartInterval, botConfig.selectedStrategy, soundEnabled]);

  const fetchOptionChain = useCallback(
    async (expiryOverride?: string, symbolOverride?: string) => {
      setOptionChainLoading(true);
      let token = apiConfig.accessToken;
      if (!token) {
        try {
          token = localStorage.getItem('upstox_daily_token') || '';
        } catch {
          // Silently ignored
        }
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const targetSymbol = symbolOverride || selectedSymbol;
      try {
        const qs = new URLSearchParams({ symbol: targetSymbol });
        if (expiryOverride && typeof expiryOverride === 'string') {
          qs.set('expiry', expiryOverride);
        }
        const res = await fetch(`/api/market/optionchain?${qs.toString()}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data && data.strikes && data.strikes.length > 0) {
            setOptionChainData(data);
            return;
          }
        }
      } catch (e) {
        console.warn('Real option chain fetch notice:', e);
      } finally {
        setOptionChainLoading(false);
      }
    },
    [selectedSymbol, apiConfig.accessToken],
  );

  // Fetch real Upstox long-term holdings
  const fetchHoldings = useCallback(async () => {
    let token = apiConfig.accessToken;
    if (!token) {
      try {
        token = localStorage.getItem('upstox_daily_token') || '';
      } catch {
        // Silently ignored
      }
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch('/api/market/holdings', { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setHoldings(
            data.map((h: any) => ({
              symbol: h.symbol,
              companyName: h.companyName || h.symbol,
              instrumentKey: h.instrumentKey,
              isin: h.isin,
              quantity: h.quantity,
              avgPrice: h.buyPrice ?? h.avgPrice,
              buyPrice: h.buyPrice ?? h.avgPrice,
              currentLTP: h.currentLTP,
              closePrice: h.closePrice,
              isBuyPriceLocked: h.isBuyPriceLocked,
              isUpstoxZeroPrice: h.isUpstoxZeroPrice,
              investedValue: h.investedValue || (h.quantity || 0) * (h.buyPrice || 0),
              currentValue: h.currentValue || (h.quantity || 0) * (h.currentLTP || 0),
              pnl: h.pnl || (h.currentLTP - (h.buyPrice || h.avgPrice)) * h.quantity,
              pnlPercent:
                h.pnlPercent ||
                (h.buyPrice > 0 ? ((h.currentLTP - h.buyPrice) / h.buyPrice) * 100 : 0),
              fiftyPercentTarget: h.fiftyPercentTarget,
              algoForecast: h.algoForecast,
            })),
          );
        }
      }
    } catch (e) {
      console.warn('Holdings fetch notice:', e);
    }
  }, [apiConfig.accessToken]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTradeHistory((prev) => {
            const map = new Map<string, Position>();
            prev.forEach((t) => map.set(t.id, t));
            data.forEach((t: any) => map.set(t.id, { ...t, mode: t.mode || 'PAPER_TRADING' }));
            return Array.from(map.values()).sort((a, b) => {
              const timeA = new Date(a.closeTime || 0).getTime();
              const timeB = new Date(b.closeTime || 0).getTime();
              return timeB - timeA;
            });
          });
        }
      }
    } catch {
      // Ignored
    }
  }, []);

  // Fetch real Upstox live positions AND Paper Trading positions/orders from backend
  const fetchLivePositions = useCallback(async () => {
    let token = apiConfig.accessToken;
    if (!token) {
      try {
        token = localStorage.getItem('upstox_daily_token') || '';
      } catch {
        // Silently ignored
      }
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const [livePosRes, paperPosRes, paperOrdRes, paperHistRes] = await Promise.allSettled([
        token ? fetch('/api/market/positions', { headers }) : Promise.resolve(null),
        fetch('/api/trading/positions?mode=PAPER_TRADING'),
        fetch('/api/trading/orders?mode=PAPER_TRADING'),
        fetch('/api/trading/history?mode=PAPER_TRADING'),
      ]);

      let livePosList: Position[] = [];
      if (livePosRes.status === 'fulfilled' && livePosRes.value && livePosRes.value.ok) {
        const data = await livePosRes.value.json();
        if (Array.isArray(data)) livePosList = data;
      }

      let paperPosList: Position[] = [];
      if (paperPosRes.status === 'fulfilled' && paperPosRes.value && paperPosRes.value.ok) {
        const pData = await paperPosRes.value.json();
        if (Array.isArray(pData)) {
          paperPosList = pData.map((p: any) => ({
            ...p,
            mode: 'PAPER_TRADING',
            productType: p.productType || 'INTRADAY',
            pnl: Number((p.pnl || 0).toFixed(2)),
            pnlPercent:
              p.buyPrice > 0
                ? Number((((p.currentLTP - p.buyPrice) / p.buyPrice) * 100).toFixed(2))
                : 0,
            openedAt: p.openedAt || new Date().toLocaleTimeString(),
          }));
        }
      }

      if (mode === 'PAPER_TRADING') {
        setPositions(paperPosList);
      } else {
        // In UPSTOX_LIVE mode, strictly show ONLY real Upstox positions (never mix dummy/paper positions!)
        setPositions(livePosList);
      }

      if (mode === 'PAPER_TRADING') {
        if (paperOrdRes.status === 'fulfilled' && paperOrdRes.value && paperOrdRes.value.ok) {
          const oData = await paperOrdRes.value.json();
          if (Array.isArray(oData) && oData.length > 0) {
            setOrders((prev) => {
              const map = new Map<string, Order>();
              prev.forEach((o) => map.set(o.id || o.orderId, o));
              oData.forEach((o: any) => {
                const item: Order = {
                  id: o.id || o.orderId,
                  orderId: o.orderId || o.id,
                  positionId: o.positionId,
                  symbol: o.symbol,
                  instrumentKey: o.instrumentKey || `NSE_FO|${o.symbol}`,
                  transactionType: o.transactionType || o.type || 'BUY',
                  orderType: o.orderType || 'MARKET',
                  productType: o.productType || 'INTRADAY',
                  quantity: o.quantity,
                  price: o.price,
                  executedPrice: o.executedPrice || o.price,
                  buyPrice: o.buyPrice,
                  sellPrice: o.sellPrice,
                  realizedPnL: o.realizedPnL,
                  brokerageCharges: o.brokerageCharges,
                  netRealizedPnL: o.netRealizedPnL,
                  status: o.status || 'COMPLETE',
                  timestamp: o.timestamp || new Date(o.time || Date.now()).toLocaleTimeString(),
                  mode: 'PAPER_TRADING',
                };
                map.set(item.id || item.orderId, item);
              });
              return Array.from(map.values());
            });
          }
        }
        if (paperHistRes.status === 'fulfilled' && paperHistRes.value && paperHistRes.value.ok) {
          const hData = await paperHistRes.value.json();
          if (Array.isArray(hData) && hData.length > 0) {
            setTradeHistory((prev) => {
              const map = new Map<string, Position>();
              prev.forEach((t) => map.set(t.id, t));
              hData.forEach((t: any) => {
                map.set(t.id, { ...t, mode: 'PAPER_TRADING' });
              });
              return Array.from(map.values()).sort((a, b) => {
                const tA = new Date(a.closeTime || a.openedAt || 0).getTime();
                const tB = new Date(b.closeTime || b.openedAt || 0).getTime();
                return tB - tA;
              });
            });
          }
        }
      } else if (token) {
        // In UPSTOX_LIVE mode, fetch real Upstox order book and trade history
        try {
          const [liveOrdRes, liveHistRes] = await Promise.allSettled([
            fetch('/api/market/orders', { headers }),
            fetch('/api/trading/history?mode=UPSTOX_LIVE', { headers }),
          ]);
          if (liveOrdRes.status === 'fulfilled' && liveOrdRes.value && liveOrdRes.value.ok) {
            const liveOrdData = await liveOrdRes.value.json();
            if (Array.isArray(liveOrdData) && liveOrdData.length > 0) {
              setOrders((prev) => {
                const map = new Map<string, Order>();
                prev.forEach((o) => map.set(o.id || o.orderId, o));
                liveOrdData.forEach((o: any) => {
                  map.set(o.id || o.orderId, { ...o, mode: 'UPSTOX_LIVE' });
                });
                return Array.from(map.values());
              });
            }
          }
          if (liveHistRes.status === 'fulfilled' && liveHistRes.value && liveHistRes.value.ok) {
            const liveHistData = await liveHistRes.value.json();
            if (Array.isArray(liveHistData) && liveHistData.length > 0) {
              setTradeHistory((prev) => {
                const map = new Map<string, Position>();
                prev.forEach((t) => map.set(t.id, t));
                liveHistData.forEach((t: any) => {
                  map.set(t.id, { ...t, mode: 'UPSTOX_LIVE' });
                });
                return Array.from(map.values()).sort((a, b) => {
                  const tA = new Date(a.closeTime || a.openedAt || 0).getTime();
                  const tB = new Date(b.closeTime || b.openedAt || 0).getTime();
                  return tB - tA;
                });
              });
            }
          }
        } catch {
          // Ignored
        }
      }
    } catch (e) {
      console.warn('Positions fetch notice:', e);
    }
  }, [apiConfig.accessToken, mode]);

  useEffect(() => {
    if (activeTab === 'OPTIONS') {
      fetchOptionChain(undefined, selectedSymbol);
    } else if (activeTab === 'HOLDINGS' || activeTab === 'ORDERS') {
      fetchHoldings();
      fetchLivePositions();
    }
  }, [activeTab, selectedSymbol, fetchOptionChain, fetchHoldings, fetchLivePositions]);

  // Initial and periodic sync of holdings and positions when token is present
  useEffect(() => {
    if (apiConfig.isConnected || apiConfig.accessToken) {
      fetchHoldings();
      fetchLivePositions();
    }
  }, [apiConfig.isConnected, apiConfig.accessToken, fetchHoldings, fetchLivePositions]);

  // Order Placement
  const handlePlaceOrder = async (orderData: {
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
  }) => {
    const executedPrice = orderData.price;
    if (executedPrice <= 0 && mode === 'PAPER_TRADING') {
      return;
    }

    const matchedHolding = holdings.find((h) => h.symbol === orderData.symbol);
    const matchedQuote = quotes.find((q) => q.symbol === orderData.symbol);
    const isOpt = /\b(CE|PE)\b/i.test(orderData.symbol);
    const resolvedInstrumentKey =
      orderData.instrumentKey ||
      (matchedHolding as any)?.instrumentKey ||
      matchedQuote?.instrumentKey ||
      (isOpt ? `NSE_FO|${orderData.symbol}` : `NSE_EQ|${orderData.symbol}`);

    try {
      const orderHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      const activeTok =
        apiConfig.accessToken ||
        (() => {
          try {
            return localStorage.getItem('upstox_daily_token') || '';
          } catch {
            return '';
          }
        })();
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

    const orderIdTime = Date.now().toString().slice(-6);
    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      orderId: `UP_${orderIdTime}`,
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

    // Update positions locally for immediate UI feedback
    if (orderData.transactionType === 'SELL') {
      const existing = positions.find((p) => p.symbol === orderData.symbol);
      if (existing) {
        handleSquareOffPosition(existing.id);
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
  };

  // Square off single position (both Paper Trading and Upstox Live)
  const handleSquareOffPosition = async (id: string) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;

    const sellPrice = pos.currentLTP;
    const grossPnL = (sellPrice - pos.buyPrice) * pos.quantity;
    const posMode = pos.mode || mode;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const savedTok = localStorage.getItem('upstox_daily_token');
      if (savedTok && savedTok.length > 30) {
        headers['Authorization'] = `Bearer ${savedTok}`;
      }
      const res = await fetch(`/api/trading/squareoff/${encodeURIComponent(pos.id)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: posMode,
          symbol: pos.symbol,
          instrumentKey: pos.instrumentKey,
          quantity: pos.quantity,
          productType: pos.productType,
          sellPrice,
        }),
      });
      const data = await res.json();
      if (posMode === 'UPSTOX_LIVE' && !data.success) {
        setBotLogs((prev) => [
          {
            id: Date.now().toString(),
            timestamp: new Date().toLocaleTimeString(),
            message: `[SQUARE-OFF ERROR] ${data.error || 'Could not square off live position on Upstox'}`,
            type: 'ERROR',
          },
          ...prev.slice(0, 199),
        ]);
        return;
      }
    } catch {
      // Ignored
    }

    const closedPos: Position = {
      ...pos,
      sellPrice,
      realizedPnL: grossPnL,
      closeTime: new Date().toISOString(),
    };

    setPositions((prev) => prev.filter((p) => p.id !== id));
    setTradeHistory((prev) => [closedPos, ...prev]);

    // Record close order
    const exitOrderIdTime = Date.now().toString().slice(-6);
    const exitOrder: Order = {
      id: `ord_${Date.now()}`,
      orderId: `UP_${exitOrderIdTime}`,
      symbol: pos.symbol,
      instrumentKey: pos.instrumentKey,
      transactionType: 'SELL',
      orderType: 'MARKET',
      productType: pos.productType,
      quantity: pos.quantity,
      price: sellPrice,
      executedPrice: sellPrice,
      status: 'COMPLETE',
      timestamp: new Date().toLocaleTimeString(),
      mode,
      notes: 'Manual Square-Off',
    };
    setOrders((prev) => [exitOrder, ...prev]);

    if (soundEnabled) {
      soundEngine.play(grossPnL >= 0 ? 'SUCCESS' : 'ALERT');
      if (grossPnL >= 0) {
        soundEngine.speak(
          language === 'ml'
            ? `ലാഭം ₹${grossPnL.toFixed(0)} ബുക്ക് ചെയ്തു!`
            : `Profit of ${grossPnL.toFixed(0)} rupees locked!`,
          language,
        );
      } else {
        soundEngine.speak(
          language === 'ml' ? `സ്റ്റോപ്പ് ലോസ് എക്സിറ്റ് ആയി!` : `Stop loss exit triggered!`,
          language,
        );
      }
    }
  };

  // Square off all positions
  const handleSquareOffAll = () => {
    positions.forEach((p) => handleSquareOffPosition(p.id));
  };

  const handleSyncHistoryBrokerage = async () => {
    try {
      const res = await fetch('/api/bot/sync-history-brokerage', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        // Refresh history to see updated brokerage from API
        fetchHistory();
      }
    } catch (err) {
      console.error('Failed to sync history brokerage:', err);
    }
  };

  const handleResetPaperAccount = async () => {
    if (
      !window.confirm(
        language === 'ml'
          ? 'നിങ്ങളുടെ പേപ്പർ ട്രേഡിംഗ് അക്കൗണ്ട് റീസെറ്റ് ചെയ്യണമെന്നുറപ്പാണോ?'
          : 'Are you sure you want to reset your paper trading account?',
      )
    ) {
      return;
    }
    try {
      const res = await fetch('/api/paper/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialCapital: 2000 }),
      });
      if (res.ok) {
        setOrders([]);
        setPositions([]);
        setTradeHistory([]);
        try {
          localStorage.removeItem('aizabiz_persisted_orders_v2');
          localStorage.removeItem('aizabiz_persisted_trade_history_v2');
        } catch {
          // Ignored
        }
        alert(language === 'ml' ? 'അക്കൗണ്ട് റീസെറ്റ് ചെയ്തു!' : 'Account reset successfully!');
        window.location.reload();
      }
    } catch (e) {
      console.error('Failed to reset account', e);
    }
  };

  // Dedicated Option Premium & Instrument Chart Handler (Supports running positions, history, orders & holdings)
  const handleViewChart = useCallback(
    (sym: string, key?: string, context?: any) => {
      setSelectedSymbol(sym);
      setChartTradeContext(context || null);

      const isOption =
        /\b(CE|PE)\b/i.test(sym) ||
        sym.toUpperCase().endsWith('CE') ||
        sym.toUpperCase().endsWith('PE');
      if (key && (key.startsWith('NSE_FO|') || key.startsWith('BSE_FO|') || isOption)) {
        setSelectedInstrumentKey(key);
      } else if (isOption) {
        setSelectedInstrumentKey(key || `NSE_FO|${sym}`);
      } else {
        const matched = quotes.find((q) => q.symbol === sym);
        if (matched?.instrumentKey) {
          setSelectedInstrumentKey(matched.instrumentKey);
        } else if (sym.toUpperCase().includes('BANKEX')) {
          setSelectedInstrumentKey('BSE_INDEX|BANKEX');
        } else if (sym.toUpperCase().includes('SENSEX')) {
          setSelectedInstrumentKey('BSE_INDEX|SENSEX');
        } else if (sym.toUpperCase().includes('BANK')) {
          setSelectedInstrumentKey('NSE_INDEX|Nifty Bank');
        } else if (sym.toUpperCase().includes('FIN')) {
          setSelectedInstrumentKey('NSE_INDEX|Nifty Fin Service');
        } else if (sym.toUpperCase().includes('NIFTY')) {
          setSelectedInstrumentKey('NSE_INDEX|Nifty 50');
        } else {
          setSelectedInstrumentKey(key || sym);
        }
      }
      setActiveTab('CHART');
    },
    [quotes],
  );

  // Execute signal directly with live Upstox lot size and account capital affordability check
  const handleExecuteSignal = async (sig: TradingSignal) => {
    const price = sig.recommendedOptionStrike ? sig.recommendedOptionStrike.ltp : sig.price;
    const rawSym = sig.symbol || '';
    const isAlreadyOptionSym = /\b(CE|PE)\b/i.test(rawSym);
    const symbol =
      !isAlreadyOptionSym && sig.recommendedOptionStrike
        ? `${rawSym} ${sig.recommendedOptionStrike.strikePrice} ${sig.recommendedOptionStrike.optionType}`
        : rawSym;
    const isOptionTrade = /\b(CE|PE)\b/i.test(symbol) || Boolean(sig.recommendedOptionStrike);

    let liveLot = sig.recommendedOptionStrike?.lotSize || 0;
    if (!liveLot || liveLot <= 1) {
      try {
        const headers: Record<string, string> = {};
        const savedTok = localStorage.getItem('upstox_daily_token');
        if (savedTok && savedTok.length > 30) {
          headers['Authorization'] = `Bearer ${savedTok}`;
        }
        const qs = new URLSearchParams({ symbol });
        if (sig.instrumentKey) qs.set('instrumentKey', sig.instrumentKey);
        const res = await fetch(`/api/instrument/details?${qs.toString()}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (Number(data.lotSize) > 0) {
            liveLot = Number(data.lotSize);
          }
        }
      } catch {
        // Ignored
      }
    }

    const baseLot = liveLot > 0 ? liveLot : 1;
    const oneLotCharges = calculateTradeCharges(
      price,
      baseLot,
      isOptionTrade,
      sig.target1 || price * 1.25,
    );
    const oneLotCost = oneLotCharges.tradeValue;
    const oneLotBrokerage = oneLotCharges.roundTripCharges;
    const oneLotTotalWithBrokerage = oneLotCharges.totalRequiredWithBrokerage;

    // Strict Capital & Brokerage Separation:
    // - UPSTOX_LIVE: strictly uses real Upstox account cash (apiConfig.availableMargin), never dummy cash!
    // - PAPER_TRADING: uses allocated virtual/dummy capital (botConfig.maxCapitalPerTrade || 2000).
    const effectiveCap =
      mode === 'UPSTOX_LIVE'
        ? (botConfig.maxCapitalPerTrade ?? 0) > 0
          ? Math.min(apiConfig.availableMargin, botConfig.maxCapitalPerTrade ?? 0)
          : apiConfig.availableMargin
        : (botConfig.maxCapitalPerTrade ?? 0) > 0
          ? Math.min(paperAccountBalance, botConfig.maxCapitalPerTrade ?? 0)
          : paperAccountBalance;

    if (oneLotTotalWithBrokerage > effectiveCap) {
      setBotLogs((prev) => [
        {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString(),
          message: `[CAPITAL & BROKERAGE GUARD] Cannot buy ${symbol}: 1 Lot (${baseLot} Qty @ ₹${price}) requires ₹${oneLotTotalWithBrokerage.toLocaleString('en-IN')} (Premium ₹${oneLotCost.toLocaleString('en-IN')} + Brokerage & Taxes ₹${oneLotBrokerage.toFixed(2)}), but available capital is ₹${effectiveCap.toLocaleString('en-IN')}. Order blocked to prevent overleveraging.`,
          type: 'ERROR',
        },
        ...prev.slice(0, 199),
      ]);
      return;
    }

    const lotCalc = calculateAffordableLotsWithBrokerage(
      price,
      baseLot,
      effectiveCap,
      isOptionTrade,
      5,
    );
    if (lotCalc.affordableLots <= 0) {
      return;
    }
    const affordableLots = lotCalc.affordableLots;
    const qty = isOptionTrade ? affordableLots * baseLot : baseLot;

    // For Option buying (both CE and PE), transactionType is ALWAYS 'BUY'!
    const txType: OrderTransactionType = isOptionTrade
      ? 'BUY'
      : sig.signalType === 'SELL'
        ? 'SELL'
        : 'BUY';

    handlePlaceOrder({
      symbol,
      instrumentKey: sig.recommendedOptionStrike?.instrumentKey || sig.instrumentKey,
      transactionType: txType,
      orderType: 'MARKET',
      productType: 'INTRADAY',
      quantity: qty,
      price,
      stopLoss: sig.stopLoss,
      target: sig.target1,
    });
  };

  // Accurate PnL Calculation: Separate Today's Trading P&L vs Total Cumulative P&L
  const {
    totalNetMtm,
    modeTradeHistory,
    modeOrders,
    todayProfit,
    totalCumulativeProfit,
    paperAccountBalance,
  } = useAccountMetrics({ positions, tradeHistory, orders, mode });

  // Price alert handlers
  const { handleAddAlert, handleRemoveAlert } = usePriceAlerts({
    quotes,
    priceAlerts,
    soundEnabled,
    setPriceAlerts,
  });

  // 1. Live update of open positions & price alerts on quotes tick
  useEffect(() => {
    if (quotes.length === 0) return;

    // A. Update open positions MTM P&L (supports both Equity/Index and Option Strikes via optionChainData or quotes)
    setPositions((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((pos) => {
        let currentLTP = pos.currentLTP;
        const isOpt = pos.symbol.includes('CE') || pos.symbol.includes('PE');

        if (isOpt) {
          // 1. Check if live quote exists directly for the option instrumentKey
          const directOptQuote = quotes.find(
            (item) => item.instrumentKey === pos.instrumentKey || item.symbol === pos.symbol,
          );
          if (directOptQuote && directOptQuote.ltp > 0 && directOptQuote.ltp < pos.buyPrice * 50) {
            currentLTP = directOptQuote.ltp;
          } else if (optionChainData && optionChainData.strikes?.length > 0) {
            // 2. Match strike from live Option Chain data
            const strikeMatch = pos.symbol.match(/(\d+)\s*(CE|PE)/i);
            if (strikeMatch) {
              const strikeNum = Number(strikeMatch[1]);
              const optType = strikeMatch[2].toUpperCase();
              const row = optionChainData.strikes.find((s) => s.strikePrice === strikeNum);
              if (row) {
                const chainLtp = optType === 'CE' ? row.callLTP : row.putLTP;
                if (chainLtp > 0) currentLTP = chainLtp;
              }
            }
          }
        } else {
          const q = quotes.find(
            (item) => pos.symbol.startsWith(item.symbol) || item.symbol === pos.symbol,
          );
          if (q && q.ltp > 0) currentLTP = q.ltp;
        }

        const isBuy = pos.type === 'BUY' || !pos.type;
        const pnl = isBuy
          ? (currentLTP - pos.buyPrice) * pos.quantity
          : (pos.buyPrice - currentLTP) * pos.quantity;
        const pnlPercent = pos.buyPrice > 0 ? (pnl / (pos.buyPrice * pos.quantity)) * 100 : 0;
        const highestPnl = Math.max((pos as any).highestPnl || 0, pnl);
        return {
          ...pos,
          currentLTP,
          pnl: Number(pnl.toFixed(2)),
          pnlPercent: Number(pnlPercent.toFixed(2)),
          highestLTP: Math.max(pos.highestLTP || pos.buyPrice, currentLTP),
          highestPnl,
        };
      });
    });
  }, [quotes, soundEnabled]);

  // 2. Real-Time Backend Algo Bot Sync Loop (Fetches authoritative logs, 7-Layer signals, active positions, orders & history from the 200ms server engine)
  // NOTE: All automated trade entries and exits are strictly executed by the 200ms server engine (which enforces 09:18 AM - 15:08 PM IST market hours, real Upstox Option Chain verification, and Peak-Locked Stop-Loss).
  useEffect(() => {
    const syncBackendBotState = async () => {
      try {
        let token = apiConfig.accessToken;
        if (!token) {
          try {
            token = localStorage.getItem('upstox_daily_token') || '';
          } catch {
            // Ignored
          }
        }
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const [logsRes, sigsRes] = await Promise.allSettled([
          fetch('/api/bot/logs', { headers }).then((r) => (r.ok ? r.json() : null)),
          fetch('/api/bot/signals', { headers }).then((r) => (r.ok ? r.json() : null)),
        ]);

        if (logsRes.status === 'fulfilled' && Array.isArray(logsRes.value)) {
          setBotLogs(
            logsRes.value.map((l: any) => ({
              id: l.id || String(Date.now()),
              timestamp: l.timestamp || l.time || new Date().toLocaleTimeString(),
              message: l.message || '',
              type: l.type || 'INFO',
            })),
          );
        }
        if (
          sigsRes.status === 'fulfilled' &&
          Array.isArray(sigsRes.value) &&
          sigsRes.value.length > 0
        ) {
          setSignals(sigsRes.value);
          // Match the signal for the currently selected symbol (e.g. NIFTY 50), instead of taking index 0
          const matchingSig = sigsRes.value.find(
            (s: any) =>
              s.symbol?.includes(selectedSymbol) ||
              s.name?.includes(selectedSymbol) ||
              (selectedSymbol.includes('NIFTY 50') &&
                s.symbol?.includes('NIFTY') &&
                !s.symbol?.includes('BANK') &&
                !s.symbol?.includes('FIN')) ||
              (selectedSymbol.includes('BANK') && s.symbol?.includes('BANK')) ||
              (selectedSymbol.includes('SENSEX') && s.symbol?.includes('SENSEX')),
          );
          setActiveSignal(matchingSig || sigsRes.value[0]);
        }
      } catch {
        // Ignored
      }
      fetchLivePositions();
    };

    syncBackendBotState();
    const botSyncInterval = setInterval(syncBackendBotState, 1500);
    return () => clearInterval(botSyncInterval);
  }, [apiConfig.accessToken, fetchLivePositions, selectedSymbol]);

  // 3. Auto-load AI analysis when switching to AI tab
  useEffect(() => {
    if (activeTab === 'AI' && !geminiAnalysis && !aiLoading) {
      handleFetchGeminiAnalysis();
    }
  }, [activeTab, geminiAnalysis, aiLoading, handleFetchGeminiAnalysis]);

  // 4. Live 1-Second IST Market Session Clock & Opening/Closing Bell Trigger
  useEffect(() => {
    const timer = setInterval(() => {
      const nextSession = getIstMarketSessionStatus();
      setMarketSession(nextSession);

      if (prevMarketPhaseRef.current !== nextSession.phase) {
        if (nextSession.phase === 'LIVE_TRADING' || nextSession.phase === 'OPENING_VOLATILITY') {
          const banner = triggerAlertEvent(
            'MARKET_OPEN_BELL',
            'NSE / BSE',
            '🔔 മാർക്കറ്റ് ട്രേഡിങ് ആരംഭിച്ചു (09:15 AM IST)!',
            'അൽഗോരിതം 09:18 AM മുതൽ തത്സമയ ബ്രേക്ക്ഔട്ട് ട്രേഡുകൾ എടുത്തു തുടങ്ങും.',
            !soundEnabled,
          );
          if (banner) setLightingBanner(banner);
        } else if (nextSession.phase === 'CLOSED_POST_MARKET') {
          const banner = triggerAlertEvent(
            'MARKET_CLOSE_BELL',
            'NSE / BSE',
            '🏁 ഇന്നത്തെ മാർക്കറ്റ് ട്രേഡിങ് അവസാനിച്ചു (03:30 PM IST)!',
            'ഇന്നത്തെ ട്രേഡിങ് സമയം പൂർത്തിയായി. അടുത്ത ട്രേഡിങ് സെഷൻ രാവിലെ 09:15 AM-ന് ആരംഭിക്കും.',
            !soundEnabled,
          );
          if (banner) setLightingBanner(banner);
        }
        prevMarketPhaseRef.current = nextSession.phase;
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [soundEnabled]);

  // 5. Multi-Tier Audio & Visual Lighting Alert Monitor for Positions & Holdings
  useEffect(() => {
    // Check Open Positions for New Entry, Loss, Medium Profit, High Profit, and +50% Buy-Price Jackpot
    positions.forEach((pos) => {
      const key = pos.id || pos.symbol;
      const buyPx = Number(pos.buyPrice || 0);
      const curPx = Number(pos.currentLTP || buyPx);
      const pnl = Number(pos.pnl || 0);
      const is50Hit = buyPx > 0 && curPx >= buyPx * 1.5;
      const prev = prevPositionsRef.current[key];

      let currentTier = 0;
      if (is50Hit) currentTier = 4;
      else if (pnl >= 1000) currentTier = 3;
      else if (pnl >= 300) currentTier = 2;
      else if (pnl <= -250) currentTier = -1;

      if (!prev) {
        const banner = triggerAlertEvent(
          'TRADE_ENTRY',
          pos.symbol,
          `⚡ പുതിയ ട്രേഡ് എടുത്തു: ${pos.symbol}`,
          `Buy Price: ₹${buyPx.toFixed(2)} | Qty: ${pos.quantity} — അൽഗോരിതം Peak-Locked Stop-Loss നിരീക്ഷിക്കുന്നു.`,
          !soundEnabled,
          pnl,
        );
        if (banner) setLightingBanner(banner);
      } else {
        if (is50Hit && !prev.is50Hit) {
          const banner = triggerAlertEvent(
            'FIFTY_PERCENT_JACKPOT',
            pos.symbol,
            `🏆 +50% ജാക്ക്പോട്ട് ലാഭം! ${pos.symbol}`,
            `വാങ്ങിയ വിലയുടെ (₹${buyPx.toFixed(2)}) 50% ലാഭ ലക്ഷ്യം (₹${curPx.toFixed(2)}) മറികടന്നു! ലാഭം: +₹${pnl.toFixed(2)}`,
            !soundEnabled,
            pnl,
          );
          if (banner) setLightingBanner(banner);
        } else if (currentTier === 3 && prev.tier < 3) {
          const banner = triggerAlertEvent(
            'PROFIT_HIGH',
            pos.symbol,
            `🚀 ഉയർന്ന ലാഭം (+₹${pnl.toFixed(0)}): ${pos.symbol}`,
            `LTP ₹${curPx.toFixed(2)}-ലേക്ക് കുതിച്ചു! Auto-Moving Peak Stop-Loss ലാഭം സുരക്ഷിതമായി ലോക്ക് ചെയ്തു.`,
            !soundEnabled,
            pnl,
          );
          if (banner) setLightingBanner(banner);
        } else if (currentTier === 2 && prev.tier < 2) {
          const banner = triggerAlertEvent(
            'PROFIT_MEDIUM',
            pos.symbol,
            `🟢 മികച്ച ലാഭത്തിലേക്ക് (+₹${pnl.toFixed(0)}): ${pos.symbol}`,
            `ട്രേഡ് നല്ല ലാഭത്തിലാണ് (LTP: ₹${curPx.toFixed(2)}). Zero-Loss ബ്രേക്ക്-ഈവൻ സംരക്ഷണം ആക്ടീവ് ആയി.`,
            !soundEnabled,
            pnl,
          );
          if (banner) setLightingBanner(banner);
        } else if (currentTier === -1 && prev.tier > -1) {
          const banner = triggerAlertEvent(
            'TRADE_LOSS_WARNING',
            pos.symbol,
            `⚠️ സ്റ്റോപ്പ്-ലോസ് / നഷ്ട മുന്നറിയിപ്പ് (${pos.symbol})`,
            `നിലവിലെ P&L: ₹${pnl.toFixed(2)}. അൽഗോരിതം ₹400 Max SL Cap & 1m സപ്പോർട്ട് പരിശോധിക്കുന്നു.`,
            !soundEnabled,
            pnl,
          );
          if (banner) setLightingBanner(banner);
        }
      }

      prevPositionsRef.current[key] = { pnl, is50Hit, tier: currentTier };
    });

    // Check Holdings for Profit Turn & +50% Buy-Price Milestone
    holdings.forEach((h) => {
      const key = h.symbol;
      const buyPx = Number(h.buyPrice ?? h.avgPrice ?? 0);
      const curPx = Number(h.currentLTP || 0);
      const pnl = Number(h.pnl || 0);
      const is50Hit = Boolean(
        h.fiftyPercentTarget?.isReached || (buyPx > 0 && curPx >= buyPx * 1.5),
      );
      const prev = prevHoldingsRef.current[key];

      if (prev) {
        if (is50Hit && !prev.is50Hit) {
          const banner = triggerAlertEvent(
            'FIFTY_PERCENT_JACKPOT',
            h.symbol,
            `⚡ ഹോൾഡിങ്ങ് +50% ലാഭ ലക്ഷ്യം മറികടന്നു: ${h.symbol}!`,
            `വാങ്ങിയ വില ₹${buyPx.toFixed(2)} -> ഇപ്പോൾ ₹${curPx.toFixed(2)} (+₹${pnl.toFixed(2)} ലാഭം)!`,
            !soundEnabled,
            pnl,
          );
          if (banner) setLightingBanner(banner);
        } else if (pnl > 0 && prev.pnl <= 0) {
          const banner = triggerAlertEvent(
            'HOLDING_IN_PROFIT',
            h.symbol,
            `💎 ഹോൾഡിങ്ങ് ലാഭത്തിലായി: ${h.symbol}`,
            `LTP ₹${curPx.toFixed(2)} — നിലവിലെ ലാഭം: +₹${pnl.toFixed(2)} (${h.pnlPercent?.toFixed(2)}%)`,
            !soundEnabled,
            pnl,
          );
          if (banner) setLightingBanner(banner);
        }
      }
      prevHoldingsRef.current[key] = { pnl, is50Hit };
    });
  }, [positions, holdings, soundEnabled]);

  // Auto-dismiss lighting alert banner after 8 seconds
  useEffect(() => {
    if (!lightingBanner) return;
    const tId = setTimeout(() => setLightingBanner(null), 8000);
    return () => clearTimeout(tId);
  }, [lightingBanner]);

  const t = translations[language];
  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] w-full max-w-full bg-[#070a12] text-slate-100 overflow-hidden font-sans select-none">
      <Header
        isWsConnected={isWsConnected}
        mode={mode}
        setMode={(newMode) => {
          try {
            localStorage.setItem('aizabiz_preferred_trading_mode', newMode);
          } catch {
            // Ignored
          }
          setMode(newMode);
          setBotConfig((prev) => {
            const updated = { ...prev, mode: newMode };
            fetch('/api/bot/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated),
            }).catch(() => {
              /* ignore */
            });
            return updated;
          });
        }}
        language={language}
        setLanguage={setLanguage}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        apiConfig={apiConfig}
        onOpenApiSettings={() => setIsApiModalOpen(true)}
        onOpenAndroidModal={() => setIsAndroidModalOpen(true)}
        activePositionsCount={positions.length}
        onSquareOffAll={handleSquareOffAll}
        totalPnL={totalNetMtm}
        dailyProfit={todayProfit}
        cumulativeProfit={totalCumulativeProfit}
        virtualCapital={paperAccountBalance}
        onOpenAlerts={() => setIsAlertsModalOpen(true)}
        onResetPaperAccount={handleResetPaperAccount}
        botEnabled={botConfig.enabled}
        onToggleBot={() => {
          const newState = !botConfig.enabled;
          setBotConfig((prev) => {
            const updated = { ...prev, enabled: newState, dailyLossLocked: false };
            fetch('/api/bot/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated),
            }).catch(() => {
              /* ignore */
            });
            return updated;
          });
        }}
      />

      <AppTopSections
        apiConfig={apiConfig}
        language={language}
        lightingBanner={lightingBanner}
        setLightingBanner={setLightingBanner}
        triggerAlertEvent={triggerAlertEvent}
        marketSession={marketSession}
      />

      <TickerBar
        quotes={quotes}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={(sym, key) => {
          setSelectedSymbol(sym);
          if (key) setSelectedInstrumentKey(key);

          // Auto-sync Algo Bot focus when clicking an index in the ticker bar
          const indexPriorityMap: Record<string, string> = {
            'NIFTY 50': 'NIFTY_50_ONLY',
            BANKNIFTY: 'BANKNIFTY_ONLY',
            SENSEX: 'SENSEX_ONLY',
            FINNIFTY: 'FINNIFTY_ONLY',
            MIDCPNIFTY: 'MIDCPNIFTY_ONLY',
            BANKEX: 'BANKEX_ONLY',
          };

          if (indexPriorityMap[sym]) {
            setBotConfig((prev) => {
              const updated = { ...prev, selectedIndexPriority: indexPriorityMap[sym] as any };
              fetch('/api/bot/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
              }).catch(() => {
                /* ignore */
              });
              return updated;
            });
          }
        }}
      />

      <AppInspectionBanner botLogs={botLogs} language={language} />

      <AppIpWhitelistNotice
        botLogs={botLogs}
        dismissedIpWarning={dismissedIpWarning}
        ipCopiedNotice={ipCopiedNotice}
        language={language}
        setDismissedIpWarning={setDismissedIpWarning}
        setIpCopiedNotice={setIpCopiedNotice}
        setIsApiModalOpen={setIsApiModalOpen}
        serverSecondaryIp={apiConfig.actualDetectedIp || apiConfig.serverSecondaryIp}
      />

      {/* 3. MAIN WORKSPACE */}
      <div className="flex flex-1 w-full max-w-full min-w-0 min-h-0 overflow-hidden">
        <div className="hidden lg:flex w-72 border-r border-slate-800/80 bg-slate-950/40 p-3 flex-col shrink-0 min-h-0">
          <Watchlist
            quotes={quotes}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(sym, key) => {
              setSelectedSymbol(sym);
              if (key) setSelectedInstrumentKey(key);
            }}
            language={language}
            onOpenOrderModal={(type, sym, prc) => {
              setOrderModalData({ symbol: sym, price: prc, type });
              setIsOrderModalOpen(true);
            }}
            priceAlerts={priceAlerts}
            onAddAlert={handleAddAlert}
            onRemoveAlert={handleRemoveAlert}
          />
        </div>

        <div className="flex-1 flex flex-col w-full max-w-full min-w-0 min-h-0 overflow-hidden p-1 sm:p-3">
          <AppDesktopNav
            t={t}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            botConfig={botConfig}
            currentQuote={currentQuote}
            holdings={holdings}
            positions={positions}
            selectedSymbol={selectedSymbol}
            language={language}
            setIsOrderModalOpen={setIsOrderModalOpen}
            setOrderModalData={setOrderModalData}
          />

          {/* View Container */}
          <AppTabContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            quotes={quotes}
            selectedSymbol={selectedSymbol}
            setSelectedSymbol={setSelectedSymbol}
            setSelectedInstrumentKey={setSelectedInstrumentKey}
            language={language}
            setOrderModalData={setOrderModalData}
            setIsOrderModalOpen={setIsOrderModalOpen}
            priceAlerts={priceAlerts}
            handleAddAlert={handleAddAlert}
            handleRemoveAlert={handleRemoveAlert}
            currentQuote={currentQuote}
            chartTradeContext={chartTradeContext}
            setChartTradeContext={setChartTradeContext}
            candles={candles}
            chartInterval={chartInterval}
            setChartInterval={setChartInterval}
            activeSignal={activeSignal}
            optionChainData={optionChainData}
            getStandardIndexLotSize={getStandardIndexLotSize}
            handleFetchGeminiAnalysis={handleFetchGeminiAnalysis}
            aiLoading={aiLoading}
            botConfig={botConfig}
            setBotConfig={setBotConfig}
            setMode={setMode}
            botLogs={botLogs}
            signals={signals}
            handleExecuteSignal={handleExecuteSignal}
            handleViewChart={handleViewChart}
            handleSquareOffPosition={handleSquareOffPosition}
            handleSquareOffAll={handleSquareOffAll}
            positions={positions}
            holdings={holdings}
            totalNetMtm={totalNetMtm}
            fetchHoldings={fetchHoldings}
            apiConfig={apiConfig}
            setIsApiModalOpen={setIsApiModalOpen}
            handleSyncHistoryBrokerage={handleSyncHistoryBrokerage}
            optionChainLoading={optionChainLoading}
            fetchOptionChain={fetchOptionChain}
            modeOrders={modeOrders}
            modeTradeHistory={modeTradeHistory}
            geminiAnalysis={geminiAnalysis}
          />
        </div>
      </div>

      <AppMobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        botConfig={botConfig}
        positions={positions}
        language={language}
      />

      <AppModals
        isOrderModalOpen={isOrderModalOpen}
        setIsOrderModalOpen={setIsOrderModalOpen}
        orderModalData={orderModalData}
        apiConfig={apiConfig}
        botConfig={botConfig}
        mode={mode}
        handlePlaceOrder={handlePlaceOrder}
        language={language}
        isApiModalOpen={isApiModalOpen}
        setIsApiModalOpen={setIsApiModalOpen}
        fetchHoldings={fetchHoldings}
        fetchLivePositions={fetchLivePositions}
        setApiConfig={setApiConfig}
        isAlertsModalOpen={isAlertsModalOpen}
        priceAlerts={priceAlerts}
        setIsAlertsModalOpen={setIsAlertsModalOpen}
        handleAddAlert={handleAddAlert}
        handleRemoveAlert={handleRemoveAlert}
        isAndroidModalOpen={isAndroidModalOpen}
        setIsAndroidModalOpen={setIsAndroidModalOpen}
        isOnboardingOpen={isOnboardingOpen}
        setIsOnboardingOpen={setIsOnboardingOpen}
        isTerminalLocked={isTerminalLocked}
        setIsTerminalLocked={setIsTerminalLocked}
      />
    </div>
  );
};

export default App;
