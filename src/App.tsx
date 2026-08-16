import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Key } from 'lucide-react';
import { 
  Header 
} from './components/Header';
import { 
  TickerBar 
} from './components/TickerBar';
import { 
  CandlestickChart 
} from './components/CandlestickChart';
import { 
  Watchlist 
} from './components/Watchlist';
import { 
  AlgoBotPanel 
} from './components/AlgoBotPanel';
import { 
  OrderBookPositions 
} from './components/OrderBookPositions';
import { 
  OptionChainView 
} from './components/OptionChainView';
import { 
  GeminiAiAdvisor 
} from './components/GeminiAiAdvisor';
import { 
  OrderModal 
} from './components/OrderModal';
import { 
  UpstoxApiModal 
} from './components/UpstoxApiModal';
import { 
  AndroidInstallModal 
} from './components/AndroidInstallModal';
import { 
  StockQuote, 
  CandleData, 
  Order, 
  Position, 
  BotConfig, 
  BotLog, 
  TradingSignal, 
  GeminiMarketAnalysis, 
  OptionChainData, 
  UpstoxApiConfig, 
  ExecutionMode, 
  Language, 
  OrderTransactionType 
} from './types';
import { translations } from './translations';
import { soundEngine } from './utils/audioAlerts';

export default function App() {
  // Localization & Mode
  const [language, setLanguage] = useState<Language>('ml'); // Default Malayalam as requested
  const [mode, setMode] = useState<ExecutionMode>('PAPER_TRADING');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Market & Trading State
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY 50');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [interval, setInterval] = useState<string>('5m');
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [botLogs, setBotLogs] = useState<BotLog[]>([]);
  const [optionChainData, setOptionChainData] = useState<OptionChainData | null>(null);
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiMarketAnalysis | null>(null);
  const [apiConfig, setApiConfig] = useState<UpstoxApiConfig>({
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    redirectUri: '',
    isConnected: false,
  });

  // Bot Config
  const [botConfig, setBotConfig] = useState<BotConfig>({
    enabled: false,
    mode: 'PAPER_TRADING',
    selectedStrategy: 'PROFIT_MAX_100_PERCENT_MATRIX',
    minConfidence: 85,
    riskPerTradePercent: 1.5,
    stopLossPercent: 1.0,
    targetProfitPercent: 2.5,
    trailingStopLoss: true,
    trailingStepPercent: 0.5,
    maxDailyTrades: 10,
    autoSquareOffTime: '15:15',
  });

  // UI Modals & Loading states
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderModalData, setOrderModalData] = useState<{
    symbol: string;
    price: number;
    initialType: OrderTransactionType;
  }>({
    symbol: 'NIFTY 50',
    price: 24350,
    initialType: 'BUY',
  });

  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [optionLoading, setOptionLoading] = useState(false);

  // Active Bottom Section Tab
  const [bottomTab, setBottomTab] = useState<'BOT' | 'ORDERS' | 'OPTIONS' | 'AI'>('BOT');

  // Track previous signal count to fire alert sound on new high-probability trade
  const prevSignalCountRef = useRef(0);

  // 1. Fetch Market Quotes
  const fetchQuotes = useCallback(async () => {
    try {
      const res = await fetch('/api/upstox/quotes');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.quotes || []);
        setQuotes(list);
      }
    } catch {
      // Soft handling during server reconnect / transient network delay
    }
  }, []);

  // 2. Fetch Candlestick History
  const fetchCandles = useCallback(async (symbol: string, tf: string) => {
    try {
      const res = await fetch(`/api/upstox/candles?symbol=${encodeURIComponent(symbol)}&interval=${tf}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.candles || []);
        setCandles(list);
      }
    } catch {
      // Soft handling
    }
  }, []);

  // 3. Fetch Positions & Orders
  const fetchPositionsAndOrders = useCallback(async () => {
    try {
      const [posRes, ordRes] = await Promise.all([
        fetch('/api/trading/positions'),
        fetch('/api/trading/orders'),
      ]);
      if (posRes.ok) {
        const posData = await posRes.json();
        setPositions(Array.isArray(posData) ? posData : (posData.positions || []));
      }
      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(Array.isArray(ordData) ? ordData : (ordData.orders || []));
      }
    } catch {
      // Soft handling during polling
    }
  }, []);

  // 4. Fetch Bot Config, Logs & Live Signals
  const fetchBotState = useCallback(async () => {
    try {
      const [cfgRes, logRes, sigRes] = await Promise.all([
        fetch('/api/bot/config'),
        fetch('/api/bot/logs'),
        fetch('/api/bot/signals'),
      ]);
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        setBotConfig(cfgData);
      }
      if (logRes.ok) {
        const logData = await logRes.json();
        setBotLogs(Array.isArray(logData) ? logData : (logData.logs || []));
      }
      if (sigRes.ok) {
        const sigData = await sigRes.json();
        const sigs: TradingSignal[] = Array.isArray(sigData) ? sigData : (sigData.signals || []);
        if (sigs.length > prevSignalCountRef.current && soundEnabled) {
          soundEngine.play('SIGNAL');
        }
        prevSignalCountRef.current = sigs.length;
        setSignals(sigs);
      }
    } catch {
      // Soft handling
    }
  }, [soundEnabled]);

  // 5. Fetch Option Chain
  const fetchOptionChain = useCallback(async (symbol: string) => {
    setOptionLoading(true);
    try {
      const res = await fetch(`/api/upstox/optionchain?symbol=${encodeURIComponent(symbol)}`);
      if (res.ok) {
        const data = await res.json();
        setOptionChainData(data);
      }
    } catch {
      // Soft handling
    } finally {
      setOptionLoading(false);
    }
  }, []);

  // 6. Fetch Gemini AI Analysis
  const runGeminiAnalysis = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: selectedSymbol, interval }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeminiAnalysis(data.data || data);
        if (soundEnabled) soundEngine.play('SUCCESS');
      }
    } catch {
      // Soft handling
    } finally {
      setAiLoading(false);
    }
  }, [selectedSymbol, interval, soundEnabled]);

  // 7. Fetch API Config & sync daily token
  const fetchApiConfig = useCallback(async () => {
    try {
      // Check if we have a token stored in localStorage for today
      const savedToken = localStorage.getItem('upstox_daily_token');
      const savedDate = localStorage.getItem('upstox_token_date');
      const todayStr = new Date().toISOString().split('T')[0];

      if (savedToken && savedDate === todayStr) {
        // Automatically sync to backend if not already synced
        await fetch('/api/upstox/daily-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: savedToken }),
        });
      }

      const res = await fetch('/api/upstox/config');
      if (res.ok) {
        setApiConfig(await res.json());
      }
    } catch {
      // Soft handling
    }
  }, []);

  // Initial Load & Intervals
  useEffect(() => {
    fetchQuotes();
    fetchPositionsAndOrders();
    fetchBotState();
    fetchApiConfig();

    const quoteInterval = window.setInterval(fetchQuotes, 1000);
    const tradingInterval = window.setInterval(fetchPositionsAndOrders, 1500);
    const botInterval = window.setInterval(fetchBotState, 2000);

    return () => {
      window.clearInterval(quoteInterval);
      window.clearInterval(tradingInterval);
      window.clearInterval(botInterval);
    };
  }, [fetchQuotes, fetchPositionsAndOrders, fetchBotState, fetchApiConfig]);

  // When selected symbol or timeframe changes, refresh chart & option chain
  useEffect(() => {
    fetchCandles(selectedSymbol, interval);
    if (selectedSymbol.includes('NIFTY') || selectedSymbol.includes('BANK')) {
      fetchOptionChain(selectedSymbol);
    }
  }, [selectedSymbol, interval, fetchCandles, fetchOptionChain]);

  // Update Bot Config Handler
  const handleUpdateBotConfig = async (newConfig: Partial<BotConfig>) => {
    try {
      const res = await fetch('/api/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (res.ok) {
        const updated = await res.json();
        setBotConfig(updated);
        if (soundEnabled) {
          if (newConfig.enabled) soundEngine.play('SUCCESS');
        }
      }
    } catch (e) {
      console.error('Failed to update bot config', e);
    }
  };

  // Place Order Handler
  const handlePlaceOrder = async (orderPayload: any) => {
    try {
      const res = await fetch('/api/trading/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...orderPayload,
          mode,
        }),
      });
      if (res.ok) {
        if (soundEnabled) soundEngine.play('ORDER_FILLED');
        fetchPositionsAndOrders();
      }
    } catch (e) {
      console.error('Failed to place order', e);
      if (soundEnabled) soundEngine.play('ALERT');
    }
  };

  // Square Off Single Position
  const handleSquareOffPosition = async (positionId: string) => {
    try {
      const res = await fetch(`/api/trading/squareoff/${positionId}`, {
        method: 'POST',
      });
      if (res.ok) {
        if (soundEnabled) soundEngine.play('ORDER_FILLED');
        fetchPositionsAndOrders();
      }
    } catch (e) {
      console.error('Failed to square off position', e);
    }
  };

  // Square Off All
  const handleSquareOffAll = async () => {
    try {
      const res = await fetch('/api/trading/squareoff-all', {
        method: 'POST',
      });
      if (res.ok) {
        if (soundEnabled) soundEngine.play('ALERT');
        fetchPositionsAndOrders();
      }
    } catch (e) {
      console.error('Failed to square off all', e);
    }
  };

  // Save Upstox API Config
  const handleSaveApiConfig = async (cfg: Partial<UpstoxApiConfig>) => {
    const res = await fetch('/api/upstox/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save configuration');
    }
    const updated = await res.json();
    setApiConfig(updated);
  };

  // Open Order Modal Helper
  const openOrderModal = (type: OrderTransactionType, sym: string, prc: number) => {
    setOrderModalData({
      symbol: sym,
      price: prc,
      initialType: type,
    });
    setIsOrderModalOpen(true);
  };

  // Calculate total PnL
  const safePositions = Array.isArray(positions) ? positions : [];
  const safeQuotes = Array.isArray(quotes) ? quotes : [];
  const safeSignals = Array.isArray(signals) ? signals : [];

  const totalPnL = safePositions.reduce((acc, pos) => acc + (pos.pnl || 0), 0);

  // Selected Stock Quote
  const currentQuote = safeQuotes.find((q) => q.symbol === selectedSymbol);
  const activeSignal = safeSignals.find((s) => s.symbol === selectedSymbol);

  const t = translations[language];

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      
      {/* 1. Header */}
      <Header
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
      />

      {/* 2. Real-time Ticker Ribbon */}
      <TickerBar
        quotes={quotes}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={setSelectedSymbol}
      />

      {/* 3. Main Dashboard Layout */}
      <main className="flex-1 p-2 sm:p-4 max-w-[1720px] w-full mx-auto space-y-4">
        
        {/* Daily Token Alert Banner for Live Mode */}
        {mode === 'UPSTOX_LIVE' && !apiConfig.isConnected && (
          <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900/40 border border-amber-500/40 flex items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 flex-wrap">
            <div className="flex items-center gap-2.5 text-amber-200 font-medium">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <span className="font-extrabold text-amber-300 block text-xs">
                  {language === 'ml' ? 'ഇന്നത്തെ Upstox Access Token നൽകിയിട്ടില്ല' : 'Daily Upstox Access Token Not Configured'}
                </span>
                <span className="text-[11px] text-amber-400/80">
                  {language === 'ml' 
                    ? 'തത്സമയം യഥാർത്ഥ അക്കൗണ്ടിലേക്ക് ട്രേഡ് ചെയ്യാൻ ഇന്ന് രാവിലെ ഉണ്ടാക്കിയ Access Token ഇവിടെ നൽകുക.' 
                    : 'Enter today\'s generated access token to execute live market orders with your broker.'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsApiModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs transition shrink-0 flex items-center gap-1.5 shadow-md shadow-amber-950 active:scale-95"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{language === 'ml' ? '☀️ ഇന്നത്തെ ടോക്കൺ നൽകുക' : '☀️ Enter Today\'s Token'}</span>
            </button>
          </div>
        )}
        
        {/* Top Grid: Watchlist (Left) & Candlestick Chart (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
          
          {/* Watchlist: 4 cols on desktop */}
          <div className="lg:col-span-4 h-[440px] sm:h-[480px]">
            <Watchlist
              quotes={quotes}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
              language={language}
              onOpenOrderModal={openOrderModal}
            />
          </div>

          {/* Candlestick Chart: 8 cols on desktop */}
          <div className="lg:col-span-8 h-[440px] sm:h-[480px]">
            <CandlestickChart
              symbol={selectedSymbol}
              quote={currentQuote}
              candles={candles}
              interval={interval}
              onChangeInterval={setInterval}
              language={language}
              onOpenOrderModal={openOrderModal}
              onGenerateAiAnalysis={runGeminiAnalysis}
              aiLoading={aiLoading}
              signal={activeSignal}
            />
          </div>

        </div>

        {/* Bottom Multi-Module Panel */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4">
          
          {/* Left Column: Algo Bot Strategy & Execution Matrix (7 cols) */}
          <div className="xl:col-span-7 h-[420px] sm:h-[460px]">
            <AlgoBotPanel
              botConfig={botConfig}
              onUpdateBotConfig={handleUpdateBotConfig}
              botLogs={botLogs}
              signals={signals}
              language={language}
              onExecuteSignal={(sig) => openOrderModal(sig.signalType as OrderTransactionType, sig.symbol, sig.price)}
            />
          </div>

          {/* Right Column: Positions / Option Chain / Gemini Intelligence (5 cols) */}
          <div className="xl:col-span-5 h-[420px] sm:h-[460px] flex flex-col">
            {/* View Selector for Right Panel */}
            <div className="bg-[#0b0f19] p-1 rounded-2xl border border-slate-800 mb-2 flex items-center gap-1 text-xs font-extrabold">
              <button
                onClick={() => setBottomTab('ORDERS')}
                className={`flex-1 py-1.5 rounded-xl transition ${
                  bottomTab === 'ORDERS'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.ordersPositions} ({positions.length})
              </button>
              <button
                onClick={() => setBottomTab('OPTIONS')}
                className={`flex-1 py-1.5 rounded-xl transition ${
                  bottomTab === 'OPTIONS'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.optionChain}
              </button>
              <button
                onClick={() => setBottomTab('AI')}
                className={`flex-1 py-1.5 rounded-xl transition ${
                  bottomTab === 'AI'
                    ? 'bg-slate-800 text-purple-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Gemini AI
              </button>
            </div>

            {/* Active Sub-panel view */}
            <div className="flex-1 overflow-hidden">
              {bottomTab === 'ORDERS' && (
                <OrderBookPositions
                  positions={positions}
                  orders={orders}
                  language={language}
                  onSquareOffPosition={handleSquareOffPosition}
                  onSquareOffAll={handleSquareOffAll}
                  totalPnL={totalPnL}
                />
              )}

              {bottomTab === 'OPTIONS' && (
                <OptionChainView
                  data={optionChainData}
                  loading={optionLoading}
                  onRefresh={() => fetchOptionChain(selectedSymbol)}
                  language={language}
                  onSelectOptionTrade={openOrderModal}
                />
              )}

              {bottomTab === 'AI' && (
                <GeminiAiAdvisor
                  analysis={geminiAnalysis}
                  loading={aiLoading}
                  onRefreshAnalysis={runGeminiAnalysis}
                  language={language}
                  symbol={selectedSymbol}
                />
              )}
            </div>
          </div>

        </div>

      </main>

      {/* Footer Disclaimer & Android PWA Banner */}
      <footer className="bg-[#090d16] border-t border-slate-800/80 py-3 px-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Upstox Live WebSocket Engine: Active</span>
          </div>
          <span>
            {language === 'ml' 
              ? 'ഓട്ടോമേറ്റഡ് അൽഗോരിതം ലൈവ് മാർക്കറ്റ് ഡാറ്റ ഉപയോഗിച്ച് വിശകലനം ചെയ്യുന്നു.' 
              : 'Algorithmic High-Accuracy Confluence Matrix Terminal v3.0'}
          </span>
          <button
            onClick={() => setIsAndroidModalOpen(true)}
            className="text-emerald-400 hover:underline font-bold"
          >
            {language === 'ml' ? 'ആൻഡ്രോയിഡ് ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുക' : 'Install Android App'}
          </button>
        </div>
      </footer>

      {/* Modals */}
      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        symbol={orderModalData.symbol}
        defaultPrice={orderModalData.price}
        initialType={orderModalData.initialType}
        mode={mode}
        onPlaceOrder={handlePlaceOrder}
        language={language}
      />

      <UpstoxApiModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        config={apiConfig}
        onSaveConfig={handleSaveApiConfig}
        language={language}
      />

      <AndroidInstallModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
        language={language}
      />

    </div>
  );
}
