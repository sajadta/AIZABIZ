import React, { useState, useEffect } from 'react';
import { BellRing, Smartphone, Volume2, VolumeX, Globe, ShieldCheck, AlertOctagon, Zap, Key, RefreshCw, Cpu, Clock } from 'lucide-react';
import { ExecutionMode, Language, UpstoxApiConfig } from '../types';
import { translations } from '../translations';

interface HeaderProps {
  isWsConnected: boolean;
  mode: ExecutionMode;
  setMode: (mode: ExecutionMode) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  apiConfig: UpstoxApiConfig;
  onOpenApiSettings: () => void;
  onOpenAndroidModal: () => void;
  activePositionsCount: number;
  onSquareOffAll: () => void;
  totalPnL: number;
  dailyProfit: number;
  cumulativeProfit?: number;
  onOpenAlerts: () => void;
  virtualCapital?: number;
  onResetPaperAccount?: () => void;
  botEnabled?: boolean;
  onToggleBot?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  setMode,
  language,
  setLanguage,
  soundEnabled,
  setSoundEnabled,
  apiConfig,
  onOpenApiSettings,
  onOpenAndroidModal,
  activePositionsCount,
  onSquareOffAll,
  totalPnL,
  dailyProfit,
  cumulativeProfit,
  isWsConnected: _isWsConnected,
  onOpenAlerts,
  virtualCapital = 2000,
  onResetPaperAccount,
  botEnabled = false,
  onToggleBot,
  }) => {
  const t = translations[language];

  const [istTime, setIstTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setIstTime(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getMarketSession = () => {
    const now = new Date();
    const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const day = istDate.getDay();
    const totalMins = istDate.getHours() * 60 + istDate.getMinutes();
    const isWeekday = day >= 1 && day <= 5;
    const isMarketOpen = isWeekday && totalMins >= (9 * 60 + 15) && totalMins <= (15 * 60 + 30);
    return { isMarketOpen, isWeekday };
  };
  const marketSession = getMarketSession();

  return (
    <header className="w-full max-w-full min-w-0 bg-[#080c16]/95 backdrop-blur-md border-b border-slate-800/90 sticky top-0 z-40 px-2 sm:px-6 py-1.5 overflow-x-hidden shrink-0 shadow-lg shadow-black/30">
      <div className="w-full max-w-[1720px] mx-auto flex items-center justify-between gap-1 sm:gap-4 min-w-0">
        
        {/* Brand & Market Status */}
        <div className="flex items-center gap-1 sm:gap-3 min-w-0 shrink">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div 
              style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
              className="sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-500/30 via-slate-800 to-indigo-500/30 border border-emerald-500/40 p-0.5 shadow-md shadow-emerald-950/50 flex items-center justify-center shrink-0"
            >
              <div className="w-full h-full bg-[#090d16] rounded-[8px] flex items-center justify-center overflow-hidden">
                <img 
                  src="/aizabiz-logo.jpg" 
                  alt="AIZABIZ Logo" 
                  width={36}
                  height={36}
                  style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', objectFit: 'cover', display: 'block' }}
                  className="w-full h-full object-cover" 
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xs sm:text-lg font-black tracking-tight text-white drop-shadow-sm">
                  AIZA<span className="text-emerald-400">BIZ</span>
                </span>
                <span className="px-1 py-0.2 rounded text-[7px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden md:block">
                {language === 'ml' ? 'ഓട്ടോമേറ്റഡ് ട്രേഡിംഗ് പ്ലാറ്റ്ഫോം' : 'Live Algorithmic Execution Terminal'}
              </p>
            </div>
          </div>

          {/* Mode Switcher - Compact mobile pill with min 40px touch target */}
          <div className="flex sm:hidden items-center shrink-0">
            <button
              id="btn-mode-mobile"
              onClick={() => {
                if (mode === 'PAPER_TRADING') {
                  if (!apiConfig.isConnected) onOpenApiSettings();
                  else setMode('UPSTOX_LIVE');
                } else {
                  setMode('PAPER_TRADING');
                }
              }}
              className={`min-h-[36px] px-2 py-1 rounded-lg text-[9px] font-extrabold flex items-center justify-center gap-1 border transition active:scale-95 touch-manipulation select-none ${
                mode === 'UPSTOX_LIVE'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                  : 'bg-blue-500/20 border-blue-500/40 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.25)]'
              }`}
              title={mode === 'UPSTOX_LIVE' ? 'Switch to Paper Mode' : 'Switch to Upstox Live Mode'}
            >
              {mode === 'UPSTOX_LIVE' ? <Zap className="w-3 h-3 text-emerald-400" /> : <ShieldCheck className="w-3 h-3 text-blue-400" />}
              <span>{mode === 'UPSTOX_LIVE' ? 'LIVE' : 'PAPER'}</span>
            </button>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden md:block" />

          {/* Market Status & Live IST Time Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs shadow-inner">
            <span className="relative flex h-2 w-2">
              {marketSession.isMarketOpen && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${marketSession.isMarketOpen ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className={`font-mono font-bold text-[11px] ${marketSession.isMarketOpen ? 'text-emerald-400' : 'text-amber-400'}`}>
              {marketSession.isMarketOpen ? (language === 'ml' ? 'മാർക്കറ്റ് ലൈവ്' : 'MARKET OPEN') : (language === 'ml' ? 'മാർക്കറ്റ് ക്ലോസ്ഡ്' : 'MARKET CLOSED')}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300 font-mono text-[11px] flex items-center gap-1 font-bold">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>{istTime} IST</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className={`font-mono text-[10px] ${apiConfig.isConnected ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
              {apiConfig.isConnected ? 'UPSTOX: LIVE' : 'PAPER (09:15-15:30)'}
            </span>
          </div>
        </div>

        {/* Center: Mode Switcher (Desktop) & PnL Quick View */}
        <div className="hidden sm:flex items-center gap-2 sm:gap-3">
          {/* Mode Switcher Desktop */}
          <div className="bg-slate-900/90 p-0.5 rounded-xl border border-slate-800 flex items-center">
            <button
              id="btn-mode-paper"
              onClick={() => setMode('PAPER_TRADING')}
              className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                mode === 'PAPER_TRADING'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{language === 'ml' ? 'പേപ്പർ (₹2,000)' : 'Paper (₹2,000)'}</span>
            </button>
            <button
              id="btn-mode-live"
              onClick={() => {
                if (!apiConfig.isConnected) {
                  onOpenApiSettings();
                } else {
                  setMode('UPSTOX_LIVE');
                }
              }}
              className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                mode === 'UPSTOX_LIVE'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20 animate-pulse'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{language === 'ml' ? 'അപ്സ്റ്റോക്സ് ലൈവ്' : 'Upstox Live'}</span>
              {!apiConfig.isConnected && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          </div>

          {/* Sleek Unified Metrics Ribbon (Zero Box Clutter) */}
          <div className="hidden md:flex items-center divide-x divide-slate-800/70 bg-slate-900/40 backdrop-blur-sm rounded-xl px-2 py-1 text-xs shadow-inner">
            {/* Day P&L */}
            <div className="flex items-center gap-1.5 px-3 py-1 font-mono">
              <span className="text-[10px] uppercase font-sans font-semibold text-slate-400 tracking-wider">
                {language === 'ml' ? 'ഇന്ന്:' : 'Day:'}
              </span>
              <span className={`font-bold ${dailyProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {dailyProfit >= 0 ? `+₹${dailyProfit.toFixed(2)}` : `-₹${Math.abs(dailyProfit).toFixed(2)}`}
              </span>
            </div>

            {/* Total Cumulative P&L */}
            <div className="flex items-center gap-1.5 px-3 py-1 font-mono" title={language === 'ml' ? 'ആകെ മൊത്തം ട്രേഡിംഗ് ലാഭം/നഷ്ടം' : 'Total All-Time Cumulative P&L'}>
              <span className="text-[10px] uppercase font-sans font-semibold text-slate-400 tracking-wider">
                {t.cumulativePnL}:
              </span>
              <span className={`font-bold ${(cumulativeProfit ?? dailyProfit) >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
                {(cumulativeProfit ?? dailyProfit) >= 0 ? `+₹${(cumulativeProfit ?? dailyProfit).toFixed(2)}` : `-₹${Math.abs(cumulativeProfit ?? dailyProfit).toFixed(2)}`}
              </span>
            </div>

            {/* Account Balance (Live Margin or Paper) */}
            <div className="flex items-center gap-1.5 px-3 py-1 font-mono" title={mode === 'UPSTOX_LIVE' ? 'Upstox Real Available Margin' : 'Paper Trading Virtual Account Balance'}>
              <span className="text-[10px] uppercase font-sans font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                {mode === 'UPSTOX_LIVE' ? <Zap className="w-3 h-3 text-emerald-400" /> : <ShieldCheck className="w-3 h-3 text-cyan-400" />}
                {mode === 'UPSTOX_LIVE' ? (language === 'ml' ? 'ലൈവ്:' : 'Live:') : (language === 'ml' ? 'പേപ്പർ:' : 'Paper:') }
              </span>
              <span className="font-bold text-slate-100 font-mono">
                ₹{mode === 'UPSTOX_LIVE' 
                  ? (apiConfig.isConnected 
                      ? Number(apiConfig.totalBalance || apiConfig.availableMargin || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                      : '0.00')
                  : Number(virtualCapital ?? 2000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {mode === 'PAPER_TRADING' && onResetPaperAccount && (
                <button
                  onClick={() => {
                    if (onResetPaperAccount) onResetPaperAccount();
                  }}
                  title={t.resetPaper}
                  className="ml-2 p-1 hover:bg-rose-500/20 text-rose-400 rounded transition"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* MTM for Active Positions */}
            {activePositionsCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 font-mono">
                <span className="text-[10px] uppercase font-sans font-semibold text-slate-400">MTM:</span>
                <span className={`font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {totalPnL >= 0 ? `+₹${totalPnL.toFixed(2)}` : `-₹${Math.abs(totalPnL).toFixed(2)}`}
                </span>
                <button
                  onClick={onSquareOffAll}
                  title="Panic Exit All Positions"
                  className="p-1 hover:bg-rose-500/20 text-rose-400 rounded transition ml-1"
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Algo Bot Quick Toggle */}
            <div className="flex items-center gap-1.5 px-3 py-1">
              <button
                onClick={onToggleBot}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all text-[10px] font-black uppercase ${
                  botEnabled 
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                    : 'bg-slate-800/80 border-slate-700 text-slate-400'
                }`}
              >
                <Cpu className={`w-3 h-3 ${botEnabled ? 'animate-pulse' : ''}`} />
                <span>{botEnabled ? t.algoOn : t.algoOff}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Controls - Mobile & Desktop Responsive Adaptive Bar */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          
          {/* Upstox Daily Token Status & Setup Button */}
          <button
            id="btn-api-settings"
            onClick={onOpenApiSettings}
            className={`h-8 sm:min-h-[44px] px-2 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition active:scale-95 touch-manipulation shrink-0 ${
              apiConfig.isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 animate-pulse'
            }`}
            title={apiConfig.isConnected ? 'Upstox Daily Token Active' : 'Enter Today\'s Upstox Token'}
          >
            {apiConfig.isConnected ? (
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            ) : (
              <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            )}
            <span className="font-bold hidden sm:inline">
              {apiConfig.isConnected 
                ? (language === 'ml' ? 'ടോക്കൺ സജീവം' : 'Token Active')
                : (language === 'ml' ? '☀️ ഡെയിലി ടോക്കൺ' : '☀️ Daily Token')}
            </span>
          </button>

          {/* Alerts Toggle */}
          <button
            id="btn-alerts-toggle"
            onClick={onOpenAlerts}
            className="w-8 h-8 sm:w-11 sm:h-11 min-w-[32px] sm:min-w-[44px] shrink-0 flex items-center justify-center rounded-lg sm:rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 active:scale-95 transition touch-manipulation"
            title={language === 'ml' ? 'അലർട്ടുകൾ' : 'Price Alerts'}
          >
            <BellRing className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          
          {/* Sound Toggle */}
          <button
            id="btn-sound-toggle"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`w-8 h-8 sm:w-11 sm:h-11 min-w-[32px] sm:min-w-[44px] shrink-0 flex items-center justify-center rounded-lg sm:rounded-xl border transition active:scale-95 touch-manipulation ${
              soundEnabled
                ? 'bg-slate-900 border-slate-700 text-emerald-400 hover:bg-slate-800'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800'
            }`}
            title={soundEnabled ? t.soundOn : t.soundOff}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>

          {/* Android Mobile App / Desktop PWA install button */}
          <button
            id="btn-android-modal"
            onClick={onOpenAndroidModal}
            className="w-8 h-8 sm:w-11 sm:h-11 min-w-[32px] sm:min-w-[40px] shrink-0 flex items-center justify-center rounded-lg sm:rounded-xl border border-slate-800 bg-slate-900 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 active:scale-95 transition touch-manipulation"
            title={language === 'ml' ? 'ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുക' : 'Install App'}
          >
            <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Language Toggle */}
          <button
            id="btn-language-toggle"
            onClick={() => setLanguage(language === 'en' ? 'ml' : 'en')}
            className="h-8 sm:min-h-[44px] px-2 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-[10px] sm:text-xs font-bold text-slate-200 flex items-center justify-center gap-1 active:scale-95 transition shrink-0 touch-manipulation"
            title="Switch Language / ഭാഷ മാറ്റുക"
          >
            <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
            <span>{language === 'en' ? 'മല' : 'EN'}</span>
          </button>
        </div>

      </div>

      {/* Mobile Sub-Header: Seamless Integrated Financial Strip (Zero Box Clutter) */}
      <div className="sm:hidden w-full mt-1.5 pt-1.5 border-t border-slate-800/60 flex items-center justify-around divide-x divide-slate-800/60 text-center">
        {/* 1. Day Realized P&L */}
        <div className="flex-1 flex flex-col items-center justify-center px-1 min-w-0" title={language === 'ml' ? 'ഇന്നത്തെ അറ്റ ലാഭം / നഷ്ടം (Net Daily P&L)' : "Today's Net P&L"}>
          <span className="text-[8px] uppercase font-sans font-semibold text-slate-400 tracking-wider">
            {t.todayPnL}
          </span>
          <span className={`font-mono text-xs font-bold ${dailyProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {dailyProfit >= 0 ? `+₹${dailyProfit.toFixed(2)}` : `-₹${Math.abs(dailyProfit).toFixed(2)}`}
          </span>
        </div>

        {/* 2. Total Cumulative P&L */}
        <div className="flex-1 flex flex-col items-center justify-center px-1 min-w-0" title={language === 'ml' ? 'ആകെ മൊത്തം അറ്റ ലാഭം (Total Net P&L)' : "Total Net P&L"}>
          <span className="text-[8px] uppercase font-sans font-semibold text-slate-400 tracking-wider">
            {t.cumulativePnL}
          </span>
          <span className={`font-mono text-xs font-bold ${(cumulativeProfit ?? dailyProfit) >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
            {(cumulativeProfit ?? dailyProfit) >= 0 ? `+₹${(cumulativeProfit ?? dailyProfit).toFixed(2)}` : `-₹${Math.abs(cumulativeProfit ?? dailyProfit).toFixed(2)}`}
          </span>
        </div>

        {/* 3. Account Money Balance */}
        <div className="flex-1 flex flex-col items-center justify-center px-1 min-w-0" title={mode === 'UPSTOX_LIVE' ? 'Upstox Real Available Margin / Balance' : 'Paper Trading Virtual Account Balance'}>
          <span className="text-[8px] uppercase font-sans font-semibold text-slate-400 tracking-wider">
            {mode === 'UPSTOX_LIVE' ? (language === 'ml' ? 'ലൈവ് ക്യാഷ്' : 'Live Cash') : (language === 'ml' ? 'പേപ്പർ' : 'Paper Bal')}
          </span>
          <span className="font-mono text-xs font-bold text-slate-200">
            ₹{mode === 'UPSTOX_LIVE' 
              ? (apiConfig.isConnected 
                  ? Number(apiConfig.totalBalance || apiConfig.availableMargin || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                  : '0.00')
              : Number(virtualCapital ?? 2000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Mobile Sub-Header Strip 2: Live IST Clock & Upstox Market Session */}
      <div className="sm:hidden w-full mt-1 px-1.5 py-0.5 rounded-lg bg-slate-950/70 border border-slate-800/60 flex items-center justify-between text-[10px] font-mono">
        <div className="flex items-center gap-1.5 text-slate-300 font-bold">
          <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
          <span>{istTime} IST</span>
          <span className="text-slate-600">|</span>
          <span className={`flex items-center gap-1 ${marketSession.isMarketOpen ? 'text-emerald-400' : 'text-amber-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${marketSession.isMarketOpen ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{marketSession.isMarketOpen ? (language === 'ml' ? 'മാർക്കറ്റ് ലൈവ്' : 'OPEN') : (language === 'ml' ? 'ക്ലോസ്ഡ്' : 'CLOSED')}</span>
          </span>
        </div>
        <div className="flex items-center gap-1 text-[9px] font-mono">
          <span className={`px-1.5 py-0.2 rounded font-bold ${apiConfig.isConnected ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' : 'bg-slate-900 text-slate-400'}`}>
            {apiConfig.isConnected ? 'UPSTOX: LIVE' : 'PAPER'}
          </span>
          <span className="text-slate-400 text-[9px]">09:15-15:30</span>
        </div>
      </div>

      {/* Active MTM row on mobile if open positions exist */}
      {activePositionsCount > 0 && (
        <div className="sm:hidden w-full mt-1 flex items-center justify-between px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono">
          <span className="text-slate-400 text-[9px] uppercase font-sans font-bold">
            {language === 'ml' ? 'ഓപ്പൺ ട്രേഡ് MTM:' : 'Open MTM:'}
          </span>
          <span className={`font-black ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalPnL >= 0 ? `+₹${totalPnL.toFixed(2)}` : `-₹${Math.abs(totalPnL).toFixed(2)}`}
          </span>
          <button
            onClick={onSquareOffAll}
            className="px-2 py-0.5 rounded bg-rose-600/30 text-rose-300 border border-rose-500/40 text-[9px] font-black uppercase"
          >
            {language === 'ml' ? 'സ്ക്വയർ-ഓഫ്' : 'Exit All'}
          </button>
        </div>
      )}
    </header>
  );
};
