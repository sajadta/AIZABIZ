import React from 'react';
import type { Language } from '../../types';
import type { PerformanceMetrics } from './metrics';

interface PerformanceInsightsBarProps {
  language: Language;
  activeMetrics: PerformanceMetrics;
}

export const PerformanceInsightsBar: React.FC<PerformanceInsightsBarProps> = ({
  language,
  activeMetrics,
}) => (
  <>
    {/* Auxiliary Performance Insights Bar */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
      <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 flex flex-col justify-between">
        <span className="text-[10px] uppercase font-bold text-slate-400">
          {language === 'ml' ? 'ശരാശരി ലാഭം' : 'Average Win'}
        </span>
        <span className="font-mono font-extrabold text-emerald-400 text-sm mt-0.5">
          +₹{activeMetrics.avgWin.toFixed(2)}
        </span>
      </div>

      <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 flex flex-col justify-between">
        <span className="text-[10px] uppercase font-bold text-slate-400">
          {language === 'ml' ? 'ശരാശരി നഷ്ടം' : 'Average Loss'}
        </span>
        <span className="font-mono font-extrabold text-rose-400 text-sm mt-0.5">
          -₹{activeMetrics.avgLoss.toFixed(2)}
        </span>
      </div>

      <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 flex flex-col justify-between">
        <span className="text-[10px] uppercase font-bold text-slate-400">
          {language === 'ml' ? 'പേഓഫ് നിരക്ക്' : 'Payoff Ratio (Avg W/L)'}
        </span>
        <span className="font-mono font-extrabold text-indigo-400 text-sm mt-0.5">
          {activeMetrics.avgLoss > 0
            ? `${(activeMetrics.avgWin / activeMetrics.avgLoss).toFixed(2)} : 1`
            : activeMetrics.avgWin > 0
              ? 'Pure Profit'
              : '1.00 : 1'}
        </span>
      </div>

      <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 flex flex-col justify-between">
        <span className="text-[10px] uppercase font-bold text-slate-400">
          {language === 'ml' ? 'പ്രോഫിറ്റ് ഫാക്ടർ' : 'Profit Factor'}
        </span>
        <span className="font-mono font-extrabold text-cyan-300 text-sm mt-0.5">
          {activeMetrics.profitFactor > 0 ? activeMetrics.profitFactor.toFixed(2) : '1.00'}
        </span>
      </div>
    </div>
  </>
);
