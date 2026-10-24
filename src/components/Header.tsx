import React from 'react';
import {
  BellRing,
  TrendingUp, 
  Smartphone, 
  Settings, 
  Volume2, 
  VolumeX, 
  Globe, 
  ShieldCheck, 
  AlertOctagon, 
  Activity,
  Zap,
  Wifi,
  WifiOff,
  Key,
  Palette,
} from 'lucide-react';
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
  isWsConnected,
  onOpenAlerts,
  virtualCapital = 2000,
  }) => {
  const t = translations[language];

  return (
    <header className="w-full max-w-full min-w-0 bg-[#080c16]/95 backdrop-blur-md border-b border-slate-800/90 sticky top-0 z-40 px-2 sm:px-6 py-1.5 overflow-x-auto no-scrollbar shrink-0 shadow-lg shadow-black/30">
      <div className="w-full max-w-[1720px] mx-auto flex items-center justify-between gap-1 sm:gap-4 min-w-0">
        
        {/* Brand & Market Status */}
        <div className="flex items-center gap-1 sm:gap-3 min-w-0 shrink">
          <div className="flex items-center gap-2 shrink-0">
            <div 
              style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px', maxWidth: '36px', maxHeight: '36px' }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-500/30 via-slate-800 to-indigo-500/30 border border-emerald-500/40 p-0.5 shadow-md shadow-emerald-950/50 flex items-center justify-center shrink-0"
            >
              <div className="w-full h-full bg-[#090d16] rounded-[9px] flex items-center justify-center overflow-hidden">
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
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-lg font-black tracking-tight text-white drop-shadow-sm">
                  AIZA<span className="text-emerald-400">BIZ</span>
                </span>
                <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden md:block">
                {language === 'ml' ? 'ഓട്ടോമേറ്റഡ് ട്രേഡിംഗ് പ്ലാറ്റ്ഫോം' : 'Live Algorithmic Execution Terminal'}
              </p>
            </div>
          </div>

          {/* Mode Switcher - Compact mobile pill with min 44px touch target */}
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
              className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 border transition active:scale-95 touch-manipulation select-none ${
                mode === 'UPSTOX_LIVE'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                  : 'bg-blue-500/20 border-blue-500/40 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.25)]'
              }`}
              title={mode === 'UPSTOX_LIVE' ? 'Switch to Paper Mode' : 'Switch to Upstox Live Mode'}
            >
              {mode === 'UPSTOX_LIVE' ? <Zap className="w-3.5 h-3.5 text-emerald-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />}
              <span>{mode === 'UPSTOX_LIVE' ? 'LIVE' : 'PAPER'}</span>
            </button>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden md:block" />

          {/* Market Status Pill */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs">
            <span className="relative flex h-2 w-2">
              {isWsConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isWsConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </span>
            <span className={`font-mono text-[11px] ${isWsConnected ? 'text-emerald-400' : 'text-emerald-400'}`}>
              {apiConfig.isConnected ? 'UPSTOX: LIVE' : (isWsConnected ? 'NSE/BSE: LIVE' : 'FEED: CONNECTING')}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 text-[11px] flex items-center gap-1">
              <Activity className="w-3 h-3 text-cyan-400" /> 18ms
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

          {/* Quick PnL Badge */}
          <div className="hidden md:flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-xs font-bold min-h-[44px] ${
                dailyProfit >= 0 
                 ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400' 
                 : 'bg-rose-950/40 border-rose-800/50 text-rose-400'
            }`}>
              <span className="text-slate-400 text-[10px] uppercase font-sans font-extrabold" title="Today's Realized Profit">
                {language === 'ml' ? 'ഇന്ന്:' : 'Day:'}
              </span>
              <span>{dailyProfit >= 0 ? `+₹${dailyProfit.toFixed(2)}` : `-₹${Math.abs(dailyProfit).toFixed(2)}`}</span>
            </div>

            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono text-xs font-bold min-h-[44px] ${
                (cumulativeProfit ?? dailyProfit) >= 0 
                 ? 'bg-indigo-950/40 border-indigo-700/60 text-cyan-300' 
                 : 'bg-rose-950/40 border-rose-700/60 text-rose-400'
            }`} title={language === 'ml' ? 'ആകെ മൊത്തം ട്രേഡിംഗ് ലാഭം/നഷ്ടം (Total Cumulative P&L)' : 'Total Cumulative All-Time P&L'}>
              <span className="text-indigo-300 text-[10px] uppercase font-sans font-extrabold" title="Total All-Time Cumulative P&L">
                {language === 'ml' ? 'ആകെ:' : 'Total:'}
              </span>
              <span>{(cumulativeProfit ?? dailyProfit) >= 0 ? `+₹${(cumulativeProfit ?? dailyProfit).toFixed(2)}` : `-₹${Math.abs(cumulativeProfit ?? dailyProfit).toFixed(2)}`}</span>
            </div>

            {/* Account Money Balance Badge (Paper Virtual Cash or Real Upstox Margin) */}
            <div 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-xs font-bold min-h-[44px] transition-all shadow-sm ${
                mode === 'UPSTOX_LIVE'
                  ? (apiConfig.isConnected 
                      ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.25)]' 
                      : 'bg-amber-950/50 border-amber-500/60 text-amber-300')
                  : 'bg-cyan-950/50 border-cyan-500/60 text-cyan-300 shadow-[0_0_14px_rgba(6,182,212,0.25)]'
              }`}
              title={mode === 'UPSTOX_LIVE' ? 'Upstox Real Available Margin / Account Cash' : 'Paper Trading Virtual Account Balance'}
            >
              {mode === 'UPSTOX_LIVE' ? (
                <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              )}
              <span className="text-[10px] uppercase font-sans font-black text-slate-300 tracking-wide">
                {mode === 'UPSTOX_LIVE' 
                  ? (language === 'ml' ? 'ലൈവ് ബാലൻസ്:' : 'Live Cash:')
                  : (language === 'ml' ? 'പേപ്പർ ബാലൻസ്:' : 'Paper Bal:')}
              </span>
              <span className="font-mono text-xs font-black">
                ₹{mode === 'UPSTOX_LIVE' 
                  ? (apiConfig.isConnected 
                      ? Number(apiConfig.availableMargin || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) 
                      : '0 (കണക്റ്റ്)')
                  : Math.round(virtualCapital ?? 2000).toLocaleString('en-IN')}
              </span>
            </div>

            {activePositionsCount > 0 && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-xs font-bold min-h-[44px] ${
                totalPnL >= 0 
                   ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400' 
                   : 'bg-rose-950/40 border-rose-800/50 text-rose-400'
              }`}>
                <span className="text-slate-400 text-[10px] uppercase font-sans" title="Mark-to-Market (Open Positions)">MTM:</span>
                <span>{totalPnL >= 0 ? `+₹${totalPnL.toFixed(2)}` : `-₹${Math.abs(totalPnL).toFixed(2)}`}</span>
                <button
                  onClick={onSquareOffAll}
                  title="Panic Exit All Positions"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1 hover:bg-rose-500/20 text-rose-400 rounded transition touch-manipulation"
                >
                  <AlertOctagon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          
          {/* Upstox Daily Token Status & Setup Button */}
          <button
            id="btn-api-settings"
            onClick={onOpenApiSettings}
            className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 touch-manipulation ${
              apiConfig.isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 animate-pulse'
            }`}
            title={apiConfig.isConnected ? 'Upstox Daily Token Active' : 'Enter Today\'s Upstox Token'}
          >
            {apiConfig.isConnected ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <Key className="w-4 h-4 text-amber-400" />
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
            className="w-11 h-11 min-w-[44px] min-h-[44px] shrink-0 flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 active:scale-95 transition touch-manipulation"
            title={language === 'ml' ? 'അലർട്ടുകൾ' : 'Price Alerts'}
          >
            <BellRing className="w-4 h-4" />
          </button>
          
          {/* Sound Toggle */}
          <button
            id="btn-sound-toggle"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`w-11 h-11 min-w-[44px] min-h-[44px] shrink-0 flex items-center justify-center rounded-xl border transition active:scale-95 touch-manipulation ${
              soundEnabled
                ? 'bg-slate-900 border-slate-700 text-emerald-400 hover:bg-slate-800'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800'
            }`}
            title={soundEnabled ? t.soundOn : t.soundOff}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Android Mobile App / Desktop PWA install button */}
          <button
            id="btn-android-modal"
            onClick={onOpenAndroidModal}
            className="flex w-10 sm:w-11 h-10 sm:h-11 min-w-[40px] min-h-[40px] shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 active:scale-95 transition touch-manipulation"
            title={language === 'ml' ? 'ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുക' : 'Install App'}
          >
            <Smartphone className="w-4 h-4" />
          </button>

          {/* Language Toggle */}
          <button
            id="btn-language-toggle"
            onClick={() => setLanguage(language === 'en' ? 'ml' : 'en')}
            className="min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1 active:scale-95 transition shrink-0 touch-manipulation"
            title="Switch Language / ഭാഷ മാറ്റുക"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>{language === 'en' ? 'മല' : 'EN'}</span>
          </button>
        </div>

      </div>

      {/* Mobile Sub-Header: Dedicated Row for Day P&L, Total P&L & Account Balance (Zero Overlap with Key Icon) */}
      <div className="sm:hidden w-full mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-1.5 text-[11px] font-mono overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Day Realized P&L */}
          <div 
            className={`px-2 py-1 rounded-lg border font-bold flex items-center gap-1 shadow-sm shrink-0 transition-all ${
              dailyProfit >= 0 
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.25)]' 
                : 'bg-rose-950/70 border-rose-500/50 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.25)]'
            }`} 
            title={language === 'ml' ? 'ഇന്നത്തെ ലാഭം / നഷ്ടം (Daily P&L)' : "Today's P&L"}
          >
            <span className="text-[9px] uppercase font-sans font-black text-slate-400 tracking-wider">
              {language === 'ml' ? 'ഇന്ന്:' : 'Day:'}
            </span>
            <span className="font-mono text-xs font-black">
              {dailyProfit >= 0 ? `+₹${Math.round(dailyProfit)}` : `-₹${Math.round(Math.abs(dailyProfit))}`}
            </span>
          </div>

          {/* Total Cumulative P&L */}
          <div 
            className={`px-2 py-1 rounded-lg border font-bold flex items-center gap-1 shadow-sm shrink-0 transition-all ${
              (cumulativeProfit ?? dailyProfit) >= 0 
                ? 'bg-indigo-950/70 border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]' 
                : 'bg-rose-950/70 border-rose-500/50 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.25)]'
            }`} 
            title={language === 'ml' ? 'ആകെ മൊത്തം ലാഭം / നഷ്ടം (Total Cumulative P&L)' : "Total Cumulative P&L"}
          >
            <span className="text-[9px] uppercase font-sans font-black text-cyan-400 tracking-wider">
              {language === 'ml' ? 'ആകെ:' : 'Total:'}
            </span>
            <span className="font-mono text-xs font-black">
              {(cumulativeProfit ?? dailyProfit) >= 0 ? `+₹${Math.round(cumulativeProfit ?? dailyProfit)}` : `-₹${Math.round(Math.abs(cumulativeProfit ?? dailyProfit))}`}
            </span>
          </div>

          {/* Account Money Balance Pill on Mobile (Paper Cash or Live Upstox Margin) */}
          <div 
            className={`px-2 py-1 rounded-lg border font-bold flex items-center gap-1 shadow-sm shrink-0 transition-all ${
              mode === 'UPSTOX_LIVE'
                ? (apiConfig.isConnected 
                    ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]' 
                    : 'bg-amber-950/70 border-amber-500/50 text-amber-300')
                : 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
            }`}
            title={mode === 'UPSTOX_LIVE' ? 'Upstox Real Available Margin / Balance' : 'Paper Trading Virtual Account Balance'}
          >
            <span className="text-[8px] uppercase font-sans font-black text-slate-400">
              {mode === 'UPSTOX_LIVE' 
                ? (language === 'ml' ? 'ലൈവ്:' : 'Live:') 
                : (language === 'ml' ? 'പേപ്പർ:' : 'Paper:')}
            </span>
            <span className="font-mono text-xs font-black">
              ₹{mode === 'UPSTOX_LIVE' 
                ? (apiConfig.isConnected ? Math.round(apiConfig.availableMargin || 0).toLocaleString('en-IN') : '0')
                : Math.round(virtualCapital ?? 2000).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Live Status indicator on Mobile Sub-Header */}
        <div className="flex items-center gap-1 text-[10px] font-sans">
          {activePositionsCount > 0 ? (
            <div className={`px-2 py-0.5 rounded-lg border font-bold flex items-center gap-1 font-mono ${
              totalPnL >= 0 ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400' : 'bg-rose-950/60 border-rose-500/40 text-rose-400'
            }`}>
              <span className="text-[8px] uppercase text-slate-400 font-sans">MTM:</span>
              <span>{totalPnL >= 0 ? `+₹${Math.round(totalPnL)}` : `-₹${Math.round(Math.abs(totalPnL))}`}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 font-semibold">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">{apiConfig.isConnected ? 'UPSTOX' : 'NSE/BSE'}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
