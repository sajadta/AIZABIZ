import React from 'react';
import { TrendingUp, Sliders, Layers } from 'lucide-react';

const CHART_INTERVALS = ['1m', '3m', '5m', '15m', '1h', '1D'];

interface ChartToolbarProps {
  symbol: string;
  currentLtp: number;
  currentChange: number;
  currentChangePts: number;
  isPositive: boolean;
  interval: string;
  onChangeInterval: (interval: string) => void;
  showSupertrend: boolean;
  setShowSupertrend: (v: boolean) => void;
  showEMA: boolean;
  setShowEMA: (v: boolean) => void;
  activeSubChart: 'RSI' | 'MACD' | 'NONE';
  setActiveSubChart: (v: 'RSI' | 'MACD' | 'NONE') => void;
  onOpenOrderModal: (type: 'BUY' | 'SELL', symbol: string, price: number) => void;
}

/** Symbol header, timeframe switcher, indicator toggles and quick order buttons. */
export const ChartToolbar: React.FC<ChartToolbarProps> = ({
  symbol,
  currentLtp,
  currentChange,
  currentChangePts,
  isPositive,
  interval,
  onChangeInterval,
  showSupertrend,
  setShowSupertrend,
  showEMA,
  setShowEMA,
  activeSubChart,
  setActiveSubChart,
  onOpenOrderModal,
}) => (
  // Header Controls
  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 border-b border-slate-800/90 bg-[#080c16] gap-1.5 sm:gap-3 shrink-0 w-full max-w-full min-w-0 overflow-hidden">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm sm:text-base font-black text-white tracking-tight">{symbol}</h2>
        <div className="flex items-center gap-1.5 font-mono-num">
          <span
            className={`text-sm sm:text-base font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {currentLtp > 0
              ? `₹${currentLtp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : 'Live...'}
          </span>
          {currentLtp > 0 && (
            <span
              className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-bold border ${isPositive ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30'}`}
            >
              {isPositive ? '+' : ''}
              {currentChangePts.toFixed(2)} ({isPositive ? '+' : ''}
              {currentChange.toFixed(2)}%)
            </span>
          )}
        </div>
      </div>

      {/* Quick Buy/Sell for mobile right top */}
      <div className="flex sm:hidden items-center gap-1.5">
        <button
          onClick={() => onOpenOrderModal('BUY', symbol, currentLtp)}
          className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-2.5 py-1 rounded-lg text-xs font-extrabold transition shadow-sm shadow-emerald-950"
        >
          BUY
        </button>
        <button
          onClick={() => onOpenOrderModal('SELL', symbol, currentLtp)}
          className="bg-rose-600 hover:bg-rose-500 active:scale-95 text-white px-2.5 py-1 rounded-lg text-xs font-extrabold transition shadow-sm shadow-rose-950"
        >
          SELL
        </button>
      </div>
    </div>

    {/* Intervals & Indicators */}
    <div className="flex items-center justify-between sm:justify-end gap-2 overflow-x-auto no-scrollbar py-0.5">
      <div className="flex bg-slate-900/90 rounded-xl p-0.5 border border-slate-800 shrink-0">
        {CHART_INTERVALS.map((int) => (
          <button
            key={int}
            onClick={() => onChangeInterval(int)}
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all ${
              interval === int
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            {int}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 border-l border-slate-800 pl-2 shrink-0">
        <button
          onClick={() => setShowSupertrend(!showSupertrend)}
          className={`p-1 sm:p-1.5 rounded-lg border transition-colors ${showSupertrend ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'text-slate-500 border-transparent hover:bg-slate-800'}`}
          title="Toggle Supertrend"
        >
          <TrendingUp size={15} />
        </button>
        <button
          onClick={() => setShowEMA(!showEMA)}
          className={`p-1 sm:p-1.5 rounded-lg border transition-colors ${showEMA ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'text-slate-500 border-transparent hover:bg-slate-800'}`}
          title="Toggle EMA (9/21)"
        >
          <Layers size={15} />
        </button>
        <button
          onClick={() =>
            setActiveSubChart(
              activeSubChart === 'RSI' ? 'MACD' : activeSubChart === 'MACD' ? 'NONE' : 'RSI',
            )
          }
          className={`p-1 sm:p-1.5 rounded-lg border transition-colors ${activeSubChart !== 'NONE' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' : 'text-slate-500 border-transparent hover:bg-slate-800'}`}
          title="Toggle Sub-chart (RSI/MACD)"
        >
          <Sliders size={15} />
        </button>
      </div>

      {/* Desktop Buy/Sell */}
      <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-3 shrink-0">
        <button
          onClick={() => onOpenOrderModal('BUY', symbol, currentLtp)}
          className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-3.5 py-1 rounded-lg text-xs font-extrabold transition shadow-sm shadow-emerald-950"
        >
          BUY
        </button>
        <button
          onClick={() => onOpenOrderModal('SELL', symbol, currentLtp)}
          className="bg-rose-600 hover:bg-rose-500 active:scale-95 text-white px-3.5 py-1 rounded-lg text-xs font-extrabold transition shadow-sm shadow-rose-950"
        >
          SELL
        </button>
      </div>
    </div>
  </div>
);
