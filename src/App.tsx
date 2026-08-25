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
  const [selectedInstrumentKey, setSelectedInstrumentKey] = useState<string>('NSE_INDEX|Nifty 50');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [interval, setInterval] = useState<string>('5m');
  const [positions, setPositions] = useState<Position[]>([]);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [botLogs, setBotLogs] = useState<BotLog[]>([]);
  const [optionChainData, setOptionChainData] = useState<OptionChainData | null>(null);
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiMarketAnalysis | null>(null);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(true);
  const [apiConfig, setApiConfig] = useState<UpstoxApiConfig>({
    geminiApiKey: '',
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    redirectUri: '',
    isConnected: false,
  });

  // Bot Config
  
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [tempConfig, setTempConfig] = useState<UpstoxApiConfig>({ apiKey: '', apiSecret: '', accessToken: '', redirectUri: 'http://localhost:8080/', isConnected: false, geminiApiKey: '' });
  
  useEffect(() => {
     const storedConfig = localStorage.getItem('algoTradingConfig');
     if (storedConfig) {
        try {
           const parsed = JSON.parse(storedConfig);
           setApiConfig(parsed);
           // Push to server
           fetch('/api/upstox/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(parsed)
           }).catch(() => {});
        } catch(e) {}
     } else {
        setShowSetupModal(true);
     }
  }, []);
  
  const handleSaveSetup = async () => {
     try {
       const res = await fetch('/api/upstox/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tempConfig)
       });
       if (res.ok) {
          const updated = await res.json();
          setApiConfig(updated);
          localStorage.setItem('algoTradingConfig', JSON.stringify(updated));
          setShowSetupModal(false);
       }
     } catch(e) {}
  };

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
  const fetchCandles = useCallback(async (symbol: string, instKey: string, tf: string) => {
    try {
      const res = await fetch(`/api/upstox/candles?symbol=${encodeURIComponent(symbol)}&instrumentKey=${encodeURIComponent(instKey)}&interval=${tf}`);
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
        indicators = analysis.indicators;
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

    

    let eventSource: EventSource | null = null;
    let reconnectTimeout: number | null = null;
    let reconnectAttempts = 0;
    
    const connectEventSource = () => {
        eventSource = new EventSource('/api/stream/quotes');
        
        eventSource.onopen = () => {
            console.log('Connected to Live Quotes SSE');
            setIsWsConnected(true);
            reconnectAttempts = 0;
        };
        
        eventSource.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'CONNECTED') {
                    console.log('SSE Stream fully established.');
                }
                if (msg.type === 'QUOTES') {
                    const list = msg.data || [];
                    setQuotes(list);
                    if (list.length > 0) {
                        fetch('/api/trading/paper-sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ quotes: list })
                        }).catch(() => {});
                    }
                }
            } catch(e) {}
        };
        
        eventSource.onerror = (err) => {
           console.log('SSE connection interrupted, attempting to reconnect...');
           setIsWsConnected(false);
           eventSource?.close();
           const timeoutMs = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 10000);
           console.log(`SSE closed. Reconnecting in ${Math.round(timeoutMs/1000)}s...`);
           reconnectTimeout = window.setTimeout(() => {
               reconnectAttempts++;
               connectEventSource();
           }, timeoutMs);
        };
    };

    connectEventSource();

    const quoteInterval = window.setInterval(fetchQuotes, 10000); // fallback polling if WS dies, or just as a keepalive

    
    const tradingInterval = window.setInterval(() => { fetchPositionsAndOrders(); fetchApiConfig(); }, 3000);
    const botInterval = window.setInterval(fetchBotState, 2000);
    return () => {
      window.clearInterval(quoteInterval);
      if (reconnectTimeout) window.clearTimeout(reconnectTimeout);
      if (eventSource) { eventSource.close(); }
      window.clearInterval(tradingInterval);
      window.clearInterval(botInterval);
    };

  }, [fetchQuotes, fetchPositionsAndOrders, fetchBotState, fetchApiConfig]);

// When selected symbol or timeframe changes, refresh chart & option chain
  useEffect(() => {
    fetchCandles(selectedSymbol, selectedInstrumentKey, interval);
    if (selectedSymbol.includes('NIFTY') || selectedSymbol.includes('BANK') || selectedSymbol.includes('SENSEX')) {
      fetchOptionChain(selectedSymbol);
    }

    const chartInterval = window.setInterval(() => { 
      fetchCandles(selectedSymbol, selectedInstrumentKey, interval); 
      if (selectedSymbol.includes('NIFTY') || selectedSymbol.includes('BANK') || selectedSymbol.includes('SENSEX')) {
         fetchOptionChain(selectedSymbol);
      }
    }, 10000);

    return () => window.clearInterval(chartInterval);
  }, [selectedSymbol, selectedInstrumentKey, interval, fetchCandles, fetchOptionChain]);

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
    const merged = { ...apiConfig, ...cfg };
    localStorage.setItem('algoTradingConfig', JSON.stringify(merged));
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
    <div className="h-screen w-full relative overflow-x-hidden">

      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-lg w-full shadow-2xl">
             <h2 className="text-2xl font-bold text-white mb-4">Initial Setup</h2>
             <p className="text-slate-400 text-sm mb-6">Please enter your API credentials. These are stored locally on your device and never on our servers permanently.</p>
             
             <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Gemini API Key (Required for AI)</label>
                  <input type="password" value={tempConfig.geminiApiKey || ''} onChange={e => setTempConfig({...tempConfig, geminiApiKey: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Upstox API Key</label>
                  <input type="text" value={tempConfig.apiKey} onChange={e => setTempConfig({...tempConfig, apiKey: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Upstox API Secret</label>
                  <input type="password" value={tempConfig.apiSecret} onChange={e => setTempConfig({...tempConfig, apiSecret: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Upstox Access Token (Optional)</label>
                  <input type="password" value={tempConfig.accessToken} onChange={e => setTempConfig({...tempConfig, accessToken: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                </div>
                
                <button onClick={handleSaveSetup} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg transition-colors">
                   Save & Start
                </button>
             </div>
          </div>
        </div>
      )}
        <Header 
          mode={mode} 
          setMode={setMode} 
          language={language} 
          setLanguage={setLanguage}
          soundEnabled={soundEnabled}
          toggleSound={() => setSoundEnabled(!soundEnabled)}
          onOpenApiSettings={() => setIsApiModalOpen(true)}
          onOpenAndroidInstall={() => setIsAndroidModalOpen(true)}
          apiConfig={apiConfig}
        />
        {(!isWsConnected || !apiConfig.accessToken || apiConfig.accessToken === '') && !showSetupModal && (
          <div className="bg-red-900/50 border-b border-red-500/50 text-red-200 px-4 py-2 text-sm flex items-center justify-center gap-2">
             <AlertTriangle size={16} />
             <span>{(!apiConfig.accessToken || apiConfig.accessToken === '') ? 'Upstox API Token Missing. Please update settings.' : 'Connection Lost. Showing last known market data.'}</span>
          </div>
        )}
        <TickerBar 
          quotes={quotes} 
          selectedSymbol={selectedSymbol}
          onSelectSymbol={(sym, key) => {
             setSelectedSymbol(sym);
             if(key) setSelectedInstrumentKey(key);
          }}
        />
        
        {appTab === 'MARKETS' && (
          <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
            <div className="w-full sm:w-80 border-b sm:border-b-0 sm:border-r border-[#1d2335] bg-[#0b0f19] flex flex-col hide-scrollbar overflow-y-auto max-h-[35vh] sm:max-h-none shrink-0">
              <Watchlist 
                 quotes={quotes}
                 selectedSymbol={selectedSymbol}
                 onSelectSymbol={(sym, key) => {
                   setSelectedSymbol(sym);
                   if(key) setSelectedInstrumentKey(key);
                 }}
                 language={language}
                 onOpenOrderModal={openOrderModal}
              />
            </div>
            <div className="flex-1 flex flex-col bg-[#070a12]">
              <div className="flex-1 border-b border-[#1d2335] p-2 relative">
                 <CandlestickChart 
                    candles={candles || []}
                    symbol={selectedSymbol}
                    interval={interval}
                    onChangeInterval={setInterval}
                    quote={quotes.find(q => q.symbol === selectedSymbol)}
                    language={language}
                    onOpenOrderModal={openOrderModal}
                    onGenerateAiAnalysis={() => {}}
                 />
              </div>
              <div className="h-64 overflow-y-auto hide-scrollbar p-2 bg-[#0b0f19]">
                 <OrderBookPositions 
                    positions={positions}
                    orders={orders}
                    language={language}
                    totalPnL={positions.reduce((acc, p) => acc + (p.pnl || 0), 0)}
                    onSquareOffPosition={handleSquareOffPosition}
                    onSquareOffAll={handleSquareOffAll}
                 />
              </div>
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
              onViewChart={(sym, key) => {
                setSelectedSymbol(sym);
                setSelectedInstrumentKey(key);
                setAppTab('MARKETS');
              }}
            />
          </div>
        )}

        {appTab === 'PORTFOLIO' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col flex-1 h-full min-h-[600px]">
            {/* Margin Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Account Balance</p>
                <p className="text-lg font-black text-white">₹{((apiConfig?.availableMargin || 0) + (apiConfig?.usedMargin > 0 ? apiConfig.usedMargin : 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Available Margin</p>
                <p className="text-lg font-black text-emerald-400">₹{apiConfig?.availableMargin?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '0.00'}</p>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Used Margin (Active)</p>
                <p className="text-lg font-black text-rose-400">₹{apiConfig?.usedMargin?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '0.00'}</p>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estimated Taxes & Brokerage</p>
                <p className="text-lg font-black text-amber-400">₹{((orders.length || 0) * 20 + ((orders.length || 0) * 5)).toLocaleString('en-IN')}</p>
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
                  {positions.map((p, i) => {
                    const invested = (p.quantity || 0) * (p.buyPrice || 0);
                    const currentVal = (p.quantity || 0) * (p.currentLTP || 0);
                    const approxBrokerage = 40; // ₹20 buy, ₹20 sell approx
                    return (
                    <div key={i} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-slate-200">{p.symbol}</p>
                          <p className="text-[10px] text-slate-400">Qty: {p.quantity} • Avg: ₹{Number(p.buyPrice || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-white">₹{Number(p.currentLTP || 0).toFixed(2)}</p>
                          <p className={`text-[11px] font-bold ${p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {p.pnl >= 0 ? '+' : ''}{Number(p.pnl || 0).toFixed(2)} ({p.pnlPercent ? p.pnlPercent.toFixed(2) : '0.00'}%)
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between border-t border-slate-800/60 pt-2 text-[9px] text-slate-400">
                         <div>Used Amt: <span className="text-slate-300">₹{invested.toFixed(2)}</span></div>
                         <div>Current: <span className="text-slate-300">₹{currentVal.toFixed(2)}</span></div>
                         <div>Est. Brokerage/Tax: <span className="text-amber-400/80">~₹{approxBrokerage.toFixed(2)}</span></div>
                      </div>
                    </div>
                  );})}
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
                  {holdings.map((h, i) => {
                    const invested = (h.quantity || 0) * (h.buyPrice || 0);
                    const currentVal = (h.quantity || 0) * (h.currentLTP || 0);
                    return (
                    <div key={i} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-slate-200">{h.symbol}</p>
                          <p className="text-[10px] text-slate-400">Qty: {h.quantity} • Avg: ₹{Number(h.buyPrice || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-white">₹{Number(h.currentLTP || 0).toFixed(2)}</p>
                          <p className={`text-[11px] font-bold ${h.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {h.pnl >= 0 ? '+' : ''}{Number(h.pnl || 0).toFixed(2)} ({h.pnlPercent ? h.pnlPercent.toFixed(2) : '0.00'}%)
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between border-t border-slate-800/60 pt-2 text-[9px] text-slate-400">
                         <div>Invested Amt: <span className="text-slate-300">₹{invested.toFixed(2)}</span></div>
                         <div>Current Value: <span className="text-slate-300">₹{currentVal.toFixed(2)}</span></div>
                         <div>Est. Taxes (STT/Charges): <span className="text-amber-400/80">~₹{(invested * 0.001).toFixed(2)}</span></div>
                      </div>
                    </div>
                  );})}
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
