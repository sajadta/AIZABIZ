// Side-by-side Today vs All-Time performance comparison.
import type { FC } from 'react';
import { Calendar, Globe } from 'lucide-react';
import type { Language, Position } from '../../types';
import type { computeMetrics } from './metrics';

type PerformanceMetrics = ReturnType<typeof computeMetrics>;

interface CompareViewProps {
  language: Language;
  todayIst: string;
  todayTrades: Position[];
  todayMetrics: PerformanceMetrics;
  allTimeMetrics: PerformanceMetrics;
}

export const CompareView: FC<CompareViewProps> = ({
  language,
  todayIst,
  todayTrades,
  todayMetrics,
  allTimeMetrics,
}) => {
  const isTodayPositive = todayMetrics.totalNetRealizedPnL >= 0;
  const isAllTimePositive = allTimeMetrics.totalNetRealizedPnL >= 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* SECTION 1: TODAY'S TRADING SUMMARY */}
      <div className="p-4 rounded-xl border border-emerald-900/50 bg-gradient-to-br from-emerald-950/20 via-slate-900 to-slate-950 space-y-3 shadow-lg">
        <div className="flex items-center justify-between pb-2 border-b border-emerald-900/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-emerald-300 tracking-tight uppercase">
                {language === 'ml'
                  ? '📅 ഇന്നത്തെ ട്രേഡിംഗ് സംഗ്രഹം (Today)'
                  : "📅 Today's Trading Performance"}
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">
                {todayIst} • {todayTrades.length} {language === 'ml' ? 'ട്രേഡുകൾ' : 'Trades'}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              {language === 'ml' ? 'ഇന്നത്തെ അറ്റ ലാഭം' : 'Today Net P&L'}
            </span>
            <span
              className={`text-base sm:text-lg font-black font-mono ${isTodayPositive ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {isTodayPositive ? '+' : ''}₹{todayMetrics.totalNetRealizedPnL.toFixed(2)}
            </span>
          </div>
        </div>

        {/* 4 Mini Cards for Today */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
            <span className="text-[9px] font-extrabold uppercase text-emerald-400 block">
              {language === 'ml' ? 'ഇന്നത്തെ ലാഭം (Gross)' : 'Today Gross Win'}
            </span>
            <span className="text-sm font-black font-mono text-emerald-300 mt-0.5 block">
              +₹{todayMetrics.grossProfit.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {todayMetrics.winningTrades} {language === 'ml' ? 'വിജയം' : 'Wins'} (
              {todayMetrics.winRatePercent}%)
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
            <span className="text-[9px] font-extrabold uppercase text-rose-400 block">
              {language === 'ml' ? 'ഇന്നത്തെ നഷ്ടം (Gross)' : 'Today Gross Loss'}
            </span>
            <span className="text-sm font-black font-mono text-rose-400 mt-0.5 block">
              -₹{todayMetrics.grossLoss.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {todayMetrics.losingTrades} {language === 'ml' ? 'നഷ്ടം' : 'Losses'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
            <span className="text-[9px] font-extrabold uppercase text-amber-300 block">
              {language === 'ml' ? 'ഇന്നത്തെ ബ്രോക്കറേജ്' : 'Today Brokerage & Taxes'}
            </span>
            <span className="text-sm font-black font-mono text-amber-300 mt-0.5 block">
              ₹{todayMetrics.totalBrokerageCharges.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {language === 'ml' ? 'നികുതികൾ ഉൾപ്പെടെ' : 'All Govt & Broker fees'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
            <span className="text-[9px] font-extrabold uppercase text-cyan-300 block">
              {language === 'ml' ? 'വിജയ നിരക്ക് (Win Rate)' : 'Today Win Rate'}
            </span>
            <span className="text-sm font-black font-mono text-cyan-300 mt-0.5 block">
              {todayMetrics.winRatePercent}%
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {todayMetrics.winningTrades}W / {todayMetrics.losingTrades}L
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: TOTAL ALL-TIME CUMULATIVE SUMMARY */}
      <div className="p-4 rounded-xl border border-indigo-900/50 bg-gradient-to-br from-indigo-950/20 via-slate-900 to-slate-950 space-y-3 shadow-lg">
        <div className="flex items-center justify-between pb-2 border-b border-indigo-900/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-indigo-300 tracking-tight uppercase">
                {language === 'ml'
                  ? '🌐 ആകെ ട്രേഡിംഗ് ഹിസ്റ്ററി (All-Time)'
                  : '🌐 Total Cumulative Performance'}
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">
                {language === 'ml' ? 'എല്ലാ ദിവസങ്ങളിലെയും ആകെ' : 'All Trading Days'} •{' '}
                {allTimeMetrics.totalTrades} {language === 'ml' ? 'ട്രേഡുകൾ' : 'Trades'}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              {language === 'ml' ? 'ആകെ അറ്റ ലാഭം' : 'Total Net P&L'}
            </span>
            <span
              className={`text-base sm:text-lg font-black font-mono ${isAllTimePositive ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {isAllTimePositive ? '+' : ''}₹{allTimeMetrics.totalNetRealizedPnL.toFixed(2)}
            </span>
          </div>
        </div>

        {/* 4 Mini Cards for All-Time */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
            <span className="text-[9px] font-extrabold uppercase text-emerald-400 block">
              {language === 'ml' ? 'ആകെ ലാഭം (Total Gross)' : 'Total Gross Win'}
            </span>
            <span className="text-sm font-black font-mono text-emerald-300 mt-0.5 block">
              +₹{allTimeMetrics.grossProfit.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {allTimeMetrics.winningTrades} {language === 'ml' ? 'വിജയം' : 'Wins'} (
              {allTimeMetrics.winRatePercent}%)
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
            <span className="text-[9px] font-extrabold uppercase text-rose-400 block">
              {language === 'ml' ? 'ആകെ നഷ്ടം (Total Gross)' : 'Total Gross Loss'}
            </span>
            <span className="text-sm font-black font-mono text-rose-400 mt-0.5 block">
              -₹{allTimeMetrics.grossLoss.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {allTimeMetrics.losingTrades} {language === 'ml' ? 'നഷ്ടം' : 'Losses'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
            <span className="text-[9px] font-extrabold uppercase text-amber-300 block">
              {language === 'ml' ? 'ആകെ ബ്രോക്കറേജ് & ടാക്സ്' : 'Total Brokerage & Taxes'}
            </span>
            <span className="text-sm font-black font-mono text-amber-300 mt-0.5 block">
              ₹{allTimeMetrics.totalBrokerageCharges.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {language === 'ml' ? 'മൊത്തം കിഴിവുകൾ' : 'Cumulative Charges'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
            <span className="text-[9px] font-extrabold uppercase text-cyan-300 block">
              {language === 'ml' ? 'ആകെ വിജയ നിരക്ക്' : 'All-Time Win Rate'}
            </span>
            <span className="text-sm font-black font-mono text-cyan-300 mt-0.5 block">
              {allTimeMetrics.winRatePercent}%
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {allTimeMetrics.winningTrades}W / {allTimeMetrics.losingTrades}L
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
