import React from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import type { Language, ExecutionMode } from '../types';
import { translations } from '../translations';

export interface HeaderMobileStatsProps {
  language: Language;
  mode: ExecutionMode;
  apiConfig: {
    isConnected?: boolean;
    availableMargin?: number;
    usedMargin?: number;
    totalBalance?: number;
  };
  virtualCapital: number;
  dailyProfit: number;
  cumulativeProfit?: number;
  totalPnL: number;
  activePositionsCount: number;
  istTime: string;
  marketSession: { isMarketOpen: boolean };
  onResetPaperAccount?: () => void;
  onSquareOffAll: () => void;
}

export const HeaderMobileStats: React.FC<HeaderMobileStatsProps> = ({
  language,
  mode,
  apiConfig,
  virtualCapital,
  dailyProfit,
  cumulativeProfit,
  totalPnL,
  activePositionsCount,
  istTime,
  marketSession,
  onResetPaperAccount,
  onSquareOffAll,
}) => {
  const t = translations[language];
  return (
    <>
      {/* Mobile Sub-Header: Seamless Integrated Financial Strip (Zero Box Clutter) */}
      <div className="sm:hidden w-full mt-1.5 pt-1.5 border-t border-slate-800/60 flex items-center justify-around divide-x divide-slate-800/60 text-center">
        {/* 1. Day Realized P&L */}
        <div
          className="flex-1 flex flex-col items-center justify-center px-1 min-w-0"
          title={
            language === 'ml' ? 'ഇന്നത്തെ അറ്റ ലാഭം / നഷ്ടം (Net Daily P&L)' : "Today's Net P&L"
          }
        >
          <span className="text-[8px] uppercase font-sans font-semibold text-slate-400 tracking-wider">
            {t.todayPnL}
          </span>
          <span
            className={`font-mono text-xs font-bold ${dailyProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {dailyProfit >= 0
              ? `+₹${dailyProfit.toFixed(2)}`
              : `-₹${Math.abs(dailyProfit).toFixed(2)}`}
          </span>
        </div>

        {/* 2. Total Cumulative P&L */}
        <div
          className="flex-1 flex flex-col items-center justify-center px-1 min-w-0"
          title={language === 'ml' ? 'ആകെ മൊത്തം അറ്റ ലാഭം (Total Net P&L)' : 'Total Net P&L'}
        >
          <span className="text-[8px] uppercase font-sans font-semibold text-slate-400 tracking-wider">
            {t.cumulativePnL}
          </span>
          <span
            className={`font-mono text-xs font-bold ${(cumulativeProfit ?? dailyProfit) >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}
          >
            {(cumulativeProfit ?? dailyProfit) >= 0
              ? `+₹${(cumulativeProfit ?? dailyProfit).toFixed(2)}`
              : `-₹${Math.abs(cumulativeProfit ?? dailyProfit).toFixed(2)}`}
          </span>
        </div>

        {/* 3. Account Money Balance */}
        <div
          className="flex-1 flex flex-col items-center justify-center px-1 min-w-0"
          title={
            mode === 'UPSTOX_LIVE'
              ? `Upstox Free Cash: ₹${Number(apiConfig.availableMargin || 0).toFixed(2)} | Used Margin: ₹${Number(apiConfig.usedMargin || 0).toFixed(2)} | Total: ₹${Number(apiConfig.totalBalance ?? apiConfig.availableMargin ?? 0).toFixed(2)}`
              : 'Paper Trading Virtual Account Balance'
          }
        >
          <span className="text-[8px] uppercase font-sans font-semibold text-slate-400 tracking-wider">
            {mode === 'UPSTOX_LIVE'
              ? language === 'ml'
                ? 'ലൈവ് ക്യാഷ്'
                : 'Live Cash'
              : language === 'ml'
                ? 'പേപ്പർ'
                : 'Paper Bal'}
          </span>
          <div className="flex items-center justify-center gap-1">
            <span className="font-mono text-xs font-bold text-slate-200">
              ₹
              {mode === 'UPSTOX_LIVE'
                ? apiConfig.isConnected
                  ? Number(apiConfig.availableMargin ?? 0).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '0.00'
                : Number(virtualCapital ?? 10000).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
            </span>
            {mode === 'PAPER_TRADING' && onResetPaperAccount && (
              <button
                type="button"
                onClick={onResetPaperAccount}
                aria-label={t.resetPaper}
                title={t.resetPaper}
                className="p-0.5 hover:bg-rose-500/20 text-rose-400 rounded transition"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Mobile Sub-Header Strip 2: Live IST Clock & Upstox Market Session */}
      <div className="sm:hidden w-full mt-1 px-1.5 py-0.5 rounded-lg bg-slate-950/70 border border-slate-800/60 flex items-center justify-between text-[10px] font-mono">
        <div className="flex items-center gap-1.5 text-slate-300 font-bold">
          <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
          <span>{istTime} IST</span>
          <span className="text-slate-600">|</span>
          <span
            className={`flex items-center gap-1 ${marketSession.isMarketOpen ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${marketSession.isMarketOpen ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}
            />
            <span>
              {marketSession.isMarketOpen
                ? language === 'ml'
                  ? 'മാർക്കറ്റ് ലൈവ്'
                  : 'OPEN'
                : language === 'ml'
                  ? 'ക്ലോസ്ഡ്'
                  : 'CLOSED'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1 text-[9px] font-mono">
          <span
            className={`px-1.5 py-0.2 rounded font-bold ${apiConfig.isConnected ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' : 'bg-slate-900 text-slate-400'}`}
          >
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
      )}{' '}
    </>
  );
};
