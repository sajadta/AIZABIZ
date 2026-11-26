import React, { useState, useEffect } from 'react';
import { Zap, Clock, ShieldCheck } from 'lucide-react';
import { ExecutionMode, Language, UpstoxApiConfig } from '../types';
import { translations } from '../translations';
import { HeaderMobileStats } from './HeaderMobileStats';
import { HeaderCenterPanel } from './HeaderCenterPanel';
import { HeaderQuickActions } from './HeaderQuickActions';

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
  virtualCapital = 10000,
  onResetPaperAccount,
  botEnabled = false,
  onToggleBot,
}) => {
  const t = translations[language];

  const [istTime, setIstTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setIstTime(
        new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getMarketSession = () => {
    const now = new Date();
    const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const day = istDate.getDay();
    const totalMins = istDate.getHours() * 60 + istDate.getMinutes();
    const isWeekday = day >= 1 && day <= 5;
    const isMarketOpen = isWeekday && totalMins >= 9 * 60 + 15 && totalMins <= 15 * 60 + 30;
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
                  style={{
                    width: '100%',
                    height: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
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
                {language === 'ml'
                  ? 'ഓട്ടോമേറ്റഡ് ട്രേഡിംഗ് പ്ലാറ്റ്ഫോം'
                  : 'Live Algorithmic Execution Terminal'}
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
              {mode === 'UPSTOX_LIVE' ? (
                <Zap className="w-3 h-3 text-emerald-400" />
              ) : (
                <ShieldCheck className="w-3 h-3 text-blue-400" />
              )}
              <span>{mode === 'UPSTOX_LIVE' ? 'LIVE' : 'PAPER'}</span>
            </button>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden 2xl:block shrink-0" />

          {/* Market Status & Live IST Time Pill (Desktop status bar below header shows this on lg/xl) */}
          <div className="hidden 2xl:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs shadow-inner shrink-0 whitespace-nowrap">
            <span className="relative flex h-2 w-2">
              {marketSession.isMarketOpen && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${marketSession.isMarketOpen ? 'bg-emerald-500' : 'bg-amber-500'}`}
              ></span>
            </span>
            <span
              className={`font-mono font-bold text-[11px] ${marketSession.isMarketOpen ? 'text-emerald-400' : 'text-amber-400'}`}
            >
              {marketSession.isMarketOpen
                ? language === 'ml'
                  ? 'മാർക്കറ്റ് ലൈവ്'
                  : 'MARKET OPEN'
                : language === 'ml'
                  ? 'മാർക്കറ്റ് ക്ലോസ്ഡ്'
                  : 'MARKET CLOSED'}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300 font-mono text-[11px] flex items-center gap-1 font-bold">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>{istTime} IST</span>
            </span>
            <span className="text-slate-600">|</span>
            <span
              className={`font-mono text-[10px] ${apiConfig.isConnected ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}
            >
              {apiConfig.isConnected ? 'UPSTOX: LIVE' : 'PAPER (09:15-15:30)'}
            </span>
          </div>
        </div>

        <HeaderCenterPanel
          mode={mode}
          setMode={setMode}
          language={language}
          apiConfig={apiConfig}
          onOpenApiSettings={onOpenApiSettings}
          dailyProfit={dailyProfit}
          cumulativeProfit={cumulativeProfit}
          totalPnL={totalPnL}
          virtualCapital={virtualCapital}
          botEnabled={botEnabled}
          onToggleBot={onToggleBot}
          activePositionsCount={activePositionsCount}
          onResetPaperAccount={onResetPaperAccount}
          onSquareOffAll={onSquareOffAll}
          t={t}
        />

        <HeaderQuickActions
          apiConfig={apiConfig}
          language={language}
          setLanguage={setLanguage}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          onOpenApiSettings={onOpenApiSettings}
          onOpenAlerts={onOpenAlerts}
          onOpenAndroidModal={onOpenAndroidModal}
          t={t}
        />
      </div>

      <HeaderMobileStats
        language={language}
        mode={mode}
        apiConfig={apiConfig}
        virtualCapital={virtualCapital}
        dailyProfit={dailyProfit}
        cumulativeProfit={cumulativeProfit}
        totalPnL={totalPnL}
        activePositionsCount={activePositionsCount}
        istTime={istTime}
        marketSession={marketSession}
        onResetPaperAccount={onResetPaperAccount}
        onSquareOffAll={onSquareOffAll}
      />
    </header>
  );
};
