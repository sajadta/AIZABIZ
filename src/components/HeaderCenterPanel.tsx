import React from 'react';
import { ShieldCheck, Zap, Cpu, RefreshCw, AlertOctagon } from 'lucide-react';
import type { ExecutionMode, Language, UpstoxApiConfig } from '../types';
import type { translations } from '../translations';

interface HeaderCenterPanelProps {
  mode: ExecutionMode;
  setMode: (mode: ExecutionMode) => void;
  language: Language;
  apiConfig: UpstoxApiConfig;
  onOpenApiSettings: () => void;
  dailyProfit: number;
  cumulativeProfit?: number;
  totalPnL: number;
  virtualCapital: number;
  botEnabled: boolean;
  onToggleBot?: () => void;
  activePositionsCount: number;
  onResetPaperAccount?: () => void;
  onSquareOffAll: () => void;
  t: (typeof translations)['en'];
}

/** Desktop centre cluster: paper/live switch, PnL ribbon, reset, square-off and bot toggle. */
export const HeaderCenterPanel: React.FC<HeaderCenterPanelProps> = ({
  mode,
  setMode,
  language,
  apiConfig,
  onOpenApiSettings,
  dailyProfit,
  cumulativeProfit,
  totalPnL,
  virtualCapital,
  botEnabled,
  onToggleBot,
  activePositionsCount,
  onResetPaperAccount,
  onSquareOffAll,
  t,
}) => (
  // Center: mode switcher, metrics ribbon and action buttons
  <div className="hidden sm:flex items-center gap-2 sm:gap-3 shrink-0">
    {/* Mode Switcher Desktop */}
    <div className="bg-slate-900/90 p-0.5 rounded-xl border border-slate-800 flex items-center shrink-0 whitespace-nowrap">
      <button
        id="btn-mode-paper"
        onClick={() => setMode('PAPER_TRADING')}
        className={`min-h-[40px] px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 touch-manipulation whitespace-nowrap shrink-0 ${
          mode === 'PAPER_TRADING'
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>{language === 'ml' ? 'പേപ്പർ (₹10,000)' : 'Paper (₹10,000)'}</span>
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
        className={`min-h-[40px] px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 touch-manipulation whitespace-nowrap shrink-0 ${
          mode === 'UPSTOX_LIVE'
            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Zap className="w-3.5 h-3.5 shrink-0" />
        <span>{language === 'ml' ? 'അപ്സ്റ്റോക്സ് ലൈവ്' : 'Upstox Live'}</span>
        {!apiConfig.isConnected && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
      </button>
    </div>

    {/* Sleek Unified Metrics Ribbon (Zero Box Clutter) */}
    <div className="hidden md:flex items-center divide-x divide-slate-800/70 bg-slate-900/40 backdrop-blur-sm rounded-xl px-2 py-1 text-xs shadow-inner shrink-0 whitespace-nowrap">
      {/* Day P&L */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 font-mono whitespace-nowrap">
        <span className="text-[10px] uppercase font-sans font-semibold text-slate-400 tracking-wider">
          {language === 'ml' ? 'ഇന്ന്:' : 'Day:'}
        </span>
        <span
          className={`font-bold whitespace-nowrap ${dailyProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
        >
          {dailyProfit >= 0
            ? `+₹${dailyProfit.toFixed(2)}`
            : `-₹${Math.abs(dailyProfit).toFixed(2)}`}
        </span>
      </div>

      {/* Total Cumulative P&L */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 font-mono whitespace-nowrap"
        title={
          language === 'ml' ? 'ആകെ മൊത്തം ട്രേഡിംഗ് ലാഭം/നഷ്ടം' : 'Total All-Time Cumulative P&L'
        }
      >
        <span className="text-[10px] uppercase font-sans font-semibold text-slate-400 tracking-wider">
          {language === 'ml' ? 'ആകെ:' : 'Net:'}
        </span>
        <span
          className={`font-bold whitespace-nowrap ${(cumulativeProfit ?? dailyProfit) >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}
        >
          {(cumulativeProfit ?? dailyProfit) >= 0
            ? `+₹${(cumulativeProfit ?? dailyProfit).toFixed(2)}`
            : `-₹${Math.abs(cumulativeProfit ?? dailyProfit).toFixed(2)}`}
        </span>
      </div>

      {/* Account Balance (Live Margin or Paper) */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 font-mono whitespace-nowrap"
        title={
          mode === 'UPSTOX_LIVE'
            ? `Upstox Free Margin: ₹${Number(apiConfig.availableMargin || 0).toFixed(2)} | Used: ₹${Number(apiConfig.usedMargin || 0).toFixed(2)} | Total: ₹${Number(apiConfig.totalBalance ?? apiConfig.availableMargin ?? 0).toFixed(2)}`
            : 'Paper Trading Virtual Account Balance'
        }
      >
        <span className="text-[10px] uppercase font-sans font-semibold text-slate-400 tracking-wider flex items-center gap-1">
          {mode === 'UPSTOX_LIVE' ? (
            <Zap className="w-3 h-3 text-emerald-400" />
          ) : (
            <ShieldCheck className="w-3 h-3 text-cyan-400" />
          )}
          {mode === 'UPSTOX_LIVE'
            ? language === 'ml'
              ? 'ലൈവ്:'
              : 'Live:'
            : language === 'ml'
              ? 'പേപ്പർ:'
              : 'Paper:'}
        </span>
        <span className="font-bold text-slate-100 font-mono whitespace-nowrap">
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
            onClick={() => {
              if (onResetPaperAccount) onResetPaperAccount();
            }}
            aria-label={t.resetPaper}
            title={t.resetPaper}
            className="ml-1 p-1 hover:bg-rose-500/20 text-rose-400 rounded transition"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* MTM for Active Positions */}
      {activePositionsCount > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 font-mono whitespace-nowrap">
          <span className="text-[10px] uppercase font-sans font-semibold text-slate-400">MTM:</span>
          <span
            className={`font-bold whitespace-nowrap ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
          >
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
      <div className="flex items-center gap-1.5 px-2.5 py-1 whitespace-nowrap">
        <button
          onClick={onToggleBot}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all text-[10px] font-black uppercase whitespace-nowrap ${
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
);
