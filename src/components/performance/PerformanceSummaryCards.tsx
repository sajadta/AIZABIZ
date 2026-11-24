import React from 'react';
import type { Language } from '../../types';
import type { PerformanceMetrics } from './metrics';

interface PerformanceSummaryCardsProps {
  language: Language;
  timeView: 'COMPARE' | 'TODAY' | 'ALL_TIME';
  activeMetrics: PerformanceMetrics;
}

export const PerformanceSummaryCards: React.FC<PerformanceSummaryCardsProps> = ({
  language,
  timeView,
  activeMetrics,
}) => (
  <>
    {/* 4-Card Summary Bar for Selected View */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50 flex flex-col justify-between shadow-sm">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300/90">
          {timeView === 'TODAY'
            ? language === 'ml'
              ? 'ഇന്നത്തെ ലാഭം (Gross)'
              : "Today's Gross Profit"
            : language === 'ml'
              ? 'ആകെ ലാഭം (Total Gross)'
              : 'Total Gross Profit'}
        </span>
        <span className="text-lg sm:text-xl font-black font-mono text-emerald-400 mt-1">
          +₹{activeMetrics.grossProfit.toFixed(2)}
        </span>
        <span className="text-[10px] text-slate-400 font-mono mt-0.5">
          {activeMetrics.winningTrades} {language === 'ml' ? 'ലാഭ ട്രേഡുകൾ' : 'Winning Trades'} (
          {activeMetrics.winRatePercent}%)
        </span>
      </div>

      <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/50 flex flex-col justify-between shadow-sm">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-300/90">
          {timeView === 'TODAY'
            ? language === 'ml'
              ? 'ഇന്നത്തെ നഷ്ടം (Gross)'
              : "Today's Gross Loss"
            : language === 'ml'
              ? 'ആകെ നഷ്ടം (Total Gross)'
              : 'Total Gross Loss'}
        </span>
        <span className="text-lg sm:text-xl font-black font-mono text-rose-400 mt-1">
          -₹{activeMetrics.grossLoss.toFixed(2)}
        </span>
        <span className="text-[10px] text-slate-400 font-mono mt-0.5">
          {activeMetrics.losingTrades} {language === 'ml' ? 'നഷ്ട ട്രേഡുകൾ' : 'Losing Trades'}
        </span>
      </div>

      <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/50 flex flex-col justify-between shadow-sm">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300/90">
          {language === 'ml' ? 'ബ്രോക്കറേജ് & ടാക്സ്' : 'Brokerage & Taxes'}
        </span>
        <span className="text-lg sm:text-xl font-black font-mono text-amber-400 mt-1">
          ₹{activeMetrics.totalBrokerageCharges.toFixed(2)}
        </span>
        <span className="text-[10px] text-slate-400 font-mono mt-0.5">
          {language === 'ml' ? 'Upstox ഫീസ് + GST + STT' : 'Round-trip charges'}
        </span>
      </div>

      <div
        className={`p-3.5 rounded-xl border flex flex-col justify-between shadow-md transition-all ${
          activeMetrics.totalNetRealizedPnL >= 0
            ? 'bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
            : 'bg-rose-950/40 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.25)]'
        }`}
      >
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-300">
          {language === 'ml' ? 'അറ്റ ലാഭം (Net P&L)' : 'Net P&L (After Charges)'}
        </span>
        <span
          className={`text-lg sm:text-xl font-black font-mono mt-1 ${
            activeMetrics.totalNetRealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {activeMetrics.totalNetRealizedPnL >= 0 ? '+' : '-'}₹
          {Math.abs(activeMetrics.totalNetRealizedPnL).toFixed(2)}
        </span>
        <span className="text-[10px] text-slate-400 font-mono mt-0.5">
          {language === 'ml' ? 'എല്ലാ ചാർജുകളും കിഴിച്ച ശേഷം' : 'Realized net payoff'}
        </span>
      </div>
    </div>
  </>
);
