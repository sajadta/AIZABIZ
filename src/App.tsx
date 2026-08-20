import { OnboardingSetupModal } from "./components/OnboardingSetupModal";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Key, Activity, Terminal, Layers, Briefcase, Cpu, Bot } from 'lucide-react';
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
import { LiveAiSupport } from './components/LiveAiSupport';

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
import { analyzeTradingSignals, enrichCandlesWithIndicators } from './utils/indicators';
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
  const [holdings, setHoldings] = useState<any[]>([]);
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
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [optionLoading, setOptionLoading] = useState(false);

  // Active Bottom Section Tab
  
  const [appTab, setAppTab] = useState<'MARKETS' | 'BOT' | 'OPTIONS' | 'PORTFOLIO' | 'SUPPORT'>('MARKETS');
  const [marketView, setMarketView] = useState<'SINGLE' | 'GRID'>('SINGLE');

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
        
        // Sync LTP to Paper Trading backend so PNL calculates accurately
        if (list.length > 0) {
           fetch('/api/trading/paper-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quotes: list })
           }).catch(() => {});
        }
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
        setCandles(enrichCandlesWithIndicators(list));
      }
    } catch {
      // Soft handling
    }
  }, []);

  // 3. Fetch Positions & Orders
  const fetchPositionsAndOrders = useCallback(async () => {
    try {
      const [posRes, ordRes] = await Promise.all([
        fetch(`/api/trading/positions?mode=${mode}`),
        fetch(`/api/trading/orders?mode=${mode}`),
      ]);
      if (posRes.ok) {
        const posData = await posRes.json();
        setPositions(Array.isArray(posData) ? posData : (posData.positions || []));
      }
      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(Array.isArray(ordData) ? ordData : (ordData.orders || []));
      }
      
      const holdRes = await fetch('/api/upstox/holdings');
      if (holdRes.ok) {
        setHoldings(await holdRes.json());
      }
    } catch {
      // Soft handling during polling
    }
  }, [mode]);

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
      const quote = quotes.find(q => q.symbol === selectedSymbol);
      let indicators = null;
      if (candles.length > 0) {
        const currentLtp = quote?.ltp || (candles[candles.length - 1]?.close || 0);
        const analysis = analyzeTradingSignals(
          selectedSymbol,
          selectedSymbol,
          quote?.instrumentKey || '',
          candles,
          currentLtp,
          botConfig.selectedStrategy || 'PROFIT_MAX_100_PERCENT_MATRIX'
        );
        indicators = analysis.readings;
      }
      
      const payload = { 
        symbol: selectedSymbol, 
        interval,
        ltp: quote?.ltp || 0,
        changePercent: quote?.changePercent || 0,
        indicators
      };

      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
  }, [selectedSymbol, interval, quotes, candles, soundEnabled]);

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


  // Initial Local Storage Setup Check
  useEffect(() => {
    const isSetupComplete = localStorage.getItem('app_setup_complete');
    if (!isSetupComplete) {
      setIsOnboardingOpen(true);
    } else {
      // Sync local config to backend if backend was restarted
      const tgToken = localStorage.getItem('algo_tg_token');
      const tgChat = localStorage.getItem('algo_tg_chat');
      if (tgToken && tgChat) {
        fetch('/api/bot/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramBotToken: tgToken, telegramChatId: tgChat, telegramAlertsEnabled: true })
        }).catch(() => {});
      }
    }
  }, []);

  // Initial Load & Intervals
  useEffect(() => {
    fetchQuotes();
    fetchPositionsAndOrders();
    fetchBotState();
    fetchApiConfig();

    const quoteInterval = window.setInterval(fetchQuotes, 1000);
    
    const tradingInterval = window.setInterval(() => { fetchPositionsAndOrders(); fetchApiConfig(); }, 3000);
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
    if (selectedSymbol.includes('NIFTY') || selectedSymbol.includes('BANK') || selectedSymbol.includes('SENSEX')) {
      fetchOptionChain(selectedSymbol);
    }

    const chartInterval = window.setInterval(() => { 
      fetchCandles(selectedSymbol, interval); 
      if (selectedSymbol.includes('NIFTY') || selectedSymbol.includes('BANK') || selectedSymbol.includes('SENSEX')) {
         fetchOptionChain(selectedSymbol);
      }
    }, 10000);

    return () => window.clearInterval(chartInterval);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
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

  const totalPnL = safePositions.reduce((acc, pos) => acc + (pos.netPnl || pos.pnl || 0), 0);

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
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24 w-full">
        <div className="p-2 sm:p-4 max-w-md mx-auto space-y-4">
        
        {/* Daily Token Alert Banner for Live Mode */}
        {mode === 'UPSTOX_LIVE' && !apiConfig.isConnected && (
          <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900/40 border border-amber-500/40 flex items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in flex-wrap">
            <div className="flex items-center gap-2.5 text-amber-200 font-medium">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <span className="font-extrabold text-amber-300 block text-xs">
                  {language === 'ml' ? 'ടോക്കൺ നൽകുക' : 'Token Required'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsApiModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-[10px] transition shrink-0 flex items-center gap-1.5 shadow-md shadow-amber-950 active:scale-95"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{language === 'ml' ? 'നൽകുക' : 'Enter'}</span>
            </button>
          </div>
        )}
        
        {appTab === 'MARKETS' && marketView === 'SINGLE' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex justify-end px-2">
               <button onClick={() => setMarketView('GRID')} className="text-xs bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-emerald-400 font-bold shadow-md">
                 6 Index Grid View
               </button>
            </div>
            <div className="h-[45vh] min-h-[340px]">
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
            <div className="flex-1 min-h-[400px]">
              <Watchlist
                quotes={quotes}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={setSelectedSymbol}
                language={language}
                onOpenOrderModal={openOrderModal}
              />
            </div>
          </div>
        )}

        {appTab === 'MARKETS' && marketView === 'GRID' && (
           <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex justify-between items-center px-2">
               <h2 className="text-sm font-bold text-white">Live Index Grid</h2>
               <button onClick={() => setMarketView('SINGLE')} className="text-xs bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-amber-400 font-bold shadow-md">
                 Single Chart View
               </button>
            </div>
            <div className="grid grid-cols-2 gap-3 pb-6">
               {['NIFTY 50', 'NIFTY BANK', 'SENSEX', 'NASDAQ', 'DOW JONES', 'GIFT NIFTY'].map(sym => {
                  const q = quotes.find(x => x.symbol === sym) || { ltp: 0, changePercent: 0 };
                  const cp = q.changePercent || 0;
                  const ltp = q.ltp || 0;
                  const color = cp >= 0 ? 'text-emerald-400' : 'text-rose-400';
                  const isUp = cp >= 0;
                  return (
                     <div key={sym} onClick={() => { setSelectedSymbol(sym); setMarketView('SINGLE'); }} className="bg-[#0b0f19] border border-slate-800 rounded-xl p-3 cursor-pointer hover:border-slate-600 transition shadow-lg">
                        <div className="flex justify-between items-start mb-2">
                           <h3 className="text-[10px] sm:text-xs font-black text-slate-300 w-[65%] leading-tight">{sym}</h3>
                           <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isUp ? 'bg-emerald-950/40 text-emerald-400' : 'bg-rose-950/40 text-rose-400'}`}>
                              {isUp ? '+' : ''}{cp.toFixed(2)}%
                           </span>
                        </div>
                        <div className={`text-lg font-black ${color}`}>
                           ₹{ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="h-20 mt-3 relative overflow-hidden rounded border border-slate-800/50 bg-[#070a14]">
                           {/* Decorative Mini Sparkline */}
                           <div className="absolute inset-0 flex items-end">
                              {Array.from({ length: 20 }).map((_, i) => (
                                 <div key={i} className={`w-full mx-[1px] rounded-t-sm ${isUp ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`} style={{ height: `${Math.random() * 80 + 20}%` }} />
                              ))}
                           </div>
                        </div>
                     </div>
                  );
               })}
            </div>
           </div>
        )}

        {appTab === 'BOT' && (
          <div className="flex-1 h-full min-h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <AlgoBotPanel
              botConfig={botConfig}
              onUpdateBotConfig={handleUpdateBotConfig}
              botLogs={botLogs}
              signals={signals}
              language={language}
              onExecuteSignal={(sig) => openOrderModal(sig.signalType as OrderTransactionType, sig.symbol, sig.price)}
            />
          </div>
        )}

        {appTab === 'OPTIONS' && (
          <div className="flex-1 h-full min-h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <OptionChainView
              data={optionChainData}
              loading={optionLoading}
              onRefresh={() => fetchOptionChain(selectedSymbol)}
              language={language}
              onSelectOptionTrade={openOrderModal}
            />
          </div>
        )}

        {appTab === 'PORTFOLIO' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col flex-1 h-full min-h-[600px]">
            {/* Margin Cards */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Available Margin</p>
                <p className="text-lg font-black text-emerald-400">₹{apiConfig?.availableMargin?.toLocaleString('en-IN') || '0.00'}</p>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Used Margin</p>
                <p className="text-lg font-black text-rose-400">₹{apiConfig?.usedMargin?.toLocaleString('en-IN') || '0.00'}</p>
              </div>
            </div>

            {/* Positions */}
            <div className="flex-1 overflow-y-auto hide-scrollbar bg-[#0b0f19] border border-slate-800 rounded-2xl p-3">
              <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center justify-between">
                <span>Active Positions ({positions.length})</span>
              </h3>
              {positions.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center mt-4">No active positions.</p>
              ) : (
                <div className="space-y-2">
                  {positions.map((p, i) => (
                    <div key={i} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-200">{p.symbol}</p>
                        <p className="text-[10px] text-slate-400">Qty: {p.quantity} • Avg: ₹{Number(p.buyPrice || 0).toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-white">₹{Number(p.currentLTP || 0).toFixed(2)}</p>
                        <p className={`text-[11px] font-bold ${p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {p.pnl >= 0 ? '+' : ''}{Number(p.pnl || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Holdings */}
            <div className="flex-1 overflow-y-auto hide-scrollbar bg-[#0b0f19] border border-slate-800 rounded-2xl p-3">
              <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center justify-between">
                <span>Long-term Holdings ({holdings.length})</span>
              </h3>
              {holdings.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center mt-4">No holdings found.</p>
              ) : (
                <div className="space-y-2">
                  {holdings.map((h, i) => (
                    <div key={i} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-200">{h.symbol}</p>
                        <p className="text-[10px] text-slate-400">Qty: {h.quantity} • Avg: ₹{Number(h.buyPrice || 0).toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-white">₹{Number(h.currentLTP || 0).toFixed(2)}</p>
                        <p className={`text-[11px] font-bold ${h.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {h.pnl >= 0 ? '+' : ''}{Number(h.pnl || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        
        {appTab === 'SUPPORT' && (
          <div className="flex-1 h-full min-h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <LiveAiSupport apiConfig={apiConfig} quotesCount={quotes.length} />
          </div>
        )}

        {appTab === 'AI' && (
          <div className="flex-1 h-full min-h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <GeminiAiAdvisor
              analysis={geminiAnalysis}
              loading={aiLoading}
              onRefreshAnalysis={runGeminiAnalysis}
              language={language}
              symbol={selectedSymbol}
            />
          </div>
        )}
        
        </div>
      </main>

      {/* App Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 w-full bg-[#0a0e17]/95 backdrop-blur-md border-t border-slate-800/80 pb-safe z-50">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
          <button onClick={() => setAppTab('MARKETS')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition ${appTab === 'MARKETS' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-400'}`}>
            <Activity className="w-5 h-5" />
            <span className="text-[10px] font-bold">Markets</span>
          </button>
          
          <button onClick={() => setAppTab('BOT')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition ${appTab === 'BOT' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-400'}`}>
            <Terminal className="w-5 h-5" />
            <span className="text-[10px] font-bold">Algo Bot</span>
          </button>

          <button onClick={() => setAppTab('OPTIONS')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition ${appTab === 'OPTIONS' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-400'}`}>
            <Layers className="w-5 h-5" />
            <span className="text-[10px] font-bold">Options</span>
          </button>

          <button onClick={() => setAppTab('PORTFOLIO')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition ${appTab === 'PORTFOLIO' ? 'text-teal-400' : 'text-slate-500 hover:text-slate-400'}`}>
            <Briefcase className="w-5 h-5" />
            <span className="text-[10px] font-bold">Portfolio</span>
          </button>

          <button onClick={() => setAppTab('SUPPORT')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition ${appTab === 'SUPPORT' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-400'}`}>
            <Bot className="w-5 h-5" />
            <span className="text-[10px] font-bold">Support</span>
          </button>
        </div>
      </nav>

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
