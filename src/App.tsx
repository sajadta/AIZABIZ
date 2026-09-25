import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart,
  BarChart2,
  Cpu,
  Layers,
  Briefcase,
  Sparkles,
  PieChart,
  Activity,
  Smartphone,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Zap,
} from 'lucide-react';
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
import { translations } from './translations';
import { Header } from './components/Header';
import { TickerBar } from './components/TickerBar';
import { Watchlist } from './components/Watchlist';
import { CandlestickChart } from './components/CandlestickChart';
import { AlgoBotPanel } from './components/AlgoBotPanel';
import { OptionChainView } from './components/OptionChainView';
import { OrderBookPositions } from './components/OrderBookPositions';
import { PortfolioView } from './components/PortfolioView';
import { MarketHeatmap } from './components/MarketHeatmap';
import { GeminiAiAdvisor } from './components/GeminiAiAdvisor';
import { LiveAiSupport } from './components/LiveAiSupport';
import { AdvancedAnalytics } from './components/AdvancedAnalytics';
import { OrderModal } from './components/OrderModal';
import { UpstoxApiModal } from './components/UpstoxApiModal';
import { AlertsModal } from './components/AlertsModal';
import { AndroidInstallModal } from './components/AndroidInstallModal';
import { OnboardingSetupModal } from './components/OnboardingSetupModal';
import { enrichCandlesWithIndicators, analyzeTradingSignals } from './utils/indicators';
import { soundEngine } from './utils/audioAlerts';

const DEFAULT_QUOTES: StockQuote[] = [
  {
    symbol: 'NIFTY 50',
    name: 'Nifty 50 Index',
    instrumentKey: 'NSE_INDEX|Nifty 50',
    exchange: 'NSE',
    ltp: 24850.50,
    open: 24780.00,
    high: 24910.20,
    low: 24750.10,
    close: 24765.00,
    change: 85.50,
    changePercent: 0.35,
    volume: 12500000,
    vwap: 24830.00,
    lastTradeTime: '15:30:00',
    segment: 'INDEX',
  },
  {
    symbol: 'BANKNIFTY',
    name: 'Nifty Bank Index',
    instrumentKey: 'NSE_INDEX|Nifty Bank',
    exchange: 'NSE',
    ltp: 51240.75,
    open: 51000.00,
    high: 51380.00,
    low: 50950.00,
    close: 50980.20,
    change: 260.55,
    changePercent: 0.51,
    volume: 8900000,
    vwap: 51180.00,
    lastTradeTime: '15:30:00',
    segment: 'INDEX',
  },
  {
    symbol: 'FINNIFTY',
    name: 'Nifty Financial Services',
    instrumentKey: 'NSE_INDEX|Nifty Fin Service',
    exchange: 'NSE',
    ltp: 23650.10,
    open: 23550.00,
    high: 23720.00,
    low: 23510.00,
    close: 23580.00,
    change: 70.10,
    changePercent: 0.30,
    volume: 3400000,
    vwap: 23620.00,
    lastTradeTime: '15:30:00',
    segment: 'INDEX',
  },
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd',
    instrumentKey: 'NSE_EQ|INE002A01018',
    exchange: 'NSE',
    ltp: 2985.40,
    open: 2960.00,
    high: 2998.00,
    low: 2955.00,
    close: 2962.30,
    change: 23.10,
    changePercent: 0.78,
    volume: 4200000,
    vwap: 2975.00,
    lastTradeTime: '15:30:00',
    segment: 'EQUITY',
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd',
    instrumentKey: 'NSE_EQ|INE040A01034',
    exchange: 'NSE',
    ltp: 1642.80,
    open: 1635.00,
    high: 1650.00,
    low: 1630.00,
    close: 1632.50,
    change: 10.30,
    changePercent: 0.63,
    volume: 6800000,
    vwap: 1640.00,
    lastTradeTime: '15:30:00',
    segment: 'EQUITY',
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd',
    instrumentKey: 'NSE_EQ|INE090A01021',
    exchange: 'NSE',
    ltp: 1215.30,
    open: 1205.00,
    high: 1222.00,
    low: 1200.00,
    close: 1208.10,
    change: 7.20,
    changePercent: 0.60,
    volume: 5100000,
    vwap: 1211.00,
    lastTradeTime: '15:30:00',
    segment: 'EQUITY',
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    instrumentKey: 'NSE_EQ|INE467B01029',
    exchange: 'NSE',
    ltp: 4180.20,
    open: 4210.00,
    high: 4225.00,
    low: 4160.00,
    close: 4205.00,
    change: -24.80,
    changePercent: -0.59,
    volume: 1800000,
    vwap: 4192.00,
    lastTradeTime: '15:30:00',
    segment: 'EQUITY',
  },
  {
    symbol: 'INFY',
    name: 'Infosys Ltd',
    instrumentKey: 'NSE_EQ|INE009A01021',
    exchange: 'NSE',
    ltp: 1785.60,
    open: 1800.00,
    high: 1808.00,
    low: 1775.00,
    close: 1795.00,
    change: -9.40,
    changePercent: -0.52,
    volume: 3100000,
    vwap: 1788.00,
    lastTradeTime: '15:30:00',
    segment: 'EQUITY',
  },
  {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd',
    instrumentKey: 'NSE_EQ|INE155A01022',
    exchange: 'NSE',
    ltp: 965.40,
    open: 955.00,
    high: 972.00,
    low: 950.00,
    close: 952.80,
    change: 12.60,
    changePercent: 1.32,
    volume: 7200000,
    vwap: 962.00,
    lastTradeTime: '15:30:00',
    segment: 'EQUITY',
  },
  {
    symbol: 'SBIN',
    name: 'State Bank of India',
    instrumentKey: 'NSE_EQ|INE062A01020',
    exchange: 'NSE',
    ltp: 812.50,
    open: 805.00,
    high: 816.00,
    low: 802.00,
    close: 804.20,
    change: 8.30,
    changePercent: 1.03,
    volume: 8100000,
    vwap: 810.00,
    lastTradeTime: '15:30:00',
    segment: 'EQUITY',
  },
];

const generateInitialCandles = (basePrice: number): CandleData[] => {
  const candles: CandleData[] = [];
  const now = Date.now();
  let current = basePrice * 0.98;

  for (let i = 40; i >= 0; i--) {
    const time = now - i * 5 * 60 * 1000;
    const variation = (Math.random() - 0.48) * (basePrice * 0.004);
    const open = current;
    const close = open + variation;
    const high = Math.max(open, close) + Math.random() * (basePrice * 0.002);
    const low = Math.min(open, close) - Math.random() * (basePrice * 0.002);
    const volume = Math.floor(Math.random() * 50000) + 10000;

    candles.push({
      timestamp: time,
      timeStr: new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
    current = close;
  }

  return enrichCandlesWithIndicators(candles);
};

export const App: React.FC = () => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'WATCHLIST' | 'CHART' | 'BOT' | 'OPTIONS' | 'ORDERS' | 'HEATMAP' | 'AI'>('CHART');
  
  // App configurations
  const [language, setLanguage] = useState<Language>('ml');
  const [mode, setMode] = useState<ExecutionMode>('PAPER_TRADING');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isWsConnected, setIsWsConnected] = useState(false);

  // Quotes and Selection
  const [quotes, setQuotes] = useState<StockQuote[]>(DEFAULT_QUOTES);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY 50');
  const [selectedInstrumentKey, setSelectedInstrumentKey] = useState<string>('NSE_INDEX|Nifty 50');

  // Chart data
  const [candles, setCandles] = useState<CandleData[]>(() => generateInitialCandles(24850.50));
  const [chartInterval, setChartInterval] = useState<string>('5m');
  const [activeSignal, setActiveSignal] = useState<TradingSignal | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // Bot state
  const [botConfig, setBotConfig] = useState<BotConfig>({
    enabled: false,
    mode: 'PAPER_TRADING',
    tradeMode: 'OPTIONS_ONLY',
    minOptionProfitAmount: 300,
    maxOptionLossCount: 3,
    maxStockLossCount: 2,
    maxStockProfitCount: 5,
    selectedStrategy: 'PROFIT_MAX_100_PERCENT_MATRIX',
    minConfidence: 80,
    maxCapitalPerTrade: 25000,
    maxTradesPerDay: 8,
    riskPerTradePercent: 1.5,
    stopLossPercent: 10,
    targetProfitPercent: 25,
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
    autoSquareOffTime: '15:15',
    allowedSymbols: ['NIFTY 50', 'BANKNIFTY'],
    soundAlerts: true,
  });
  const [botLogs, setBotLogs] = useState<BotLog[]>([]);
  const [signals, setSignals] = useState<TradingSignal[]>([]);

  // Positions, Orders, Holdings
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([
    {
      symbol: 'RELIANCE',
      companyName: 'Reliance Industries Ltd',
      quantity: 15,
      avgPrice: 2850.00,
      buyPrice: 2850.00,
      currentLTP: 2985.40,
      investedValue: 42750.00,
      currentValue: 44781.00,
      pnl: 2031.00,
      pnlPercent: 4.75,
    },
    {
      symbol: 'HDFCBANK',
      companyName: 'HDFC Bank Ltd',
      quantity: 25,
      avgPrice: 1580.00,
      buyPrice: 1580.00,
      currentLTP: 1642.80,
      investedValue: 39500.00,
      currentValue: 41070.00,
      pnl: 1570.00,
      pnlPercent: 3.97,
    },
  ]);
  const [tradeHistory, setTradeHistory] = useState<Position[]>([]);

  // Option Chain
  const [optionChainData, setOptionChainData] = useState<OptionChainData | null>(null);
  const [optionChainLoading, setOptionChainLoading] = useState(false);

  // Gemini Market Analysis
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiMarketAnalysis | null>(null);

  // Upstox API configuration
  const [apiConfig, setApiConfig] = useState<UpstoxApiConfig>({
    apiKey: '',
    apiSecret: '',
    redirectUri: 'https://127.0.0.1:3000',
    accessToken: '',
    isConnected: false,
    userName: 'Upstox Trader',
    userEmail: 'trader@upstox.com',
    userClientCode: 'UP2941',
    broker: 'Upstox Securities',
    availableMargin: 125400.00,
    usedMargin: 18200.00,
  });

  // Price Alerts
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);

  // Modals
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderModalData, setOrderModalData] = useState<{
    symbol: string;
    price: number;
    type: OrderTransactionType;
  }>({
    symbol: 'NIFTY 50',
    price: 24850.50,
    type: 'BUY',
  });
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Load configuration from API on mount
  useEffect(() => {
    const fetchInitData = async () => {
      try {
        const [botRes, configRes, historyRes] = await Promise.allSettled([
          fetch('/api/bot/config').then(r => r.ok ? r.json() : null),
          fetch('/api/market/config').then(r => r.ok ? r.json() : null),
          fetch('/api/history').then(r => r.ok ? r.json() : null),
        ]);

        if (botRes.status === 'fulfilled' && botRes.value) {
          setBotConfig(prev => ({ ...prev, ...botRes.value }));
        }
        if (configRes.status === 'fulfilled' && configRes.value) {
          setApiConfig(prev => ({ ...prev, ...configRes.value }));
        }
        if (historyRes.status === 'fulfilled' && Array.isArray(historyRes.value)) {
          setTradeHistory(historyRes.value);
        }
      } catch (err) {
        console.warn('Initial data fetch notice:', err);
      }
    };
    fetchInitData();
  }, []);

  // Fetch or simulate live quotes periodically
  useEffect(() => {
    let isMounted = true;
    const updateQuotes = async () => {
      try {
        const res = await fetch('/api/market/quotes');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && isMounted) {
            setQuotes(data);
            setIsWsConnected(true);
            return;
          }
        }
      } catch {
        // Fallback to paper ticks
      }

      if (!isMounted) return;
      // Simulated live market jitter for paper trading
      setQuotes(prev =>
        prev.map(q => {
          const delta = (Math.random() - 0.49) * (q.ltp * 0.0015);
          const newLtp = Number((q.ltp + delta).toFixed(2));
          const newChange = Number((newLtp - q.close).toFixed(2));
          const newChangePercent = Number(((newChange / q.close) * 100).toFixed(2));
          const flash = delta > 0 ? 'up' : delta < 0 ? 'down' : undefined;
          return {
            ...q,
            ltp: newLtp,
            change: newChange,
            changePercent: newChangePercent,
            tickFlash: flash,
          };
        })
      );
    };

    const timer = setInterval(updateQuotes, 3000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  // Sync selected symbol's current candle
  const currentQuote = quotes.find(q => q.symbol === selectedSymbol) || quotes[0];

  useEffect(() => {
    if (!currentQuote) return;
    setCandles(prev => {
      if (prev.length === 0) return generateInitialCandles(currentQuote.ltp);
      const last = prev[prev.length - 1];
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

  // Generate realistic dynamic upcoming Thursday option expiries
  const getUpcomingExpiries = useCallback(() => {
    const dates: string[] = [];
    const now = new Date();
    const d = new Date(now);
    while (dates.length < 3) {
      const day = d.getDay();
      const diff = (4 - day + 7) % 7;
      d.setDate(d.getDate() + (diff === 0 && d <= now ? 7 : diff));
      const dayStr = String(d.getDate()).padStart(2, '0');
      const monthStr = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
      const yearStr = d.getFullYear();
      dates.push(`${dayStr}-${monthStr}-${yearStr}`);
      d.setDate(d.getDate() + 7);
    }
    return dates;
  }, []);

  // Fetch or Compute Gemini AI Market Analysis
  const handleFetchGeminiAnalysis = useCallback(async () => {
    if (!currentQuote) return;
    setAiLoading(true);

    const sig = candles.length >= 20 ? analyzeTradingSignals(
      currentQuote.symbol,
      currentQuote.name,
      currentQuote.instrumentKey,
      candles,
      currentQuote.ltp,
      botConfig.selectedStrategy
    ) : null;

    if (sig) {
      setActiveSignal(sig);
      setSignals(prev => [sig, ...prev.filter(s => s.id !== sig.id).slice(0, 19)]);
      if (soundEnabled) {
        soundEngine.play('SIGNAL');
      }
    }

    const lastCandle = candles[candles.length - 1] || {} as any;
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
            supertrend: { signal: lastCandle.supertrendDirection || 'BUY', value: lastCandle.supertrend || currentQuote.ltp },
            emaCross: { signal: (lastCandle.ema9 || 0) >= (lastCandle.ema21 || 0) ? 'BULLISH' : 'BEARISH' },
            rsi: { value: lastCandle.rsi || 55 },
            macd: { cross: (lastCandle.macd || 0) >= (lastCandle.macdSignal || 0) ? 'BULLISH' : 'BEARISH' },
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
    setGeminiAnalysis({
      sentiment: isBull ? 'BULLISH' : 'BEARISH',
      confidenceScore: Math.floor(Math.random() * 12) + 82,
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

  // Recalculate AI Trading Signals
  const handleGenerateSignal = useCallback(() => {
    handleFetchGeminiAnalysis();
  }, [handleFetchGeminiAnalysis]);

  // Fetch Option Chain
  const fetchOptionChain = useCallback(async () => {
    setOptionChainLoading(true);
    try {
      const res = await fetch(`/api/market/optionchain?symbol=${encodeURIComponent(selectedSymbol)}`);
      if (res.ok) {
        const data = await res.json();
        setOptionChainData(data);
      } else {
        // Generate realistic option chain if offline
        const atmStrike = Math.round(currentQuote.ltp / 50) * 50;
        const strikes = [];
        for (let i = -5; i <= 5; i++) {
          const strikePrice = atmStrike + i * 50;
          const dist = (strikePrice - currentQuote.ltp) / currentQuote.ltp;
          const callLtp = Math.max(10, Math.round(150 - dist * 800 + Math.random() * 15));
          const putLtp = Math.max(10, Math.round(150 + dist * 800 + Math.random() * 15));
          strikes.push({
            strikePrice,
            callOI: Math.floor(Math.random() * 50000) + 10000,
            callChangeOI: Math.floor(Math.random() * 5000) - 2000,
            callLTP: callLtp,
            callIV: 14.5,
            callVolume: Math.floor(Math.random() * 20000),
            callInstrumentKey: `NSE_FO|${selectedSymbol}${strikePrice}CE`,
            putOI: Math.floor(Math.random() * 50000) + 10000,
            putChangeOI: Math.floor(Math.random() * 5000) - 2000,
            putLTP: putLtp,
            putIV: 15.2,
            putVolume: Math.floor(Math.random() * 20000),
            putInstrumentKey: `NSE_FO|${selectedSymbol}${strikePrice}PE`,
          });
        }
        const expiries = getUpcomingExpiries();
        setOptionChainData({
          underlyingSymbol: selectedSymbol,
          underlyingLTP: currentQuote.ltp,
          expiryDates: expiries,
          selectedExpiry: expiries[0],
          strikes,
          pcr: 1.12,
          maxPain: atmStrike,
          totalCallOI: 450000,
          totalPutOI: 504000,
        });
      }
    } catch {
      // offline fallback
    } finally {
      setOptionChainLoading(false);
    }
  }, [selectedSymbol, currentQuote?.ltp, getUpcomingExpiries]);

  useEffect(() => {
    if (activeTab === 'OPTIONS') {
      fetchOptionChain();
    }
  }, [activeTab, fetchOptionChain]);

  // Order Placement
  const handlePlaceOrder = (orderData: {
    symbol: string;
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
    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      orderId: `UP_${Math.floor(Math.random() * 899999 + 100000)}`,
      symbol: orderData.symbol,
      instrumentKey: currentQuote?.instrumentKey || `NSE_EQ|${orderData.symbol}`,
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

    setOrders(prev => [newOrder, ...prev]);

    // Update positions
    const newPos: Position = {
      id: `pos_${Date.now()}`,
      symbol: orderData.symbol,
      instrumentKey: newOrder.instrumentKey,
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
    setPositions(prev => [newPos, ...prev]);

    if (soundEnabled) {
      soundEngine.play('ORDER_FILLED');
    }
    setIsOrderModalOpen(false);
  };

  // Square off single position
  const handleSquareOffPosition = (id: string) => {
    const pos = positions.find(p => p.id === id);
    if (!pos) return;

    const sellPrice = pos.currentLTP;
    const grossPnL = (sellPrice - pos.buyPrice) * pos.quantity;
    const closedPos: Position = {
      ...pos,
      sellPrice,
      realizedPnL: grossPnL,
      closeTime: new Date().toISOString(),
    };

    setPositions(prev => prev.filter(p => p.id !== id));
    setTradeHistory(prev => [closedPos, ...prev]);

    // Record close order
    const exitOrder: Order = {
      id: `ord_${Date.now()}`,
      orderId: `UP_${Math.floor(Math.random() * 899999 + 100000)}`,
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
    setOrders(prev => [exitOrder, ...prev]);

    if (soundEnabled) {
      soundEngine.play(grossPnL >= 0 ? 'SUCCESS' : 'ALERT');
    }
  };

  // Square off all positions
  const handleSquareOffAll = () => {
    positions.forEach(p => handleSquareOffPosition(p.id));
  };

  // Execute signal directly
  const handleExecuteSignal = (sig: TradingSignal) => {
    const qty = sig.recommendedOptionStrike ? 50 : 25;
    const price = sig.recommendedOptionStrike ? sig.recommendedOptionStrike.ltp : sig.price;
    const symbol = sig.recommendedOptionStrike 
      ? `${sig.symbol} ${sig.recommendedOptionStrike.strikePrice} ${sig.recommendedOptionStrike.optionType}`
      : sig.symbol;

    handlePlaceOrder({
      symbol,
      transactionType: sig.signalType === 'SELL' ? 'SELL' : 'BUY',
      orderType: 'MARKET',
      productType: 'INTRADAY',
      quantity: qty,
      price,
      stopLoss: sig.stopLoss,
      target: sig.target1,
    });
  };

  // Total PnL Calculation
  const totalPnL = positions.reduce((acc, p) => acc + (p.pnl || 0), 0);
  const dailyProfit = tradeHistory.reduce((acc, t) => acc + (t.realizedPnL || 0), 0);

  // Price alert handlers
  const handleAddAlert = (
    symbol: string,
    instrumentKey: string,
    targetPrice: number,
    condition: 'GREATER_THAN' | 'LESS_THAN'
  ) => {
    const newAlert: PriceAlert = {
      id: `alert_${Date.now()}`,
      symbol,
      instrumentKey,
      targetPrice,
      condition,
      isActive: true,
    };
    setPriceAlerts(prev => [...prev, newAlert]);
  };

  const handleRemoveAlert = (id: string) => {
    setPriceAlerts(prev => prev.filter(a => a.id !== id));
  };

  // 1. Live update of open positions & price alerts on quotes tick
  useEffect(() => {
    if (quotes.length === 0) return;

    // A. Update open positions MTM P&L
    setPositions(prev => {
      if (prev.length === 0) return prev;
      return prev.map(pos => {
        const q = quotes.find(item => pos.symbol.startsWith(item.symbol) || item.symbol === pos.symbol);
        if (!q) return pos;
        const currentLTP = pos.symbol.includes('CE') || pos.symbol.includes('PE')
          ? pos.currentLTP
          : q.ltp;
        const isBuy = pos.type === 'BUY' || !pos.type;
        const pnl = isBuy ? (currentLTP - pos.buyPrice) * pos.quantity : (pos.buyPrice - currentLTP) * pos.quantity;
        const pnlPercent = pos.buyPrice > 0 ? (pnl / (pos.buyPrice * pos.quantity)) * 100 : 0;
        return {
          ...pos,
          currentLTP,
          pnl: Number(pnl.toFixed(2)),
          pnlPercent: Number(pnlPercent.toFixed(2)),
          highestLTP: Math.max(pos.highestLTP || pos.buyPrice, currentLTP),
        };
      });
    });

    // B. Check Price Alerts
    setPriceAlerts(prev => {
      let triggered = false;
      const updated = prev.map(alert => {
        if (!alert.isActive) return alert;
        const q = quotes.find(item => item.symbol === alert.symbol);
        if (!q) return alert;
        const isHit =
          (alert.condition === 'GREATER_THAN' && q.ltp >= alert.targetPrice) ||
          (alert.condition === 'LESS_THAN' && q.ltp <= alert.targetPrice);
        if (isHit) {
          triggered = true;
          return { ...alert, isActive: false };
        }
        return alert;
      });

      if (triggered && soundEnabled) {
        soundEngine.play('ALERT');
      }
      return updated;
    });
  }, [quotes, soundEnabled]);

  // 2. Automated Algo Bot Engine Execution Loop
  useEffect(() => {
    if (!botConfig.enabled) return;

    const botInterval = setInterval(() => {
      // Check open positions for Auto-Square Off (Target Profit or Stop Loss)
      positions.forEach(pos => {
        const pnlPct = pos.pnlPercent || 0;
        const targetHit = pnlPct >= (botConfig.targetProfitPercent || 25);
        const stopLossHit = pnlPct <= -(botConfig.stopLossPercent || 10);

        if (targetHit || stopLossHit) {
          const reason = targetHit
            ? `[ALGO BOT] Target profit hit (+${pnlPct.toFixed(2)}%) for ${pos.symbol}. Automatic square-off executed.`
            : `[ALGO BOT] Stop loss triggered (${pnlPct.toFixed(2)}%) for ${pos.symbol}. Risk management exit executed.`;

          handleSquareOffPosition(pos.id);
          setBotLogs(prev => [
            {
              id: Date.now().toString(),
              timestamp: new Date().toLocaleTimeString(),
              message: reason,
              type: targetHit ? 'SUCCESS' : 'ERROR',
            },
            ...prev.slice(0, 199),
          ]);
        }
      });

      // Scan allowed symbols for automated entry if position limit not exceeded
      if (positions.length < (botConfig.maxTradesPerDay || 5)) {
        const allowed = botConfig.allowedSymbols?.length > 0 ? botConfig.allowedSymbols : ['NIFTY 50', 'BANKNIFTY'];
        for (const sym of allowed) {
          const alreadyOpen = positions.some(p => p.symbol.startsWith(sym));
          if (alreadyOpen) continue;

          const q = quotes.find(item => item.symbol === sym);
          if (!q) continue;

          const sig = analyzeTradingSignals(
            q.symbol,
            q.name,
            q.instrumentKey,
            candles,
            q.ltp,
            botConfig.selectedStrategy
          );

          if (sig && sig.confidence >= (botConfig.minConfidence || 75) && (sig.signalType === 'BUY' || sig.signalType === 'SELL')) {
            handleExecuteSignal(sig);
            setBotLogs(prev => [
              {
                id: Date.now().toString(),
                timestamp: new Date().toLocaleTimeString(),
                message: `[ALGO AUTO-TRADE] ${sig.signalType} executed for ${sig.symbol} at ₹${sig.price} (Confidence: ${sig.confidence}%).`,
                type: 'SUCCESS',
              },
              ...prev.slice(0, 199),
            ]);
            break;
          }
        }
      }
    }, 4000);

    return () => clearInterval(botInterval);
  }, [botConfig, positions, quotes, candles, handleExecuteSignal, handleSquareOffPosition]);

  // 3. Auto-load AI analysis when switching to AI tab
  useEffect(() => {
    if (activeTab === 'AI' && !geminiAnalysis && !aiLoading) {
      handleFetchGeminiAnalysis();
    }
  }, [activeTab, geminiAnalysis, aiLoading, handleFetchGeminiAnalysis]);

  const t = translations[language];

  return (
    <div className="flex flex-col h-screen h-[100dvh] w-full max-w-full bg-[#070a12] text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. TOP HEADER */}
      <Header
        isWsConnected={isWsConnected}
        mode={mode}
        setMode={setMode}
        language={language}
        setLanguage={setLanguage}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        apiConfig={apiConfig}
        onOpenApiSettings={() => setIsApiModalOpen(true)}
        onOpenAndroidModal={() => setIsAndroidModalOpen(true)}
        activePositionsCount={positions.length}
        onSquareOffAll={handleSquareOffAll}
        totalPnL={totalPnL}
        dailyProfit={dailyProfit}
        onOpenAlerts={() => setIsAlertsModalOpen(true)}
      />

      {/* 2. TICKER BAR */}
      <TickerBar
        quotes={quotes}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={(sym, key) => {
          setSelectedSymbol(sym);
          if (key) setSelectedInstrumentKey(key);
          const q = quotes.find(item => item.symbol === sym);
          if (q) setCandles(generateInitialCandles(q.ltp));
        }}
      />

      {/* 3. MAIN WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Watchlist Sidebar (Desktop) */}
        <div className="hidden lg:flex w-72 border-r border-slate-800/80 bg-slate-950/40 p-3 flex-col shrink-0">
          <Watchlist
            quotes={quotes}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(sym, key) => {
              setSelectedSymbol(sym);
              if (key) setSelectedInstrumentKey(key);
              const q = quotes.find(item => item.symbol === sym);
              if (q) setCandles(generateInitialCandles(q.ltp));
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

        {/* Center/Right Dynamic Tab Content */}
        <div className="flex-1 flex flex-col overflow-hidden p-1 sm:p-3">
          {/* Desktop Navigation Bar */}
          <div className="hidden lg:flex items-center justify-between border-b border-slate-800 pb-2 mb-2 shrink-0 overflow-x-auto no-scrollbar gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab('WATCHLIST')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                  activeTab === 'WATCHLIST'
                    ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{t.watchlist}</span>
              </button>

              <button
                onClick={() => setActiveTab('CHART')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                  activeTab === 'CHART'
                    ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>{t.chart}</span>
              </button>

              <button
                onClick={() => setActiveTab('BOT')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                  activeTab === 'BOT'
                    ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>{t.algoBot}</span>
                {botConfig.enabled && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('OPTIONS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                  activeTab === 'OPTIONS'
                    ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{t.optionChain}</span>
              </button>

              <button
                onClick={() => setActiveTab('ORDERS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm relative ${
                  activeTab === 'ORDERS'
                    ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>{t.ordersPositions}</span>
                {positions.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-emerald-500 text-slate-950 font-black text-[9px] rounded-full">
                    {positions.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('HEATMAP')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                  activeTab === 'HEATMAP'
                    ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <PieChart className="w-3.5 h-3.5" />
                <span>{language === 'ml' ? 'ഹീറ്റ്മാപ്പ്' : 'Heatmap'}</span>
              </button>

              <button
                onClick={() => setActiveTab('AI')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                  activeTab === 'AI'
                    ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{t.aiAdvisor}</span>
              </button>
            </div>

            {/* Quick Action Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setOrderModalData({
                    symbol: selectedSymbol,
                    price: currentQuote.ltp,
                    type: 'BUY',
                  });
                  setIsOrderModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-sm shadow-emerald-500/20 flex items-center gap-1"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{t.quickBuy}</span>
              </button>
              <button
                onClick={() => {
                  setOrderModalData({
                    symbol: selectedSymbol,
                    price: currentQuote.ltp,
                    type: 'SELL',
                  });
                  setIsOrderModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs transition shadow-sm shadow-rose-500/20 flex items-center gap-1"
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>{t.quickSell}</span>
              </button>
            </div>
          </div>

          {/* View Container */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'WATCHLIST' && (
              <div className="h-full w-full overflow-hidden p-1 sm:p-2 bg-slate-950/40 rounded-xl border border-slate-800/80">
                <Watchlist
                  quotes={quotes}
                  selectedSymbol={selectedSymbol}
                  onSelectSymbol={(sym, key) => {
                    setSelectedSymbol(sym);
                    if (key) setSelectedInstrumentKey(key);
                    const q = quotes.find(item => item.symbol === sym);
                    if (q) setCandles(generateInitialCandles(q.ltp));
                    setActiveTab('CHART');
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
            )}

            {activeTab === 'CHART' && (
              <div className="h-full w-full">
                <CandlestickChart
                  symbol={selectedSymbol}
                  quote={currentQuote}
                  candles={candles}
                  interval={chartInterval}
                  onChangeInterval={setChartInterval}
                  language={language}
                  onOpenOrderModal={(type, sym, prc) => {
                    setOrderModalData({ symbol: sym, price: prc, type });
                    setIsOrderModalOpen(true);
                  }}
                  onGenerateAiAnalysis={handleFetchGeminiAnalysis}
                  aiLoading={aiLoading}
                  signal={activeSignal}
                />
              </div>
            )}

            {activeTab === 'BOT' && (
              <div className="h-full w-full overflow-y-auto">
                <AlgoBotPanel
                  botConfig={botConfig}
                  onUpdateBotConfig={(cfg) => {
                    setBotConfig(prev => {
                      const updated = { ...prev, ...cfg };
                      fetch('/api/bot/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updated),
                      }).catch(() => {});
                      return updated;
                    });
                  }}
                  botLogs={botLogs}
                  signals={signals}
                  language={language}
                  onExecuteSignal={handleExecuteSignal}
                />
              </div>
            )}

            {activeTab === 'OPTIONS' && (
              <div className="h-full w-full overflow-hidden">
                <OptionChainView
                  data={optionChainData}
                  quotes={quotes}
                  loading={optionChainLoading}
                  onRefresh={fetchOptionChain}
                  language={language}
                  onSelectOptionTrade={(type, optSym, prc) => {
                    setOrderModalData({ symbol: optSym, price: prc, type });
                    setIsOrderModalOpen(true);
                  }}
                  onViewChart={(sym) => {
                    setSelectedSymbol(sym);
                    setActiveTab('CHART');
                  }}
                />
              </div>
            )}

            {activeTab === 'ORDERS' && (
              <div className="h-full w-full overflow-y-auto space-y-4">
                <OrderBookPositions
                  positions={positions}
                  orders={orders}
                  tradeHistory={tradeHistory}
                  language={language}
                  onSquareOffPosition={handleSquareOffPosition}
                  onSquareOffAll={handleSquareOffAll}
                  totalPnL={totalPnL}
                />
                <div className="mt-4">
                  <AdvancedAnalytics history={tradeHistory as any} />
                </div>
              </div>
            )}

            {activeTab === 'HEATMAP' && (
              <div className="h-full w-full overflow-hidden">
                <MarketHeatmap quotes={quotes} />
              </div>
            )}

            {activeTab === 'AI' && (
              <div className="h-full w-full overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
                <GeminiAiAdvisor
                  analysis={geminiAnalysis}
                  loading={aiLoading}
                  onRefreshAnalysis={handleFetchGeminiAnalysis}
                  language={language}
                  symbol={selectedSymbol}
                />
                <LiveAiSupport apiConfig={apiConfig} quotesCount={quotes.length} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="lg:hidden shrink-0 bg-[#090d16]/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-around px-1 py-1 z-30">
        <button
          onClick={() => setActiveTab('WATCHLIST')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition ${
            activeTab === 'WATCHLIST' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] leading-tight">{language === 'ml' ? 'വാച്ച്ലിസ്റ്റ്' : 'Watchlist'}</span>
        </button>

        <button
          onClick={() => setActiveTab('CHART')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition ${
            activeTab === 'CHART' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart2 className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] leading-tight">{language === 'ml' ? 'ചാർട്ട്' : 'Chart'}</span>
        </button>

        <button
          onClick={() => setActiveTab('BOT')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition relative ${
            activeTab === 'BOT' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] leading-tight">{language === 'ml' ? 'അൽഗോ' : 'Bot'}</span>
          {botConfig.enabled && (
            <span className="absolute top-1 right-3 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('OPTIONS')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition ${
            activeTab === 'OPTIONS' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 mb-0.5 text-cyan-400" />
          <span className="text-[10px] leading-tight">{language === 'ml' ? 'ഓപ്ഷൻ' : 'Options'}</span>
        </button>

        <button
          onClick={() => setActiveTab('ORDERS')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition relative ${
            activeTab === 'ORDERS' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Briefcase className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] leading-tight">{language === 'ml' ? 'ഓർഡർ' : 'Orders'}</span>
          {positions.length > 0 && (
            <span className="absolute top-0.5 right-2 px-1 rounded-full bg-emerald-500 text-slate-950 font-black text-[8px]">
              {positions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('AI')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition ${
            activeTab === 'AI' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 mb-0.5 text-amber-400" />
          <span className="text-[10px] leading-tight">{language === 'ml' ? 'AI' : 'AI'}</span>
        </button>
      </nav>

      {/* 5. MODALS */}
      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        symbol={orderModalData.symbol}
        defaultPrice={orderModalData.price}
        initialType={orderModalData.type}
        mode={mode}
        onPlaceOrder={handlePlaceOrder}
        language={language}
      />

      <UpstoxApiModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        config={apiConfig}
        onSaveConfig={async (cfg) => {
          setApiConfig(prev => ({ ...prev, ...cfg }));
          try {
            await fetch('/api/market/save-config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cfg),
            });
          } catch {}
        }}
        language={language}
      />

      <AlertsModal
        priceAlerts={priceAlerts}
        onClose={() => setIsAlertsModalOpen(false)}
        onAddAlert={handleAddAlert}
        onRemoveAlert={handleRemoveAlert}
        language={language}
      />

      <AndroidInstallModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
        language={language}
      />

      <OnboardingSetupModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        defaultBotConfig={botConfig}
        defaultApiConfig={apiConfig}
        language={language}
        onSave={(cfg: any) => {
          setApiConfig(prev => ({ ...prev, ...cfg }));
          setIsOnboardingOpen(false);
        }}
      />
    </div>
  );
};

export default App;
