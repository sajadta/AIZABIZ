import React, { useMemo, useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp, Calendar, Globe, Zap } from 'lucide-react';
import { Position, Language } from '../types';
import { computeMetrics, getTradeSessionDate } from './performance/metrics';
import { CompareView } from './performance/CompareView';
import { PerformanceSummaryCards } from './performance/PerformanceSummaryCards';
import { LowCapitalRoiCard } from './performance/LowCapitalRoiCard';
import { PerformanceKpiCards } from './performance/PerformanceKpiCards';
import { PerformanceInsightsBar } from './performance/PerformanceInsightsBar';

interface PerformanceOverviewCardProps {
  tradeHistory: Position[];
  activePositions?: Position[];
  language: Language;
}

export const PerformanceOverviewCard: React.FC<PerformanceOverviewCardProps> = ({
  tradeHistory = [],
  activePositions = [],
  language,
}) => {
  const closedTradesOnly = useMemo(() => tradeHistory, [tradeHistory]);
  const [isExpanded, setIsExpanded] = useState<boolean>(
    closedTradesOnly.length > 0 || activePositions.length > 0,
  );
  const [timeView, setTimeView] = useState<'COMPARE' | 'TODAY' | 'ALL_TIME'>('COMPARE');

  // Compute metrics helper
  // Filter Today's trades (IST based on when the trade was opened/taken)
  const todayIst = useMemo(
    () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    [],
  );

  const todayTrades = useMemo(() => {
    return closedTradesOnly.filter((t) => getTradeSessionDate(t, todayIst) === todayIst);
  }, [closedTradesOnly, todayIst]);

  const todayMetrics = useMemo(() => computeMetrics(todayTrades), [todayTrades]);
  const allTimeMetrics = useMemo(() => computeMetrics(closedTradesOnly), [closedTradesOnly]);

  const activeMetrics = timeView === 'TODAY' ? todayMetrics : allTimeMetrics;

  const isTodayPositive = todayMetrics.totalNetRealizedPnL >= 0;
  const isAllTimePositive = allTimeMetrics.totalNetRealizedPnL >= 0;

  return (
    <div className="bg-[#0b0f19]/95 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2.5 pb-2 border-b border-slate-800/80 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-base font-black text-white tracking-tight truncate">
                {language === 'ml' ? 'ട്രേഡിംഗ് പെർഫോമൻസ് അവലോകനം' : 'Performance Overview'}
              </h3>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                  {language === 'ml' ? 'ഇന്ന്' : 'Today'}: {todayTrades.length}
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {language === 'ml' ? 'ആകെ' : 'Total'}: {tradeHistory.length}
                </span>
              </div>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate hidden sm:block">
              {language === 'ml'
                ? 'ഒരു ദിവസത്തെ ട്രേഡിംഗ് ലാഭവും ആകെ മൊത്തം ഹിസ്റ്ററിയും പ്രത്യേകം തിരിച്ച് കാണിക്കുന്നു'
                : 'Distinct daily trading profits and total cumulative performance metrics'}
            </p>
          </div>
        </div>

        {/* Both Today and All-Time P&L Badges + Expand Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Today Net P&L */}
          <div
            className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
              isTodayPositive
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400'
                : 'bg-rose-950/40 border-rose-800/60 text-rose-400'
            }`}
            title={language === 'ml' ? 'ഇന്നത്തെ അറ്റ ലാഭം / നഷ്ടം' : "Today's Net Realized P&L"}
          >
            <span className="text-[9px] uppercase font-bold text-slate-400 font-sans">
              {language === 'ml' ? 'ഇന്ന്:' : 'Day:'}
            </span>
            <span className="text-xs font-black font-mono">
              {isTodayPositive ? '+' : ''}₹{todayMetrics.totalNetRealizedPnL.toFixed(2)}
            </span>
          </div>

          {/* Total Cumulative Net P&L */}
          <div
            className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
              isAllTimePositive
                ? 'bg-indigo-950/40 border-indigo-700/60 text-cyan-300'
                : 'bg-rose-950/40 border-rose-800/60 text-rose-400'
            }`}
            title={
              language === 'ml'
                ? 'ആകെ മൊത്തം അറ്റ ലാഭം / നഷ്ടം'
                : 'Total Cumulative Net Realized P&L'
            }
          >
            <span className="text-[9px] uppercase font-bold text-indigo-300 font-sans">
              {language === 'ml' ? 'ആകെ:' : 'Total:'}
            </span>
            <span className="text-xs font-black font-mono">
              {isAllTimePositive ? '+' : ''}₹{allTimeMetrics.totalNetRealizedPnL.toFixed(2)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition flex items-center gap-1 text-xs font-bold"
            title={isExpanded ? 'ചുരുക്കുക (Collapse)' : 'വിശദാംശങ്ങൾ കാണുക (Expand)'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-cyan-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-cyan-400" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Mode Selector Tabs: Compare Side-by-Side vs Today Only vs All-Time Only */}
          <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-slate-800 text-xs font-bold shadow-inner">
              <button
                type="button"
                onClick={() => setTimeView('COMPARE')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  timeView === 'COMPARE'
                    ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>
                  {language === 'ml'
                    ? '⚡ രണ്ടും പ്രത്യേകം (സെപ്പറേറ്റ് താരതമ്യം)'
                    : '⚡ Separate Comparison'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTimeView('TODAY')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  timeView === 'TODAY'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {language === 'ml' ? '📅 ഇന്നത്തെ ട്രേഡുകൾ (Today)' : "📅 Today's Trades"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTimeView('ALL_TIME')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  timeView === 'ALL_TIME'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>
                  {language === 'ml' ? '🌐 ആകെ ഹിസ്റ്ററി (All-Time)' : '🌐 All-Time History'}
                </span>
              </button>
            </div>
          </div>

          {timeView === 'COMPARE' && (
            <CompareView
              language={language}
              todayIst={todayIst}
              todayTrades={todayTrades}
              todayMetrics={todayMetrics}
              allTimeMetrics={allTimeMetrics}
            />
          )}

          {/* SINGLE VIEW (TODAY or ALL_TIME) */}
          {timeView !== 'COMPARE' && (
            <>
              {/* Empty state banner when viewing TODAY and today trades are 0 */}
              {timeView === 'TODAY' && todayTrades.length === 0 && (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-center space-y-2">
                  <p className="text-xs sm:text-sm font-bold text-slate-300">
                    {language === 'ml'
                      ? 'ഇന്ന് പുതിയ ട്രേഡുകൾ ഒന്നും നടന്നിട്ടില്ല (0 Trades Today)'
                      : 'No new trades executed today'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {language === 'ml'
                      ? 'ഇന്ന് Upstox ടോക്കൺ നൽകാത്തതിനാലോ ഇന്നത്തെ ട്രേഡിംഗ് സമയം അവസാനിച്ചതിനാലോ പുതിയ ട്രേഡുകൾ എടുത്തിട്ടില്ല. കഴിഞ്ഞ ദിവസങ്ങളിലെ ട്രേഡ് ഹിസ്റ്ററി കാണാൻ താഴെയുള്ള ബട്ടൺ ക്ലിക്ക് ചെയ്യുക.'
                      : 'No orders were placed today. Click below to inspect your complete cumulative trading history.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setTimeView('ALL_TIME')}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/30"
                  >
                    {language === 'ml'
                      ? '🌐 ആകെ ഹിസ്റ്ററി കാണുക (All-Time)'
                      : '🌐 View All-Time History'}
                  </button>
                </div>
              )}

              <PerformanceSummaryCards
                language={language}
                timeView={timeView}
                activeMetrics={activeMetrics}
              />
            </>
          )}

          <LowCapitalRoiCard language={language} allTimeMetrics={allTimeMetrics} />

          <PerformanceKpiCards language={language} activeMetrics={activeMetrics} />

          <PerformanceInsightsBar language={language} activeMetrics={activeMetrics} />
        </>
      )}
    </div>
  );
};
