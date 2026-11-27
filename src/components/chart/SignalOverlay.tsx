import React from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import type { TradingSignal } from '../../types';

interface SignalOverlayProps {
  signal: TradingSignal;
  minimized: boolean;
  onToggleMinimize: () => void;
  onRefresh: () => void;
  aiLoading?: boolean;
}

/** Collapsible AI analysis badge floating over the chart. */
export const SignalOverlay: React.FC<SignalOverlayProps> = ({
  signal,
  minimized,
  onToggleMinimize,
  onRefresh,
  aiLoading,
}) => (
  <div
    className={`absolute top-3 left-3 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl z-10 transition-all duration-200 ${
      minimized ? 'p-2 max-w-[220px]' : 'p-3.5 max-w-xs'
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <div
        className="flex items-center gap-1.5 cursor-pointer select-none"
        onClick={() => onToggleMinimize()}
        title={minimized ? 'Expand AI Analysis' : 'Minimize AI Analysis'}
      >
        <Sparkles size={14} className="text-amber-400 shrink-0" />
        <span className="font-bold text-amber-300 text-xs">AI Analysis</span>
        <span
          className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
            (signal.action || signal.signalType) === 'BUY'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : (signal.action || signal.signalType) === 'SELL'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-slate-800 text-slate-300'
          }`}
        >
          {signal.action || signal.signalType}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onRefresh}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          title="Refresh AI Analysis"
        >
          <RefreshCw size={12} className={aiLoading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={() => onToggleMinimize()}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition text-xs font-mono font-bold"
          title={minimized ? 'Expand' : 'Minimize'}
        >
          {minimized ? '➕' : '➖'}
        </button>
      </div>
    </div>

    {!minimized && (
      <div className="mt-2 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
          <span className="text-slate-400 text-[11px]">Confidence:</span>
          <span className="font-bold text-cyan-300">
            {signal.confidence ?? signal.confidenceScore}%
          </span>
        </div>
        <p className="text-[11px] text-slate-300 line-clamp-3 leading-relaxed">
          {signal.reason || signal.rationale}
        </p>
      </div>
    )}
  </div>
);
