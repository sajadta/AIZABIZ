import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Scale, 
  BarChart3, 
  CheckCircle2, 
  XCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  ChevronDown, 
  ChevronUp,
  Calendar,
  Globe,
  Zap,
  Percent,
  Coins
} from 'lucide-react';
import { Position, Language } from '../types';
import { calculateTradeCharges } from '../utils/indicators';

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
  const combinedTrades = useMemo(() => [...activePositions, ...tradeHistory], [activePositions, tradeHistory]);
  const [isExpanded, setIsExpanded] = useState<boolean>(combinedTrades.length > 0);
  const [timeView, setTimeView] = useState<'COMPARE' | 'TODAY' | 'ALL_TIME'>('COMPARE');

  // Compute metrics helper
  const computeMetrics = (trades: Position[]) => {
    const totalTrades = trades.length;
    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        totalRealizedPnL: 0,
        totalNetRealizedPnL: 0,
        totalBrokerageCharges: 0,
        grossProfit: 0,
        grossLoss: 0,
        winningTrades: 0,
        losingTrades: 0,
        breakEvenTrades: 0,
        winLossRatio: '0.00 : 1',
        winRatePercent: 0,
        avgDurationMs: 0,
        minDurationMs: 0,
        maxDurationMs: 0,
        validDurationCount: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        totalCapitalInvested: 0,
        avgCapitalPerTrade: 0,
        roiPercent: 0,
      };
    }

    let totalRealizedPnL = 0;
    let totalBrokerageCharges = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let breakEvenTrades = 0;
    let totalCapitalInvested = 0;

    let totalDurationMs = 0;
    let validDurationCount = 0;
    let minDurationMs = Number.MAX_SAFE_INTEGER;
    let maxDurationMs = 0;

    trades.forEach((trade) => {
      const buyP = Number(trade.buyPrice || 0);
      const sellP = Number(trade.sellPrice || trade.currentLTP || buyP);
      const qty = Math.max(1, Number(trade.quantity || 1));
      const capital = buyP * qty;
      totalCapitalInvested += capital;

      const pnl =
        trade.realizedPnL !== undefined
          ? Number(trade.realizedPnL)
          : trade.pnl !== undefined
            ? Number(trade.pnl)
            : (sellP - buyP) * qty;
      totalRealizedPnL += pnl;

      const isOpt = Boolean(
        trade.isOption ||
          /\b(CE|PE)\b/i.test(trade.symbol || '') ||
          String(trade.instrumentKey || '').includes('FO')
      );
      const tradeCharges =
        Number((trade as any).brokerageCharges) > 0
          ? Number((trade as any).brokerageCharges)
          : calculateTradeCharges(buyP, qty, isOpt, sellP).roundTripCharges;
      totalBrokerageCharges += tradeCharges;

      if (pnl > 0) {
        winningTrades += 1;
        grossProfit += pnl;
      } else if (pnl < 0) {
        losingTrades += 1;
        grossLoss += Math.abs(pnl);
      } else {
        breakEvenTrades += 1;
      }

      // Calculate trade duration
      const startTime = trade.openedAt 
        ? new Date(trade.openedAt).getTime() 
        : (trade as any).openTime 
        ? new Date((trade as any).openTime).getTime() 
        : (trade as any).timestamp 
        ? new Date((trade as any).timestamp).getTime() 
        : 0;

      const endTime = trade.closeTime ? new Date(trade.closeTime).getTime() : 0;

      if (startTime > 0 && endTime > 0 && endTime >= startTime) {
        const duration = endTime - startTime;
        totalDurationMs += duration;
        validDurationCount += 1;
        if (duration < minDurationMs) minDurationMs = duration;
        if (duration > maxDurationMs) maxDurationMs = duration;
      }
    });

    let winLossRatio = '0.00 : 1';
    if (losingTrades === 0) {
      winLossRatio = winningTrades > 0 ? `${winningTrades}.0 : 0` : '0.0 : 0';
    } else {
      winLossRatio = `${(winningTrades / losingTrades).toFixed(2)} : 1`;
    }

    const winRatePercent = Math.round((winningTrades / totalTrades) * 100);
    const avgDurationMs = validDurationCount > 0 ? Math.round(totalDurationMs / validDurationCount) : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;
    const avgWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
    const netPnL = totalRealizedPnL - totalBrokerageCharges;
    const avgCapitalPerTrade = totalTrades > 0 ? totalCapitalInvested / totalTrades : 0;
    const roiPercent = totalCapitalInvested > 0 ? (netPnL / totalCapitalInvested) * 100 : 0;

    return {
      totalTrades,
      totalRealizedPnL,
      totalNetRealizedPnL: netPnL,
      totalBrokerageCharges,
      grossProfit,
      grossLoss,
      winningTrades,
      losingTrades,
      breakEvenTrades,
      winLossRatio,
      winRatePercent,
      avgDurationMs,
      minDurationMs: minDurationMs === Number.MAX_SAFE_INTEGER ? 0 : minDurationMs,
      maxDurationMs,
      validDurationCount,
      profitFactor,
      avgWin,
      avgLoss,
      totalCapitalInvested,
      avgCapitalPerTrade,
      roiPercent,
    };
  };

  // Filter Today's trades (IST based on when the trade was opened/taken)
  const todayIst = useMemo(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), []);
  
  const getTradeSessionDate = (t: Position) => {
    if (t.openedAtMs && !isNaN(Number(t.openedAtMs))) {
      return new Date(Number(t.openedAtMs)).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    }
    if (t.openedAt && !isNaN(new Date(t.openedAt).getTime())) {
      return new Date(t.openedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    }
    if (t.closeTime && !isNaN(new Date(t.closeTime).getTime())) {
      return new Date(t.closeTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    }
    return todayIst;
  };

  const todayTrades = useMemo(() => {
    return combinedTrades.filter((t) => getTradeSessionDate(t) === todayIst);
  }, [combinedTrades, todayIst]);

  const todayMetrics = useMemo(() => computeMetrics(todayTrades), [todayTrades]);
  const allTimeMetrics = useMemo(() => computeMetrics(combinedTrades), [combinedTrades]);

  const activeMetrics = timeView === 'TODAY' ? todayMetrics : allTimeMetrics;

  const formatDurationString = (ms: number) => {
    if (ms <= 0) return language === 'ml' ? '< 1 മി' : '< 1 min';
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (days > 0) return language === 'ml' ? `${days}ദി ${hours > 0 ? `${hours}മ` : ''}` : `${days}d ${hours > 0 ? `${hours}h` : ''}`;
    if (hours > 0) return language === 'ml' ? `${hours}മ ${minutes > 0 ? `${minutes}മി` : ''}` : `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;
    if (minutes > 0) return language === 'ml' ? `${minutes}മി ${remainingSeconds > 0 ? `${remainingSeconds}സെ` : ''}` : `${minutes}m ${remainingSeconds > 0 ? `${remainingSeconds}s` : ''}`;
    return language === 'ml' ? `${remainingSeconds}സെ` : `${remainingSeconds}s`;
  };

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
                : "Distinct daily trading profits and total cumulative performance metrics"}
            </p>
          </div>
        </div>

        {/* Both Today and All-Time P&L Badges + Expand Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Today Net P&L */}
          <div className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
            isTodayPositive ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400' : 'bg-rose-950/40 border-rose-800/60 text-rose-400'
          }`} title={language === 'ml' ? 'ഇന്നത്തെ അറ്റ ലാഭം / നഷ്ടം' : "Today's Net Realized P&L"}>
            <span className="text-[9px] uppercase font-bold text-slate-400 font-sans">
              {language === 'ml' ? 'ഇന്ന്:' : 'Day:'}
            </span>
            <span className="text-xs font-black font-mono">
              {isTodayPositive ? '+' : ''}₹{todayMetrics.totalNetRealizedPnL.toFixed(2)}
            </span>
          </div>

          {/* Total Cumulative Net P&L */}
          <div className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
            isAllTimePositive ? 'bg-indigo-950/40 border-indigo-700/60 text-cyan-300' : 'bg-rose-950/40 border-rose-800/60 text-rose-400'
          }`} title={language === 'ml' ? 'ആകെ മൊത്തം അറ്റ ലാഭം / നഷ്ടം' : "Total Cumulative Net Realized P&L"}>
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
                <span>{language === 'ml' ? '⚡ രണ്ടും പ്രത്യേകം (സെപ്പറേറ്റ് താരതമ്യം)' : '⚡ Separate Comparison'}</span>
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
                <span>{language === 'ml' ? '📅 ഇന്നത്തെ ട്രേഡുകൾ (Today)' : "📅 Today's Trades"}</span>
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
                <span>{language === 'ml' ? '🌐 ആകെ ഹിസ്റ്ററി (All-Time)' : '🌐 All-Time History'}</span>
              </button>
            </div>
          </div>

          {/* DUAL COMPARISON VIEW (When COMPARE is active) */}
          {timeView === 'COMPARE' && (
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
                        {language === 'ml' ? '📅 ഇന്നത്തെ ട്രേഡിംഗ് സംഗ്രഹം (Today)' : "📅 Today's Trading Performance"}
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
                    <span className={`text-base sm:text-lg font-black font-mono ${isTodayPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
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
                      {todayMetrics.winningTrades} {language === 'ml' ? 'വിജയം' : 'Wins'} ({todayMetrics.winRatePercent}%)
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
                        {language === 'ml' ? '🌐 ആകെ ട്രേഡിംഗ് ഹിസ്റ്ററി (All-Time)' : '🌐 Total Cumulative Performance'}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {language === 'ml' ? 'എല്ലാ ദിവസങ്ങളിലെയും ആകെ' : 'All Trading Days'} • {allTimeMetrics.totalTrades} {language === 'ml' ? 'ട്രേഡുകൾ' : 'Trades'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      {language === 'ml' ? 'ആകെ അറ്റ ലാഭം' : 'Total Net P&L'}
                    </span>
                    <span className={`text-base sm:text-lg font-black font-mono ${isAllTimePositive ? 'text-emerald-400' : 'text-rose-400'}`}>
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
                      {allTimeMetrics.winningTrades} {language === 'ml' ? 'വിജയം' : 'Wins'} ({allTimeMetrics.winRatePercent}%)
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
                    {language === 'ml' ? '🌐 ആകെ ഹിസ്റ്ററി കാണുക (All-Time)' : '🌐 View All-Time History'}
                  </button>
                </div>
              )}

              {/* 4-Card Summary Bar for Selected View */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50 flex flex-col justify-between shadow-sm">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300/90">
                    {timeView === 'TODAY' 
                      ? (language === 'ml' ? 'ഇന്നത്തെ ലാഭം (Gross)' : "Today's Gross Profit") 
                      : (language === 'ml' ? 'ആകെ ലാഭം (Total Gross)' : 'Total Gross Profit')}
                  </span>
                  <span className="text-lg sm:text-xl font-black font-mono text-emerald-400 mt-1">
                    +₹{activeMetrics.grossProfit.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {activeMetrics.winningTrades} {language === 'ml' ? 'ലാഭ ട്രേഡുകൾ' : 'Winning Trades'} ({activeMetrics.winRatePercent}%)
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/50 flex flex-col justify-between shadow-sm">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-300/90">
                    {timeView === 'TODAY' 
                      ? (language === 'ml' ? 'ഇന്നത്തെ നഷ്ടം (Gross)' : "Today's Gross Loss") 
                      : (language === 'ml' ? 'ആകെ നഷ്ടം (Total Gross)' : 'Total Gross Loss')}
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

                <div className={`p-3.5 rounded-xl border flex flex-col justify-between shadow-md transition-all ${
                  activeMetrics.totalNetRealizedPnL >= 0
                    ? 'bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                    : 'bg-rose-950/40 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.25)]'
                }`}>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-300">
                    {language === 'ml' ? 'അറ്റ ലാഭം (Net P&L)' : 'Net P&L (After Charges)'}
                  </span>
                  <span className={`text-lg sm:text-xl font-black font-mono mt-1 ${
                    activeMetrics.totalNetRealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {activeMetrics.totalNetRealizedPnL >= 0 ? '+' : '-'}₹{Math.abs(activeMetrics.totalNetRealizedPnL).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {language === 'ml' ? 'എല്ലാ ചാർജുകളും കിഴിച്ച ശേഷം' : 'Realized net payoff'}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Low Capital & High ROI Strategy Analytics Card */}
          <div className="p-4 rounded-xl border border-cyan-900/40 bg-gradient-to-r from-cyan-950/20 via-slate-900 to-indigo-950/20 flex flex-col md:flex-row items-center justify-between gap-3 text-xs shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-white text-xs sm:text-sm">
                  {language === 'ml' 
                    ? 'കുറഞ്ഞ മുതൽമുടക്കിൽ പരമാവധി ലാഭം ഉറപ്പാക്കുന്ന അൽഗോരിതം മുൻഗണന' 
                    : 'Low Capital Investment & High ROI Mandate Execution'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {language === 'ml'
                    ? '₹2,500 - ₹8,500 കുറഞ്ഞ മുതൽമുടക്കുള്ള സ്ട്രൈക്കുകൾക്ക് അൽഗോരിതം മുൻഗണന നൽകുന്നു; 20% - 40% വരെ ഉയർന്ന റിട്ടേൺ (ROI) നൽകുന്ന ട്രേഡുകൾ മാത്രം തിരഞ്ഞെടുക്കുന്നു.'
                    : 'Strikes requiring ₹2,500 - ₹8,500 are prioritized, maximizing % ROI while keeping max stop-loss risk strictly capped under ₹400.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-slate-800 text-center">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">{language === 'ml' ? 'ശരാശരി റിട്ടേൺ (ROI)' : 'Avg Return (ROI)'}</span>
                <span className="text-xs font-mono font-black text-emerald-400">
                  {allTimeMetrics.roiPercent > 0 ? `+${allTimeMetrics.roiPercent.toFixed(1)}%` : `${allTimeMetrics.roiPercent.toFixed(1)}%`}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-slate-800 text-center">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">{language === 'ml' ? 'റിസ്ക്-റിവാർഡ്' : 'Risk : Reward'}</span>
                <span className="text-xs font-mono font-black text-cyan-300">
                  {allTimeMetrics.avgLoss > 0 ? `1 : ${(allTimeMetrics.avgWin / allTimeMetrics.avgLoss).toFixed(1)}` : '1 : 2.8+'}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-slate-800 text-center">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">{language === 'ml' ? 'മാക്സ് റിസ്ക് ക്യാപ്പ്' : 'Max Risk Cap'}</span>
                <span className="text-xs font-mono font-black text-rose-400">-₹400 / 2.5%</span>
              </div>
            </div>
          </div>

          {/* 2 Efficiency KPI Cards (Win/Loss Ratio & Duration) without repeating Net P&L */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-xl border border-slate-800 bg-gradient-to-br from-indigo-950/20 via-slate-900 to-slate-900 flex flex-col justify-between shadow-md">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    {language === 'ml' ? 'വിൻ / ലോസ് അനുപാതം' : 'Win / Loss Ratio'}
                  </span>
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Scale className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex items-baseline gap-2 my-1">
                  <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                    {activeMetrics.winLossRatio}
                  </span>
                </div>
              </div>

              {/* Ratio bar & Counts */}
              <div className="pt-3 mt-2 border-t border-slate-800/80 space-y-1.5">
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500"
                    style={{ width: `${activeMetrics.winRatePercent}%` }}
                  />
                  <div 
                    className="bg-rose-500 h-full transition-all duration-500"
                    style={{ width: `${100 - activeMetrics.winRatePercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {activeMetrics.winningTrades} {language === 'ml' ? 'വിജയം' : 'Wins'}
                  </span>
                  <span className="text-rose-400 font-mono font-bold flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {activeMetrics.losingTrades} {language === 'ml' ? 'നഷ്ടം' : 'Losses'}
                  </span>
                </div>
              </div>
            </div>

            {/* KPI 3: Average Duration */}
            <div className="p-4 rounded-xl border border-slate-800 bg-gradient-to-br from-cyan-950/20 via-slate-900 to-slate-900 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    {language === 'ml' ? 'ശരാശരി ട്രേഡ് സമയം' : 'Avg Trade Duration'}
                  </span>
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex items-baseline gap-2 my-1">
                  <span className="text-2xl sm:text-3xl font-black font-mono text-cyan-300 tracking-tight">
                    {activeMetrics.validDurationCount > 0 ? formatDurationString(activeMetrics.avgDurationMs) : 'Intraday'}
                  </span>
                </div>
              </div>

              <div className="pt-3 mt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>
                  {language === 'ml' ? 'കുറഞ്ഞ സമയം' : 'Min'}:{' '}
                  <strong className="text-slate-200">
                    {activeMetrics.minDurationMs > 0 ? formatDurationString(activeMetrics.minDurationMs) : '< 1m'}
                  </strong>
                </span>
                <span className="text-slate-600">|</span>
                <span>
                  {language === 'ml' ? 'കൂടിയ സമയം' : 'Max'}:{' '}
                  <strong className="text-slate-200">
                    {activeMetrics.maxDurationMs > 0 ? formatDurationString(activeMetrics.maxDurationMs) : 'EOD'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

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
                {activeMetrics.avgLoss > 0 ? `${(activeMetrics.avgWin / activeMetrics.avgLoss).toFixed(2)} : 1` : (activeMetrics.avgWin > 0 ? 'Pure Profit' : '1.00 : 1')}
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
      )}
    </div>
  );
};
