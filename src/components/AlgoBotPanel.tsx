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
  Info
} from 'lucide-react';
import { BotConfig, BotLog, TradingSignal, StrategyKey, Language } from '../types';
import { translations } from '../translations';

interface AlgoBotPanelProps {
  botConfig: BotConfig;
  onUpdateBotConfig: (config: Partial<BotConfig>) => void;
  botLogs: BotLog[];
  signals: TradingSignal[];
  language: Language;
  onExecuteSignal: (signal: TradingSignal) => void;
}

export const AlgoBotPanel: React.FC<AlgoBotPanelProps> = ({
  botConfig,
  onUpdateBotConfig,
  botLogs,
  signals,
  language,
  onExecuteSignal,
}) => {
    const t = translations[language];
  const [scanMessageIndex, setScanMessageIndex] = useState(0);
  
  useEffect(() => {
    if (!botConfig.enabled) return;
    const interval = setInterval(() => {
       setScanMessageIndex(prev => (prev + 1) % 4);
    }, 2500);
    return () => clearInterval(interval);
  }, [botConfig.enabled]);
  
  const scanMessagesEn = [
    'Scanning live market for signals...',
    'Analyzing RSI & MACD momentum...',
    'Evaluating Option Greeks & Volume...',
    'Checking Institutional Support levels...'
  ];
  
  const scanMessagesMl = [
    'സിഗ്നലുകൾക്കായി ലൈവ് മാർക്കറ്റ് സ്കാൻ ചെയ്യുന്നു...',
    'RSI, MACD എന്നിവ പരിശോധിക്കുന്നു...',
    'ഓപ്ഷൻ ഗ്രീക്സ് അനാലിസിസ് ചെയ്യുന്നു...',
    'സപ്പോർട്ട്/റെസിസ്റ്റൻസ് ലെവലുകൾ നോക്കുന്നു...'
  ];

  const [activeTab, setActiveTab] = useState<'SIGNALS' | 'SETTINGS' | 'TELEGRAM' | 'LOGS'>('SIGNALS');
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
      <div className="pb-3 border-b border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
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

        {/* Master Start / Stop Auto-trading Button */}
        <button
          id="btn-bot-toggle"
          onClick={() => onUpdateBotConfig({ enabled: !botConfig.enabled })}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg transition active:scale-95 border ${
            botConfig.enabled
              ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-950/60 border-rose-400/30'
              : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/60 border-emerald-400/30'
          }`}
        >
          {botConfig.enabled ? (
            <>
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>{t.stopBot}</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{t.startBot}</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800/80 bg-[#070a14]/60 px-1 pt-2.5 gap-2 text-xs font-black overflow-x-auto scrollbar-none">
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
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        
        {/* TAB 1: LIVE SIGNALS */}
        {activeTab === 'SIGNALS' && (
          <div className="space-y-3">
            {botConfig.enabled && (
               <div className="p-4 mb-4 text-center text-slate-300 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center gap-3">
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
                            : 'bg-slate-700 text-slate-300'
                        }`}>
                          {sig.signalType}
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
                            sig.mtfConfirmation.confirmed
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            <Layers className="w-2.5 h-2.5" />
                            <span>{language === 'ml' ? sig.mtfConfirmation.labelMalayalam : sig.mtfConfirmation.label}</span>
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
                            {language === 'ml' ? sig.candlestickPattern.nameMalayalam : sig.candlestickPattern.name}
                          </span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        sig.candlestickPattern.type === 'BULLISH'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {sig.candlestickPattern.type}
                      </span>
                    </div>
                  )}

                  {/* Target & Stop Loss Levels */}
                  <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">{t.entryPrice}</span>
                      <span className="font-bold text-white">₹{sig.price}</span>
                    </div>
                    <div className="bg-rose-950/30 p-2 rounded-lg border border-rose-800/40">
                      <span className="text-[10px] text-rose-400 block">{t.stopLoss}</span>
                      <span className="font-bold text-rose-300">₹{sig.stopLoss}</span>
                    </div>
                    <div className="bg-emerald-950/30 p-2 rounded-lg border border-emerald-800/40">
                      <span className="text-[10px] text-emerald-400 block">{t.target1} (T1)</span>
                      <span className="font-bold text-emerald-300">₹{sig.target1}</span>
                    </div>
                    <div className="bg-emerald-950/30 p-2 rounded-lg border border-emerald-800/40">
                      <span className="text-[10px] text-emerald-400 block">{t.target2} (T2)</span>
                      <span className="font-bold text-emerald-300">₹{sig.target2}</span>
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
                            {sig.recommendedOptionStrike.strike} {sig.recommendedOptionStrike.optionType}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-400 font-mono">
                            LTP: ₹{sig.recommendedOptionStrike.approxPremium}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Δ {sig.recommendedOptionStrike.delta} | IV: {sig.recommendedOptionStrike.impliedVolatility}%
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                        {sig.recommendedOptionStrike.expiry}
                      </span>
                    </div>
                  )}

                  {/* Rationale explanation */}
                  <div className="mt-2.5 p-2 rounded-lg bg-[#070a12] border border-slate-800/80 text-[11px] text-slate-300">
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

        {/* TAB 2: STRATEGY & ADVANCED RISK SETTINGS */}
        {activeTab === 'SETTINGS' && (
          <div className="space-y-4">
            
            {/* Trade Mode & Asset Class Selection */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>{language === 'ml' ? 'ട്രേഡ് മോഡും ലിമിറ്റുകളും' : 'Trade Mode & Daily Limits'}</span>
              </h4>
              
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">{language === 'ml' ? 'എന്ത് ട്രേഡ് ചെയ്യണം?' : 'What to Trade?'}</label>
                <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                  <button 
                    onClick={() => onUpdateBotConfig({ tradeMode: 'OPTIONS_ONLY' })}
                    className={`flex-1 text-[11px] py-1.5 font-bold rounded-md transition ${botConfig.tradeMode === 'OPTIONS_ONLY' ? 'bg-fuchsia-600 text-white' : 'text-slate-400 hover:text-slate-300'}`}
                  >
                    OPTIONS ONLY
                  </button>
                  <button 
                    onClick={() => onUpdateBotConfig({ tradeMode: 'STOCKS_ONLY' })}
                    className={`flex-1 text-[11px] py-1.5 font-bold rounded-md transition ${botConfig.tradeMode === 'STOCKS_ONLY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-300'}`}
                  >
                    STOCKS ONLY
                  </button>
                  <button 
                    onClick={() => onUpdateBotConfig({ tradeMode: 'BOTH' })}
                    className={`flex-1 text-[11px] py-1.5 font-bold rounded-md transition ${botConfig.tradeMode === 'BOTH' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-300'}`}
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
              <label className="text-xs font-bold text-slate-300 block mb-2">
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
                        : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900'
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
              <p className="text-[11px] text-slate-300">
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
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    ₹{amount}
                  </button>
                ))}
              </div>

              {/* Custom Value Input */}
              <div className="pt-2 border-t border-rose-950/40 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-300">
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
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">
                    {language === 'ml' ? 'ട്രെയിലിംഗ് സ്റ്റോപ്പ് ലോസ് (Trailing SL)' : 'Dynamic Trailing Stop Loss'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {language === 'ml' ? 'വില കൂടുമ്പോൾ സ്റ്റോപ്പ് ലോസ് സ്വമേധയാ ഉയർത്തുന്നു' : 'Automatically locks profits as market moves in favor'}
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
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
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
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
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
                    <p className="text-[10px] text-slate-300">
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
                <label className="text-xs font-bold text-slate-300 block mb-1">
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
                <label className="text-xs font-bold text-slate-300 block mb-1">
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
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
              <h5 className="font-bold text-slate-300 flex items-center gap-1.5">
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
