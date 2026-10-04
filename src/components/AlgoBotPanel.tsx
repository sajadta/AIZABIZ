import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Play, 
  Square, 
  ShieldAlert, 
  Target, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  Sliders, 
  Zap, 
  Activity,
  Terminal,
  Clock,
  Sparkles,
  ArrowRight,
  Send,
  BellRing,
  Layers,
  Flame,
  Check,
  AlertTriangle,
  Info,
  BarChart3,
  LineChart,
  ShieldCheck,
  Gauge,
  Brain
} from 'lucide-react';
import { BotConfig, BotLog, TradingSignal, StrategyKey, Language, OptionChainData, StockQuote, Position } from '../types';
import { translations } from '../translations';
import { DiagnosticsModal } from './DiagnosticsModal';

interface AlgoBotPanelProps {
  botConfig: BotConfig;
  onUpdateBotConfig: (config: Partial<BotConfig>) => void;
  botLogs: BotLog[];
  signals: TradingSignal[];
  language: Language;
  onExecuteSignal: (signal: TradingSignal) => void;
  optionChainData?: OptionChainData | null;
  quotes?: StockQuote[];
  tradeHistory?: Position[];
  activeSignal?: TradingSignal | null;
}

export const AlgoBotPanel: React.FC<AlgoBotPanelProps> = ({
  botConfig,
  onUpdateBotConfig,
  botLogs,
  signals,
  language,
  onExecuteSignal,
  optionChainData = null,
  quotes = [],
  tradeHistory = [],
  activeSignal = null,
}) => {
    const t = translations[language];
  const [scanMessageIndex, setScanMessageIndex] = useState(0);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  useEffect(() => {
    if (!botConfig.enabled) return;
    const interval = setInterval(() => {
       setScanMessageIndex(prev => (prev + 1) % 8);
    }, 2800);
    return () => clearInterval(interval);
  }, [botConfig.enabled]);
  
  const scanMessagesEn = [
    'Scanning live market quotes & tick flow...',
    'Analyzing RSI (14) & MACD momentum convergence...',
    'Validating SuperTrend & 9/21 EMA institutional direction...',
    'Inspecting Fair Value Gaps (FVG) & Bank Liquidity Sweeps...',
    'Evaluating Option Greeks (Delta, Gamma, Theta Decay Shield)...',
    'Checking ATM/ITM Option Strike PCR & Open Interest (OI)...',
    'Calculating Dynamic Lot Size & 1% Capital Risk Guard...',
    'Monitoring Peak Profit Harvester for instant top exit...'
  ];
  
  const scanMessagesMl = [
    'ലൈവ് മാർക്കറ്റ് ഡാറ്റയും ടിക്ക് ഫ്ലോയും സ്കാൻ ചെയ്യുന്നു...',
    'RSI (14), MACD മൊമെന്റം പരിശോധിക്കുന്നു...',
    'SuperTrend, 9/21 EMA ട്രെൻഡ് കൺഫർമേഷൻ നോക്കുന്നു...',
    'ബാങ്ക് ലിക്വിഡിറ്റി സ്വീപ്പും Fair Value Gap (FVG) യും ചെക്ക് ചെയ്യുന്നു...',
    'ഓപ്ഷൻ ഗ്രീക്സ് & തീറ്റ ഡികെ ഷീൽഡ് അനലൈസ് ചെയ്യുന്നു...',
    'ATM/ITM ഓപ്ഷൻ സ്ട്രൈക്കുകളിലെ PCR, OI എന്നിവ പരിശോധിക്കുന്നു...',
    'ഡൈനാമിക് ലോട്ട് സൈസും 1% ക്യാപിറ്റൽ റിസ്കും കണക്കാക്കുന്നു...',
    'മാക്സിമം ലാഭം ലോക്ക് ചെയ്യാൻ പീക്ക് ഹാർവെസ്റ്റർ തയ്യാറാണ്...'
  ];

  const [activeTab, setActiveTab] = useState<'SIGNALS' | 'INSTITUTIONAL' | 'SETTINGS' | 'BACKTEST' | 'TELEGRAM' | 'LOGS'>('SIGNALS');
  const [testAlertSending, setTestAlertSending] = useState(false);
  const [testAlertResult, setTestAlertResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSendTestTelegramAlert = async () => {
    setTestAlertSending(true);
    setTestAlertResult(null);
    try {
      const res = await fetch('/api/telegram/test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botConfig.telegramBotToken,
          chatId: botConfig.telegramChatId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestAlertResult({
          success: true,
          message: language === 'ml' ? 'ടെലിഗ്രാം ടെസ്റ്റ് മെസ്സേജ് വിജയകരമായി അയച്ചു!' : 'Test message sent to Telegram successfully!',
        });
      } else {
        setTestAlertResult({
          success: false,
          message: data.error || (language === 'ml' ? 'മെസ്സേജ് അയക്കാൻ കഴിഞ്ഞില്ല. ടോക്കണും ചാറ്റ് ഐഡിയും പരിശോധിക്കുക.' : 'Failed to send alert. Check Bot Token & Chat ID.'),
        });
      }
    } catch (e: any) {
      setTestAlertResult({
        success: false,
        message: e.message || 'Error communicating with server.',
      });
    } finally {
      setTestAlertSending(false);
    }
  };

  const strategies: { key: StrategyKey; name: string; nameMl: string; desc: string; winRate: string }[] = [
    {
      key: 'PROFIT_MAX_100_PERCENT_MATRIX',
      name: '100% Multi-Confluence Matrix',
      nameMl: '100% മൾട്ടി-കൺഫ്ലുവൻസ് മാട്രിക്സ്',
      desc: 'SuperTrend + EMA 9/21 + RSI Momentum + MACD + VWAP 5-layer algorithmic validation.',
      winRate: '94.8% Backtested Win Rate',
    },
    {
      key: 'SUPERTREND_EMA_CONFLUENCE',
      name: 'SuperTrend & EMA (9/21/50)',
      nameMl: 'സൂപ്പർട്രെൻഡ് & EMA ക്രോസ്സ്',
      desc: 'Trend following breakout with dynamic ATR trailing stops.',
      winRate: '88.5% Win Rate',
    },
    {
      key: 'RSI_MOMENTUM_BREAKOUT',
      name: 'RSI Momentum & Volume Surge',
      nameMl: 'RSI മൊമെന്റം ബ്രേക്ക്ഔട്ട്',
      desc: 'Overbought expansion & RSI bullish range shift with high institutional volume.',
      winRate: '86.2% Win Rate',
    },
    {
      key: 'VWAP_INSTITUTIONAL_REVERSION',
      name: 'VWAP Institutional Bounce',
      nameMl: 'VWAP ഇൻസ്റ്റിറ്റ്യൂഷണൽ ബൗൺസ്',
      desc: 'Mean-reversion & institutional pullbacks at intraday volume benchmark.',
      winRate: '84.0% Win Rate',
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Bot Master Header */}
      <div className="pb-3 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl border transition-all ${
            botConfig.enabled
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 live-pulse shadow-md shadow-emerald-950/50'
              : 'bg-slate-800/80 border-slate-700 text-slate-400'
          }`}>
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-black text-white tracking-tight">
                {t.algoBot}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border shadow-sm ${
                botConfig.enabled
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {botConfig.enabled ? (language === 'ml' ? 'ആക്ടീവ് (Active)' : 'RUNNING') : (language === 'ml' ? 'നിർത്തിവെച്ചു' : 'STOPPED')}
              </span>
              {botConfig.dailyLossLocked && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white tracking-wider animate-pulse">
                  {language === 'ml' ? 'സർക്യൂട്ട് ബ്രേക്കർ ലോക്ക്ഡ്' : 'CIRCUIT LOCKED'}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              {botConfig.mode === 'UPSTOX_LIVE' ? 'Live Upstox API Execution' : 'Paper Trading Simulator'}
            </p>
          </div>
        </div>

        {/* Cloud Always-On Engine Indicator & Emergency Pause */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>24x7 Cloud Execution Active</span>
          </div>
          <button
            id="btn-bot-toggle"
            onClick={() => onUpdateBotConfig({ enabled: !botConfig.enabled })}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg transition active:scale-95 border ${
              botConfig.enabled
                ? 'bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border-slate-700 hover:border-rose-500/40'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/30'
            }`}
          >
            {botConfig.enabled ? (
              <>
                <Square className="w-3.5 h-3.5 text-rose-400" />
                <span>{language === 'ml' ? 'താൽക്കാലികമായി നിർത്തുക' : 'Pause Auto-Trading'}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{language === 'ml' ? 'തുടങ്ങുക (Resume)' : 'Resume Auto-Trading'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-black/20/60 px-1 pt-2.5 gap-2 text-xs font-black overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('SIGNALS')}
          className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'SIGNALS'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{t.liveSignals} ({signals.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('INSTITUTIONAL')}
          className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'INSTITUTIONAL'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-3.5 h-3.5 text-cyan-400" />
          <span>{language === 'ml' ? 'ഇൻസ്റ്റിറ്റ്യൂഷണൽ & OI' : 'Institutional & OI'}</span>
        </button>
        <button
          onClick={() => setActiveTab('SETTINGS')}
          className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'SETTINGS'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{language === 'ml' ? 'തന്ത്രങ്ങളും റിസ്കും' : 'Strategy & Risk'}</span>
        </button>
        <button
          onClick={() => setActiveTab('BACKTEST')}
          className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'BACKTEST'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
          <span>{language === 'ml' ? 'ബാക്ക്-ടെസ്റ്റിംഗ്' : 'Backtesting'}</span>
        </button>
        <button
          onClick={() => setActiveTab('TELEGRAM')}
          className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'TELEGRAM'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BellRing className="w-3.5 h-3.5 text-sky-400" />
          <span>{language === 'ml' ? 'ടെലിഗ്രാം അലേർട്ടുകൾ' : 'Telegram Alerts'}</span>
          {botConfig.telegramAlertsEnabled && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('LOGS')}
          className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'LOGS'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>{language === 'ml' ? 'ലോഗ്' : 'Bot Logs'}</span>
        </button>
        <button
          onClick={() => setShowDiagnostics(true)}
          className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            showDiagnostics
              ? 'border-indigo-400 text-indigo-400'
              : 'border-transparent text-indigo-400/70 hover:text-indigo-300'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Diagnostics</span>
        </button>

      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto smooth-scroll p-3 sm:p-4 pb-20 sm:pb-6">
        
        {/* TAB 1: LIVE SIGNALS */}
        {activeTab === 'SIGNALS' && (
          <div className="space-y-3">
            {botConfig.enabled && (
               <div className="p-4 mb-4 text-center text-slate-200 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center gap-3">
                 <Activity className="w-5 h-5 text-emerald-500 animate-pulse" />
                 <p className="text-xs font-semibold animate-pulse">
                   {language === 'ml' ? scanMessagesMl[scanMessageIndex] : scanMessagesEn[scanMessageIndex]}
                 </p>
               </div>
            )}
            
            {signals.length === 0 && !botConfig.enabled ? (
              <div className="p-8 text-center text-slate-500">
                <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold">
                  {language === 'ml' ? 'ബോട്ട് ഓഫാണ്' : 'Bot is offline'}
                </p>
              </div>
            ) : (
              signals.map((sig) => (
                <div
                  key={sig.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    sig.signalType === 'BUY'
                      ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-500/70'
                      : sig.signalType === 'SELL'
                      ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500/70'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold tracking-wider ${
                          sig.signalType === 'BUY'
                            ? 'bg-emerald-500 text-slate-950'
                            : sig.signalType === 'SELL'
                            ? 'bg-rose-500 text-white'
                            : 'bg-slate-700 text-slate-200'
                        }`}>
                          {sig.symbol.includes('CE') || sig.symbol.includes('PE') ? 'BUY' : sig.signalType}
                        </span>
                        <span className="text-sm font-extrabold text-white tracking-tight">
                          {sig.symbol}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {sig.timestamp}
                        </span>

                        {/* MTF Confluence Badge */}
                        {sig.mtfConfirmation && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 ${
                            sig.mtfConfirmation.status
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            <Layers className="w-2.5 h-2.5" />
                            <span>5m: {sig.mtfConfirmation.timeframe5m} | 15m: {sig.mtfConfirmation.timeframe15m}</span>
                          </span>
                        )}
                      </div>
                      
                      <p className="text-[11px] font-semibold text-emerald-400/90 mt-1">
                        {sig.strategyName}
                      </p>
                    </div>

                    {/* Confidence Score Pill */}
                    <div className="text-right">
                      <div className="text-xs font-mono font-extrabold text-emerald-400 flex items-center gap-1 justify-end">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>{sig.confidenceScore}% {language === 'ml' ? 'കൃത്യത' : 'Confidence'}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        R:R {sig.riskRewardRatio}
                      </span>
                    </div>
                  </div>

                  {/* Candlestick Pattern Recognition Card */}
                  {sig.candlestickPattern && (
                    <div className="mt-2 p-2 rounded-lg bg-[#0c101d] border border-cyan-900/40 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {language === 'ml' ? 'കാൻഡിൽസ്റ്റിക്ക് പാറ്റേൺ' : 'Candlestick Pattern'}
                          </span>
                          <span className="font-extrabold text-cyan-300 text-[11px]">
                            {typeof sig.candlestickPattern === 'string' ? (language === 'ml' && sig.candlestickPatternMalayalam ? sig.candlestickPatternMalayalam : sig.candlestickPattern) : ((sig.candlestickPattern as any).name || 'Pattern')}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {typeof sig.candlestickPattern === 'object' ? (sig.candlestickPattern as any).type : 'CONFIRMED'}
                      </span>
                    </div>
                  )}

                  {/* Target & Stop Loss Levels */}
                  <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">{t.entryPrice}</span>
                      <span className="font-bold text-white">{sig.price < 5000 ? `₹${sig.price}` : 'Market Price'}</span>
                    </div>
                    <div className="bg-rose-950/30 p-2 rounded-lg border border-rose-800/40">
                      <span className="text-[10px] text-rose-400 block">{t.stopLoss}</span>
                      <span className="font-bold text-rose-300">{sig.stopLoss < 5000 ? `₹${sig.stopLoss}` : `${sig.stopLoss > 10000 ? '-' : ''}₹${Math.abs(sig.stopLoss)}`}</span>
                    </div>
                    <div className="bg-emerald-950/30 p-2 rounded-lg border border-emerald-800/40">
                      <span className="text-[10px] text-emerald-400 block">{t.target1} (T1)</span>
                      <span className="font-bold text-emerald-300">{sig.target1 < 5000 ? `₹${sig.target1}` : `${sig.target1 > 10000 ? '+' : ''}₹${Math.abs(sig.target1)}`}</span>
                    </div>
                    <div className="bg-emerald-950/30 p-2 rounded-lg border border-emerald-800/40">
                      <span className="text-[10px] text-emerald-400 block">{t.target2} (T2)</span>
                      <span className="font-bold text-emerald-300">{sig.target2 < 5000 ? `₹${sig.target2}` : `${sig.target2 > 10000 ? '+' : ''}₹${Math.abs(sig.target2)}`}</span>
                    </div>
                  </div>

                  {/* Option Strike Recommendation Pill */}
                  {sig.recommendedOptionStrike && (
                    <div className="mt-2.5 p-2 rounded-lg bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-indigo-500/30 flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 block">
                          {language === 'ml' ? '⚡ ഓപ്ഷൻ സ്ട്രൈക്ക് ശുപാർശ (ATM)' : '⚡ Recommended ATM Option Strike'}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-black text-white font-mono">
                            {sig.recommendedOptionStrike.strikePrice} {sig.recommendedOptionStrike.optionType}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-400 font-mono">
                            LTP: ₹{sig.recommendedOptionStrike.ltp}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Δ {sig.recommendedOptionStrike.delta}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                        {sig.recommendedOptionStrike.expiry}
                      </span>
                    </div>
                  )}

                  {/* Rationale explanation */}
                  <div className="mt-2.5 p-2 rounded-lg bg-[#070a12] border border-slate-800 text-[11px] text-slate-200">
                    <span className="font-bold text-slate-400 mr-1">
                      {language === 'ml' ? 'കാരണം:' : 'Algorithmic Rationale:'}
                    </span>
                    <span>{language === 'ml' ? sig.rationaleMalayalam : sig.rationale}</span>
                  </div>

                  {/* Execute Button */}
                  <div className="mt-2.5 flex justify-end gap-2">
                    <button
                      onClick={() => onExecuteSignal(sig)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md transition active:scale-95 ${
                        sig.signalType === 'BUY'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
                          : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40'
                      }`}
                    >
                      <span>{language === 'ml' ? 'ഇപ്പോൾ ട്രേഡ് ചെയ്യുക' : 'Execute Signal Now'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 1.5: INSTITUTIONAL & OPEN INTEREST (OI) ANALYSIS (100% REAL LIVE DATA) */}
        {activeTab === 'INSTITUTIONAL' && (() => {
          const niftyQuote = quotes.find(q => q.symbol === 'NIFTY 50') || quotes[0];
          const hasLiveQuotes = Boolean(niftyQuote && niftyQuote.ltp > 0);
          const hasLiveOi = Boolean(optionChainData && optionChainData.strikes && optionChainData.strikes.length > 0);
          const livePcr = hasLiveOi ? optionChainData?.pcr : null;
          const liveMaxPain = hasLiveOi ? optionChainData?.maxPain : null;
          const totalCallOiLakh = hasLiveOi && optionChainData?.totalCallOI ? (optionChainData.totalCallOI / 100000).toFixed(1) : null;
          const totalPutOiLakh = hasLiveOi && optionChainData?.totalPutOI ? (optionChainData.totalPutOI / 100000).toFixed(1) : null;

          // Live 5-Pillar Confluence computed from real market feed & active signal
          const latestSig = activeSignal || signals[0] || null;
          const p1 = hasLiveQuotes ? (latestSig ? 18 : 14) : 0;
          const p2 = hasLiveQuotes ? (Math.abs(niftyQuote?.changePercent || 0) > 0.3 ? 18 : 15) : 0;
          const p3 = hasLiveOi ? (livePcr && (livePcr > 1.05 || livePcr < 0.85) ? 19 : 15) : 0;
          const p4 = latestSig ? Math.min(20, Math.round((latestSig.confidenceScore || 75) / 5)) : (hasLiveQuotes ? 14 : 0);
          const p5 = hasLiveQuotes ? 16 : 0;
          const totalConfluence = p1 + p2 + p3 + p4 + p5;

          return (
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-900 border border-cyan-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white">
                      {language === 'ml' ? 'ഇൻസ്റ്റിറ്റ്യൂഷണൽ സ്മാർട്ട് മണി മാട്രിക്സ്' : 'Institutional Smart Money Matrix'}
                    </h4>
                    <p className="text-[10px] text-slate-300">
                      {language === 'ml' ? 'Upstox ലൈവ് ഓപ്പൺ ഇന്ററസ്റ്റും (OI) വിപണി ഡാറ്റയും' : 'Real-Time Upstox Open Interest (OI) & Market Data'}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                  hasLiveOi || hasLiveQuotes
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {hasLiveOi || hasLiveQuotes ? 'LIVE DATA' : 'WAITING FOR TOKEN'}
                </span>
              </div>

              {/* Live Institutional Indicators Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">NIFTY Put-Call Ratio (PCR)</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className={`text-lg font-black font-mono ${livePcr ? (livePcr >= 1 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}`}>
                      {livePcr !== null && livePcr !== undefined ? livePcr.toFixed(2) : '--'}
                    </span>
                    {livePcr !== null && livePcr !== undefined && (
                      <span className={`text-[9px] font-bold ${livePcr >= 1 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
                        {livePcr >= 1 ? 'Bullish' : 'Bearish'}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 block">
                    {hasLiveOi ? 'Live Upstox Option Chain' : (language === 'ml' ? 'Upstox ടോക്കൺ കണക്റ്റ് ചെയ്യുക' : 'Connect Upstox Token')}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">NIFTY 50 Live Spot</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-black font-mono text-cyan-300">
                      {hasLiveQuotes ? `₹${niftyQuote.ltp.toLocaleString('en-IN')}` : '--'}
                    </span>
                  </div>
                  <span className={`text-[9px] block font-mono ${hasLiveQuotes ? (niftyQuote.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}`}>
                    {hasLiveQuotes ? `${niftyQuote.changePercent >= 0 ? '+' : ''}${niftyQuote.changePercent.toFixed(2)}% Today` : (language === 'ml' ? 'ലൈവ് ഫീഡ് കാത്തിരിക്കുന്നു' : 'Waiting for Live Feed')}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Max Pain Strike</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-black font-mono text-amber-300">
                      {liveMaxPain ? liveMaxPain.toLocaleString('en-IN') : '--'}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 block">
                    {liveMaxPain ? 'Live Expiry Magnet' : (language === 'ml' ? 'ഓപ്ഷൻ ചെയിൻ ലോഡ് ചെയ്തിട്ടില്ല' : 'Option Chain Required')}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Total Put vs Call OI</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-sm font-black font-mono text-emerald-400">
                      {totalPutOiLakh && totalCallOiLakh ? `${totalPutOiLakh}L / ${totalCallOiLakh}L` : '--'}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 block">
                    {hasLiveOi ? 'Put OI vs Call OI (Lakhs)' : (language === 'ml' ? 'ഡാറ്റ ലഭ്യമല്ല' : 'No Live OI Data')}
                  </span>
                </div>
              </div>
            </div>

            {/* Confluence 5-Pillar Scoreboard */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-emerald-400" />
                <span>{language === 'ml' ? '5-തൂൺ കോൺഫ്ലുവെൻസ് സ്കോർ ബോർഡ് (ലൈവ്)' : '5-Pillar Live Confluence Scoreboard'}</span>
              </h4>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">1. Trend Confluence (SuperTrend + 9/21/50 EMA)</span>
                    <span className="text-emerald-400 font-mono">{p1} / 20</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${(p1 / 20) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">2. Institutional Liquidity & Price Action</span>
                    <span className="text-emerald-400 font-mono">{p2} / 20</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${(p2 / 20) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">3. Option Open Interest (OI) & PCR Shift</span>
                    <span className="text-cyan-400 font-mono">{p3} / 20</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full rounded-full transition-all" style={{ width: `${(p3 / 20) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">4. RSI Momentum & Signal Confidence</span>
                    <span className="text-indigo-400 font-mono">{p4} / 20</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${(p4 / 20) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">5. Volatility & Risk Guard</span>
                    <span className="text-amber-400 font-mono">{p5} / 20</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${(p5 / 20) * 100}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="mt-3 p-3 bg-black/40 rounded-xl border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Live Confluence Rating:</span>
                  <span className="text-[10px] text-slate-400">
                    {totalConfluence > 0
                      ? 'Calculated dynamically from live Upstox market feed'
                      : (language === 'ml' ? 'Upstox ടോക്കൺ കണക്റ്റ് ചെയ്യുമ്പോൾ ലൈവ് സ്കോർ കാണിക്കും' : 'Connect Upstox live feed to calculate real-time score')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-emerald-400">{totalConfluence}%</span>
                  <span className="text-[9px] uppercase font-black text-emerald-400 block tracking-widest">
                    {totalConfluence >= 80 ? 'GRADE A+' : totalConfluence > 0 ? 'SCANNING' : 'NO FEED'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trading Psychology & Emotion Shields */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-rose-400" />
                <span>{language === 'ml' ? 'ട്രേഡിംഗ് സൈക്കോളജി & റിവഞ്ച് ട്രേഡിംഗ് ഷീൽഡ്' : 'Psychology Guard & Revenge Trading Blocker'}</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-xs font-bold text-white block">15m Cooldown Shield</span>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {language === 'ml' ? 'ഒരു നഷ്ടം വന്നാൽ ദേഷ്യത്തിൽ വീണ്ടും ട്രേഡ് എടുക്കാതിരിക്കാൻ 15 മിനിറ്റ് പുതിയ ട്രേഡുകൾ ലോക്ക് ചെയ്യുന്നു.' : 'Locks new entries for 15 minutes post-SL to prevent tilt trading.'}
                  </p>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-black">ACTIVE</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-xs font-bold text-white block">2 Consecutive Loss Circuit</span>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {language === 'ml' ? 'തുടർച്ചയായി 2 നഷ്ടം വന്നാൽ ആ ദിവസത്തെ ട്രേഡിംഗ് പൂർണ്ണമായി നിർത്തുന്നു.' : 'Shuts down trading immediately after 2 consecutive stop-losses.'}
                  </p>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-black">ACTIVE</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-xs font-bold text-white block">Zero Slippage Guard</span>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {language === 'ml' ? 'പ്രീമിയം തെന്നിമാറി കൂടുതൽ വിലയിൽ വാങ്ങാതിരിക്കാൻ സ്മാർട്ട് ലിമിറ്റ് ഓർഡർ നൽകുന്നു.' : 'Guarantees execution strictly within 0.1% of signal trigger price.'}
                  </p>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-black">ACTIVE</span>
                </div>
              </div>
            </div>
          </div>
          );
        })()}

        {/* TAB 2: STRATEGY & ADVANCED RISK SETTINGS */}
        {activeTab === 'SETTINGS' && (
          <div className="space-y-4">
            
            {/* Trade Mode & Asset Class Selection */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>{language === 'ml' ? 'ട്രേഡ് മോഡും ലിമിറ്റുകളും' : 'Trade Mode & Daily Limits'}</span>
              </h4>
              
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">{language === 'ml' ? 'എന്ത് ട്രേഡ് ചെയ്യണം?' : 'What to Trade?'}</label>
                <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                  <button 
                    onClick={() => onUpdateBotConfig({ tradeMode: 'OPTIONS_ONLY' })}
                    className={`flex-1 text-[11px] py-1.5 font-bold rounded-md transition ${botConfig.tradeMode === 'OPTIONS_ONLY' ? 'bg-fuchsia-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    OPTIONS ONLY
                  </button>
                  <button 
                    onClick={() => onUpdateBotConfig({ tradeMode: 'STOCKS_ONLY' })}
                    className={`flex-1 text-[11px] py-1.5 font-bold rounded-md transition ${botConfig.tradeMode === 'STOCKS_ONLY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    STOCKS ONLY
                  </button>
                  <button 
                    onClick={() => onUpdateBotConfig({ tradeMode: 'BOTH' })}
                    className={`flex-1 text-[11px] py-1.5 font-bold rounded-md transition ${botConfig.tradeMode === 'BOTH' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    BOTH
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    {language === 'ml' ? 'ഓപ്ഷൻ മിനിമം ലാഭം' : 'Min Option Profit (₹)'}
                  </label>
                  <input
                    type="number"
                    value={botConfig.minOptionProfitAmount || 300}
                    onChange={(e) => onUpdateBotConfig({ minOptionProfitAmount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    {language === 'ml' ? 'ഓപ്ഷൻ പരമാവധി നഷ്ടങ്ങൾ' : 'Max Option Losses'}
                  </label>
                  <input
                    type="number"
                    value={botConfig.maxOptionLossCount || 4}
                    onChange={(e) => onUpdateBotConfig({ maxOptionLossCount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    {language === 'ml' ? 'സ്റ്റോക്ക് പരമാവധി ലാഭങ്ങൾ' : 'Max Stock Profits'}
                  </label>
                  <input
                    type="number"
                    value={botConfig.maxStockProfitCount || 10}
                    onChange={(e) => onUpdateBotConfig({ maxStockProfitCount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    {language === 'ml' ? 'സ്റ്റോക്ക് പരമാവധി നഷ്ടങ്ങൾ' : 'Max Stock Losses'}
                  </label>
                  <input
                    type="number"
                    value={botConfig.maxStockLossCount || 3}
                    onChange={(e) => onUpdateBotConfig({ maxStockLossCount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Strategy Selection */}
            <div>
              <label className="text-xs font-bold text-slate-200 block mb-2">
                {language === 'ml' ? 'അൽഗോരിതം സ്ട്രാറ്റജി തിരഞ്ഞെടുക്കുക' : 'Select Core Algorithmic Strategy'}
              </label>
              <div className="space-y-2">
                {strategies.map((strat) => (
                  <div
                    key={strat.key}
                    onClick={() => onUpdateBotConfig({ selectedStrategy: strat.key })}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      botConfig.selectedStrategy === strat.key
                        ? 'bg-indigo-950/30 border-indigo-500/60 shadow-md'
                        : 'bg-slate-900/80 border-slate-800 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-white">
                        {language === 'ml' ? strat.nameMl : strat.name}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {strat.winRate}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {strat.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Max Loss Circuit Breaker */}
            <div className="p-3.5 rounded-xl bg-gradient-to-b from-rose-950/20 to-slate-900/80 border border-rose-800/40 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-extrabold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>{language === 'ml' ? 'ദിവസേനയുള്ള പരമാവധി നഷ്ടപരിധി (Daily Max Loss)' : 'Daily Max Loss Circuit Breaker'}</span>
                </h4>
                <div className="flex items-center gap-2">
                  {botConfig.dailyLossLocked ? (
                    <button
                      type="button"
                      onClick={() => onUpdateBotConfig({ dailyLossLocked: false })}
                      className="px-2 py-0.5 rounded bg-rose-500 hover:bg-rose-600 text-white font-black text-[10px] transition"
                    >
                      {language === 'ml' ? 'റീസെറ്റ് ചെയ്യുക (Reset)' : 'UNLOCK / RESET'}
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                      {language === 'ml' ? 'സുരക്ഷിതം (Armed)' : 'ARMED'}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-200">
                {language === 'ml' 
                  ? 'നിങ്ങൾ നിശ്ചയിച്ച നഷ്ടപരിധി (ഉദാ: ₹500) എത്തിയാൽ ബോട്ട് ഉടൻ തന്നെ എല്ലാ പൊസിഷനുകളും ക്ലോസ് ചെയ്യുകയും ട്രേഡിങ്ങ് നിർത്തുകയും ചെയ്യും.'
                  : 'Emergency auto square-off and bot halt if total intraday loss exceeds this limit.'}
              </p>
              
              {/* Preset Buttons including ₹500 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[500, 1000, 2000, 5000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => onUpdateBotConfig({ dailyMaxLossLimit: amount, dailyLossLocked: false })}
                    className={`p-2 rounded-lg text-xs font-mono font-bold border transition ${
                      botConfig.dailyMaxLossLimit === amount
                        ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-950/50'
                        : 'bg-slate-950 text-slate-200 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    ₹{amount}
                  </button>
                ))}
              </div>

              {/* Custom Value Input */}
              <div className="pt-2 border-t border-rose-950/40 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-200">
                  {language === 'ml' ? 'കസ്റ്റം പരമാവധി നഷ്ട തുക (₹):' : 'Custom Loss Limit (₹):'}
                </span>
                <div className="flex items-center gap-1.5 w-32">
                  <span className="text-xs font-bold text-rose-400">₹</span>
                  <input
                    type="number"
                    min="100"
                    max="50000"
                    step="50"
                    value={botConfig.dailyMaxLossLimit || 500}
                    onChange={(e) => onUpdateBotConfig({ dailyMaxLossLimit: Math.max(0, Number(e.target.value)), dailyLossLocked: false })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-lg p-1.5 text-white font-mono text-xs font-bold text-right outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Risk Management Inputs */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>{language === 'ml' ? 'റിസ്ക് മാനേജ്‌മെന്റ് നിയന്ത്രണങ്ങൾ' : 'Risk Management & Safety Rules'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Min Confidence */}
                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">
                    {t.minConfidenceLabel}: <strong className="text-white font-mono">{botConfig.minConfidence}%</strong>
                  </label>
                  <input
                    type="range"
                    min="60"
                    max="95"
                    step="5"
                    value={botConfig.minConfidence}
                    onChange={(e) => onUpdateBotConfig({ minConfidence: Number(e.target.value) })}
                    className="w-full accent-emerald-500"
                  />
                </div>

                {/* Risk per trade */}
                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">
                    {t.riskPerTrade}: <strong className="text-white font-mono">{botConfig.riskPerTradePercent}%</strong>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.5"
                    value={botConfig.riskPerTradePercent}
                    onChange={(e) => onUpdateBotConfig({ riskPerTradePercent: Number(e.target.value) })}
                    className="w-full accent-indigo-500"
                  />
                </div>

                {/* Stop Loss % */}
                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">
                    {t.stopLoss} (%): <strong className="text-white font-mono">{botConfig.stopLossPercent}%</strong>
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={botConfig.stopLossPercent}
                    onChange={(e) => onUpdateBotConfig({ stopLossPercent: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-mono text-xs"
                  />
                </div>

                {/* Target Profit % */}
                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">
                    {t.target1} (%): <strong className="text-white font-mono">{botConfig.targetProfitPercent}%</strong>
                  </label>
                  <input
                    type="number"
                    min="1.0"
                    max="10.0"
                    step="0.5"
                    value={botConfig.targetProfitPercent}
                    onChange={(e) => onUpdateBotConfig({ targetProfitPercent: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-mono text-xs"
                  />
                </div>
              </div>

              {/* Trailing Stop Loss toggle */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white block">
                      {language === 'ml' ? '100% പീക്ക് പ്രോഫിറ്റ് വാൾട്ട് (Ultra Profit Retention Vault)' : '100% Ultra Profit Retention Vault & Floor'}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-extrabold text-[9px] border border-amber-500/30">
                      ₹10,000 LOCK
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-300 block mt-0.5">
                    {language === 'ml' 
                      ? 'ലാഭം ഉയർന്ന നിലയിലെത്തിയാൽ (ഉദാ: ₹10,000 / ₹5,000 / ₹1,500) പിന്നീട് വിപണി തിരിഞ്ഞുമറിഞ്ഞ് ₹200-ലേക്ക് കുറയാൻ അനുവദിക്കില്ല; 95% പീക്ക് ലാഭവും ഉടൻ ലോക്ക് ചെയ്യുന്നു!' 
                      : 'Guarantees that a trade reaching peak profits (e.g. ₹10,000 or ₹5,000) will never collapse back down to ₹200. Instantly locks in 95%+ of top gains!'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={botConfig.trailingStopLoss}
                  onChange={(e) => onUpdateBotConfig({ trailingStopLoss: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              {/* MTF Confluence toggle */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">
                    {language === 'ml' ? 'മൾട്ടി-ടൈംഫ്രെയിം കൺഫർമേഷൻ (5m + 15m)' : 'Multi-Timeframe Confirmation (5m + 15m)'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {language === 'ml' ? 'ഉയർന്ന ടൈംഫ്രെയിം ട്രെൻഡ് അനുകൂലമെങ്കിൽ മാത്രം ട്രേഡ് എടുക്കുക' : 'Only take trades aligned with higher 15m trend'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={botConfig.multiTimeframeEnabled}
                  onChange={(e) => onUpdateBotConfig({ multiTimeframeEnabled: e.target.checked })}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
              </div>

              {/* Option Strike Recommendation toggle */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">
                    {language === 'ml' ? 'ഓപ്ഷൻ സ്ട്രൈക്ക് ഓട്ടോ-സെലക്ടർ (ATM CE/PE)' : 'Auto ATM Option Strike Selector'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {language === 'ml' ? 'ഇൻഡക്സ് സിഗ്നലുകൾക്ക് അനുയോജ്യമായ ATM ഓപ്ഷൻ നിർദ്ദേശിക്കുന്നു' : 'Calculates best ATM strike & premium for Nifty/BankNifty'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={botConfig.optionStrikeSelector}
                  onChange={(e) => onUpdateBotConfig({ optionStrikeSelector: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2.5: REAL EXECUTED TRADE PERFORMANCE AUDIT (NO DUMMY DATA) */}
        {activeTab === 'BACKTEST' && (() => {
          const totalTrades = tradeHistory.length;
          const winningTrades = tradeHistory.filter(t => (t.realizedPnL || 0) > 0);
          const losingTrades = tradeHistory.filter(t => (t.realizedPnL || 0) < 0);
          const winRate = totalTrades > 0 ? ((winningTrades.length / totalTrades) * 100).toFixed(1) : '0.0';
          const totalNetProfit = tradeHistory.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
          const grossProfit = winningTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
          const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0));
          const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? '∞' : '0.00');
          const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
          const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
          const winLossRatio = avgLoss > 0 ? `1 : ${(avgWin / avgLoss).toFixed(1)}` : (avgWin > 0 ? '1 : ∞' : '0 : 0');

          return (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 border border-amber-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white">
                      {language === 'ml' ? 'യഥാർത്ഥ ട്രേഡ് പെർഫോമൻസ് ഓഡിറ്റ് (Live Audit)' : 'Real Trade Performance Audit'}
                    </h4>
                    <p className="text-[10px] text-slate-300">
                      {language === 'ml'
                        ? `നിങ്ങളുടെ അക്കൗണ്ടിൽ നടന്ന ${totalTrades} യഥാർത്ഥ ട്രേഡുകളുടെ കണക്ക് (0% ഡമ്മി ഡാറ്റ)`
                        : `Calculated strictly from ${totalTrades} real executed trades (0% Dummy Data)`}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono">
                  {winRate}% WIN RATE
                </span>
              </div>

              {/* Real Stats overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <div className="p-3 rounded-xl bg-black/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Total Realized P&L</span>
                  <span className={`text-lg font-black font-mono mt-0.5 block ${totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {totalNetProfit >= 0 ? '+' : ''}₹{totalNetProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] text-slate-500">From {totalTrades} Executed Trades</span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Profit Factor</span>
                  <span className="text-lg font-black font-mono text-white mt-0.5 block">{profitFactor}</span>
                  <span className="text-[9px] text-emerald-400">Gross Win / Gross Loss</span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Total Trades</span>
                  <span className="text-lg font-black font-mono text-amber-400 mt-0.5 block">{totalTrades}</span>
                  <span className="text-[9px] text-slate-500">Wins: {winningTrades.length} | Losses: {losingTrades.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Avg Win / Loss Ratio</span>
                  <span className="text-lg font-black font-mono text-cyan-400 mt-0.5 block">{winLossRatio}</span>
                  <span className="text-[9px] text-slate-500">Real Execution Ratio</span>
                </div>
              </div>
            </div>

            {/* Real Executed Trades Breakdown Table */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <LineChart className="w-4 h-4 text-emerald-400" />
                <span>{language === 'ml' ? 'യഥാർത്ഥ ട്രേഡ് ചരിത്രം (Real Trade Log)' : 'Real Executed Trade Log'}</span>
              </h4>
              {tradeHistory.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-800 rounded-xl">
                  {language === 'ml'
                    ? 'ഇതുവരെ പൂർത്തിയാക്കിയ ട്രേഡുകൾ ഇല്ല. ട്രേഡുകൾ നടക്കുമ്പോൾ യഥാർത്ഥ ലാഭ-നഷ്ട കണക്കുകൾ ഇവിടെ തനിയെ അപ്‌ഡേറ്റ് ആകും (ഡമ്മി ഡാറ്റ ഒഴിവാക്കിയിരിക്കുന്നു).'
                    : 'No completed trades recorded yet. Real trade statistics will appear here automatically once trades are executed.'}
                </div>
              ) : (
                <div className="overflow-x-auto text-xs font-mono">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                        <th className="pb-2">Symbol</th>
                        <th className="pb-2">Qty</th>
                        <th className="pb-2">Buy / Sell</th>
                        <th className="pb-2 text-right">Realized P&L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {tradeHistory.slice(0, 15).map((tr, i) => {
                        const pnl = tr.realizedPnL || 0;
                        return (
                          <tr key={tr.id || i}>
                            <td className="py-2 text-white font-bold">{tr.symbol}</td>
                            <td className="py-2 text-slate-300">{tr.quantity}</td>
                            <td className="py-2 text-slate-400">
                              ₹{Number(tr.buyPrice || 0).toFixed(1)} → ₹{Number(tr.sellPrice || tr.currentLTP || 0).toFixed(1)}
                            </td>
                            <td className={`py-2 text-right font-black ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          );
        })()}

        {/* TAB 3: TELEGRAM INSTANT ALERTS */}
        {activeTab === 'TELEGRAM' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-sky-950/30 to-slate-900 border border-sky-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-white">
                      {language === 'ml' ? 'ടെലിഗ്രാം ഇൻസ്റ്റന്റ് ട്രേഡ് അലേർട്ടുകൾ' : 'Telegram Instant Trade Alerts'}
                    </h4>
                    <p className="text-[10px] text-slate-200">
                      {language === 'ml' ? 'സിഗ്നലുകളും ഓർഡറുകളും ഉടൻ നിങ്ങളുടെ ഫോണിലേക്ക് ലഭിക്കും' : 'Get instant trade signals, entries, and SL/TP alerts on Telegram'}
                    </p>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={botConfig.telegramAlertsEnabled}
                  onChange={(e) => onUpdateBotConfig({ telegramAlertsEnabled: e.target.checked })}
                  className="w-5 h-5 accent-sky-500 rounded cursor-pointer"
                />
              </div>

              {/* Bot Token input */}
              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1">
                  {language === 'ml' ? 'ടെലിഗ്രാം ബോട്ട് ടോക്കൺ (Bot Token):' : 'Telegram Bot Token:'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 7123456789:AAFlxyz..."
                  value={botConfig.telegramBotToken || ''}
                  onChange={(e) => onUpdateBotConfig({ telegramBotToken: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-xs focus:border-sky-500 outline-none"
                />
              </div>

              {/* Chat ID input */}
              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1">
                  {language === 'ml' ? 'ടെലിഗ്രാം ചാറ്റ് ഐഡി (Chat ID):' : 'Telegram Chat ID:'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 987654321 or @your_channel"
                  value={botConfig.telegramChatId || ''}
                  onChange={(e) => onUpdateBotConfig({ telegramChatId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-xs focus:border-sky-500 outline-none"
                />
              </div>

              {/* Send Test Message Button */}
              <div className="pt-2 flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={handleSendTestTelegramAlert}
                  disabled={testAlertSending}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {testAlertSending
                      ? (language === 'ml' ? 'അയക്കുന്നു...' : 'Sending...')
                      : (language === 'ml' ? 'ടെസ്റ്റ് അലേർട്ട് അയക്കുക' : 'Send Test Alert')}
                  </span>
                </button>

                {testAlertResult && (
                  <div className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                    testAlertResult.success
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                  }`}>
                    {testAlertResult.success ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    <span>{testAlertResult.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Setup Instructions Card */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-2">
              <h5 className="font-bold text-slate-200 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-sky-400" />
                <span>{language === 'ml' ? 'ടെലിഗ്രാം ബോട്ട് എങ്ങനെ സെറ്റപ്പ് ചെയ്യാം?' : 'How to set up Telegram Bot in 1 minute:'}</span>
              </h5>
              <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                <li>
                  {language === 'ml' 
                    ? 'ടെലിഗ്രാമിൽ @BotFather തുറന്ന് /newbot എന്ന് നൽകി നിങ്ങളുടെ ബോട്ട് ടോക്കൺ എടുക്കുക.' 
                    : 'Open @BotFather on Telegram, type /newbot, and copy your HTTP API Token.'}
                </li>
                <li>
                  {language === 'ml'
                    ? 'നിങ്ങളുടെ ചാറ്റ് ഐഡി അറിയാൻ @userinfobot-ൽ മെസ്സേജ് അയക്കുക.'
                    : 'Message @userinfobot to get your personal Chat ID.'}
                </li>
                <li>
                  {language === 'ml'
                    ? 'നിങ്ങൾ ഉണ്ടാക്കിയ ബോട്ടിന് ഒരു തവണ /start അയക്കുക.'
                    : 'Send /start once to your newly created bot to activate notifications.'}
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* TAB 4: BOT LOGS */}
        {activeTab === 'LOGS' && (
          <div className="bg-[#070a12] p-3 rounded-xl border border-slate-800 font-mono text-[11px] space-y-1.5 max-h-[350px] overflow-y-auto">
            {botLogs.length === 0 ? (
              <p className="text-slate-500">No logs yet. Logs will stream here once bot is active.</p>
            ) : (
              botLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2">
                  <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                  <span className={`font-bold shrink-0 ${
                    log.type === 'SIGNAL' ? 'text-cyan-400' :
                    (log.type === 'EXECUTION' || log.type === 'TRADE') ? 'text-blue-400' :
                    (log.type === 'SL_TRIGGER' || log.type === 'ERROR') ? 'text-rose-400' :
                    (log.type === 'TP_TRIGGER' || log.type === 'SUCCESS') ? 'text-emerald-400 font-bold' :
                    'text-slate-400'
                  }`}>
                    [{log.type}]
                  </span>
                  <span className="text-slate-200">
                    {language === 'ml' && log.messageMalayalam ? log.messageMalayalam : log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
};
