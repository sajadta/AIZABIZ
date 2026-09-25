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
  onOpenAlerts: () => void;
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
  isWsConnected,
  onOpenAlerts,
  }) => {
  const t = translations[language];

  return (
    <header className="bg-slate-900/95 backdrop-blur border-b border-slate-800 sticky top-0 z-40 px-2.5 sm:px-6 py-2">
      <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-1.5 sm:gap-4">
        
        {/* Brand & Market Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#0b0f19] border border-slate-600/50 p-0.5 shadow-lg shadow-purple-500/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-[#090d16] rounded-[10px] flex items-center justify-center overflow-hidden">
                <img src="/src/assets/images/aizabiz_logo_1787123141675.jpg" alt="AIZABIZ Logo" className="w-full h-full object-cover" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-sm sm:text-lg font-black tracking-tight text-slate-200 drop-shadow-sm">
                  AIZA<span className="text-emerald-400">BIZ</span>
                </span>
                <span className="px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden md:block">
                {language === 'ml' ? 'ഓട്ടോമേറ്റഡ് ട്രേഡിംഗ് പ്ലാറ്റ്ഫോം' : 'Live Algorithmic Execution Terminal'}
              </p>
            </div>
          </div>

          {/* Mode Switcher - Compact mobile pill */}
          <div className="flex sm:hidden items-center ml-1">
            <button
              onClick={() => {
                if (mode === 'PAPER_TRADING') {
                  if (!apiConfig.isConnected) onOpenApiSettings();
                  else setMode('UPSTOX_LIVE');
                } else {
                  setMode('PAPER_TRADING');
                }
              }}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border transition ${
                mode === 'UPSTOX_LIVE'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-blue-500/20 border-blue-500/40 text-blue-300'
              }`}
            >
              {mode === 'UPSTOX_LIVE' ? <Zap className="w-2.5 h-2.5 text-emerald-400" /> : <ShieldCheck className="w-2.5 h-2.5 text-blue-400" />}
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
            <span className={`font-mono text-[11px] ${isWsConnected ? 'text-emerald-400' : 'text-rose-400'}`}>{isWsConnected ? 'UPSTOX: LIVE' : 'WS: OFFLINE'}</span>
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
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                mode === 'PAPER_TRADING'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{language === 'ml' ? 'പേപ്പർ' : 'Paper'}</span>
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
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
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
            <div className={`flex items-center gap-2 px-3 py-1 rounded-xl border font-mono text-xs font-bold ${
                dailyProfit >= 0 
                 ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400' 
                 : 'bg-rose-950/40 border-rose-800/50 text-rose-400'
            }`}>
              <span className="text-slate-400 text-[10px] uppercase font-sans" title="Total Realized Profit (Day)">Day P&L:</span>
              <span>{dailyProfit >= 0 ? `+₹${dailyProfit.toFixed(2)}` : `-₹${Math.abs(dailyProfit).toFixed(2)}`}</span>
            </div>

            {activePositionsCount > 0 && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-xl border font-mono text-xs font-bold ${
                totalPnL >= 0 
                   ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400' 
                   : 'bg-rose-950/40 border-rose-800/50 text-rose-400'
              }`}>
                <span className="text-slate-400 text-[10px] uppercase font-sans" title="Mark-to-Market (Open Positions)">MTM:</span>
                <span>{totalPnL >= 0 ? `+₹${totalPnL.toFixed(2)}` : `-₹${Math.abs(totalPnL).toFixed(2)}`}</span>
                <button
                  onClick={onSquareOffAll}
                  title="Panic Exit All Positions"
                  className="ml-1 p-1 hover:bg-rose-500/20 text-rose-400 rounded transition"
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
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
            className={`p-1.5 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              apiConfig.isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 animate-pulse'
            }`}
            title={apiConfig.isConnected ? 'Upstox Daily Token Active' : 'Enter Today\'s Upstox Token'}
          >
            {apiConfig.isConnected ? (
              <ShieldCheck className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-emerald-400" />
            ) : (
              <Key className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400" />
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
            className="p-1.5 sm:p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition"
            title={language === 'ml' ? 'അലർട്ടുകൾ' : 'Price Alerts'}
          >
            <BellRing className="w-4 h-4" />
          </button>
          
          {/* Sound Toggle */}
          <button
            id="btn-sound-toggle"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-1.5 sm:p-2 rounded-xl border transition ${
              soundEnabled
                ? 'bg-slate-900 border-slate-700 text-emerald-400 hover:bg-slate-800'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800'
            }`}
            title={soundEnabled ? t.soundOn : t.soundOff}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Android Mobile App / PWA modal button */}
          <button
            id="btn-android-modal"
            onClick={onOpenAndroidModal}
            className="p-1.5 sm:p-2 rounded-xl border border-slate-800 bg-slate-900 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 transition"
            title={language === 'ml' ? 'ആൻഡ്രോയിഡ് ആപ്പ് / ഇൻസ്റ്റാൾ' : 'Android App / Install'}
          >
            <Smartphone className="w-4 h-4" />
          </button>

          {/* Language Toggle */}
          <button
            id="btn-language-toggle"
            onClick={() => setLanguage(language === 'en' ? 'ml' : 'en')}
            className="px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1 transition"
            title="Switch Language / ഭാഷ മാറ്റുക"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] sm:text-xs">{language === 'en' ? 'മല' : 'EN'}</span>
          </button>
        </div>

      </div>
    </header>
  );
};
