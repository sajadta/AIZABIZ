import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Scale, 
  BarChart3, 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Hourglass,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Position, Language } from '../types';
import { calculateTradeCharges } from '../utils/indicators';

interface PerformanceOverviewCardProps {
  tradeHistory: Position[];
  language: Language;
}

export const PerformanceOverviewCard: React.FC<PerformanceOverviewCardProps> = ({
  tradeHistory = [],
  language,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(tradeHistory.length > 0);
  // Compute core performance metrics
  const metrics = useMemo(() => {
    const totalTrades = tradeHistory.length;
    if (totalTrades === 0) {
      return {
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
      };
    }

    let totalRealizedPnL = 0;
    let totalBrokerageCharges = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let breakEvenTrades = 0;

    let totalDurationMs = 0;
    let validDurationCount = 0;
    let minDurationMs = Number.MAX_SAFE_INTEGER;
    let maxDurationMs = 0;

    tradeHistory.forEach((trade) => {
      const pnl = trade.realizedPnL || 0;
      totalRealizedPnL += pnl;

      const isOpt = Boolean(
        trade.isOption ||
          /\b(CE|PE)\b/i.test(trade.symbol || '') ||
          String(trade.instrumentKey || '').includes('FO')
      );
      const buyP = Number(trade.buyPrice || 0);
      const sellP = Number(trade.sellPrice || trade.currentLTP || buyP);
      const qty = Math.max(1, Number(trade.quantity || 1));
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

      // Calculate trade duration: end time - start time
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

    // Win / Loss Ratio calculation
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

    return {
      totalRealizedPnL,
      totalNetRealizedPnL: totalRealizedPnL - totalBrokerageCharges,
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
    };
  }, [tradeHistory]);

  // Formatter for durations into friendly human-readable strings
  const formatDurationString = (ms: number) => {
    if (ms <= 0) return language === 'ml' ? '< 1 മി' : '< 1 min';
    
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (days > 0) {
      return language === 'ml' 
        ? `${days}ദി ${hours > 0 ? `${hours}മ` : ''}`
        : `${days}d ${hours > 0 ? `${hours}h` : ''}`;
    }
    if (hours > 0) {
      return language === 'ml'
        ? `${hours}മ ${minutes > 0 ? `${minutes}മി` : ''}`
        : `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;
    }
    if (minutes > 0) {
      return language === 'ml'
        ? `${minutes}മി ${remainingSeconds > 0 ? `${remainingSeconds}സെ` : ''}`
        : `${minutes}m ${remainingSeconds > 0 ? `${remainingSeconds}s` : ''}`;
    }
    return language === 'ml' ? `${remainingSeconds}സെ` : `${remainingSeconds}s`;
  };

  const isPositive = metrics.totalNetRealizedPnL >= 0;

  return (
    <div className="bg-[#0b0f19]/95 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2.5 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-base font-black text-white tracking-tight truncate">
                {language === 'ml' ? 'പെർഫോമൻസ് ഓവർവ്യൂ' : 'Performance Overview'}
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                {tradeHistory.length} {tradeHistory.length === 1 ? 'Trade' : 'Trades'}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate hidden sm:block">
              {language === 'ml' 
                ? 'ക്ലോസ് ചെയ്ത ട്രേഡുകളുടെ തത്സമയ റിയലൈസ്ഡ് ലാഭനഷ്ട അവലോകനം' 
                : 'Realized trading metrics, win/loss distribution, and execution velocity'}
            </p>
          </div>
        </div>

        {/* Net P&L Tag & Collapse/Expand Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="px-2 sm:px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-1.5">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400">
              {language === 'ml' ? 'NET P&L' : 'NET P&L'}:
            </span>
            <span className={`text-[11px] sm:text-xs font-black font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositive ? '+' : ''}₹{metrics.totalNetRealizedPnL.toFixed(2)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition flex items-center gap-1 text-xs font-bold"
            title={isExpanded ? 'ചുരുക്കുക (Collapse)' : 'വിശദാംശങ്ങൾ കാണുക (Expand)'}
          >
            {isExpanded ? (
              <>
                <span className="text-[10px] hidden sm:inline">{language === 'ml' ? 'ചുരുക്കുക' : 'Collapse'}</span>
                <ChevronUp className="w-4 h-4 text-cyan-400" />
              </>
            ) : (
              <>
                <span className="text-[10px] text-cyan-400 hidden sm:inline">{language === 'ml' ? 'വിശദാംശങ്ങൾ' : 'Details'}</span>
                <ChevronDown className="w-4 h-4 text-cyan-400" />
              </>
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* 4-Card Total Profit, Total Loss, Total Brokerage Charges & Net Realized P&L Summary Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-800/50 flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300/90">
                {language === 'ml' ? 'ആകെ ലാഭം (Total Profit)' : 'Total Profit (Gross)'}
              </span>
              <span className="text-lg sm:text-xl font-black font-mono text-emerald-400 mt-1">
                +₹{metrics.grossProfit.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                {metrics.winningTrades} {language === 'ml' ? 'ലാഭ ട്രേഡുകൾ' : 'Winning Trades'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/25 border border-rose-800/50 flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-300/90">
                {language === 'ml' ? 'ആകെ നഷ്ടം (Total Loss)' : 'Total Loss (Gross)'}
              </span>
              <span className="text-lg sm:text-xl font-black font-mono text-rose-400 mt-1">
                -₹{metrics.grossLoss.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                {metrics.losingTrades} {language === 'ml' ? 'നഷ്ട ട്രേഡുകൾ' : 'Losing Trades'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-950/25 border border-amber-800/50 flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300/90">
                {language === 'ml' ? 'ആകെ ബ്രോക്കറേജ് & ടാക്സ് (Total Charges)' : 'Total Brokerage & Taxes'}
              </span>
              <span className="text-lg sm:text-xl font-black font-mono text-amber-400 mt-1">
                ₹{metrics.totalBrokerageCharges.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                {language === 'ml' ? 'Upstox ബ്രോക്കറേജ് + നികുതികൾ' : 'Brokerage + STT + GST + Stamp'}
              </span>
            </div>

            <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
              metrics.totalNetRealizedPnL >= 0
                ? 'bg-emerald-950/30 border-emerald-500/40'
                : 'bg-rose-950/30 border-rose-500/40'
            }`}>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-300">
                {language === 'ml' ? 'അറ്റ ലാഭം / നഷ്ടം (Net P&L)' : 'Net P&L (After Brokerage)'}
              </span>
              <span className={`text-lg sm:text-xl font-black font-mono mt-1 ${
                metrics.totalNetRealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {metrics.totalNetRealizedPnL >= 0 ? '+' : '-'}₹{Math.abs(metrics.totalNetRealizedPnL).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                {language === 'ml' ? 'എല്ലാ ചാർജുകളും കിഴിച്ച ശേഷം' : 'Realized PnL minus all charges'}
              </span>
            </div>
          </div>

          {/* 3 Core Primary KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        
        {/* KPI 1: Total Net Realized PnL (After Brokerage & Taxes) */}
        <div className={`p-4 rounded-xl border relative overflow-hidden flex flex-col justify-between ${
          isPositive 
            ? 'bg-gradient-to-br from-emerald-950/20 via-slate-900 to-slate-900 border-emerald-900/40' 
            : 'bg-gradient-to-br from-rose-950/20 via-slate-900 to-slate-900 border-rose-900/40'
        }`}>
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {language === 'ml' ? 'യഥാർത്ഥ അറ്റ ലാഭം / നഷ്ടം (NET P&L)' : 'Actual Net Realized P&L'}
              </span>
              <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
            </div>

            <div className="flex items-baseline gap-2 my-1 flex-wrap">
              <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {isPositive ? '+' : ''}₹{metrics.totalNetRealizedPnL.toFixed(2)}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                (Gross: {metrics.totalRealizedPnL >= 0 ? '+' : ''}₹{metrics.totalRealizedPnL.toFixed(2)})
              </span>
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400/90 font-mono">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              +₹{metrics.grossProfit.toFixed(0)}
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1 text-rose-400/90 font-mono">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
              -₹{metrics.grossLoss.toFixed(0)}
            </span>
          </div>
        </div>

        {/* KPI 2: Win / Loss Ratio */}
        <div className="p-4 rounded-xl border border-slate-800 bg-gradient-to-br from-indigo-950/20 via-slate-900 to-slate-900 flex flex-col justify-between">
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
                {metrics.winLossRatio}
              </span>
            </div>
          </div>

          {/* Ratio bar & Counts */}
          <div className="pt-3 mt-2 border-t border-slate-800/80 space-y-1.5">
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${metrics.winRatePercent}%` }}
              />
              <div 
                className="bg-rose-500 h-full transition-all duration-500"
                style={{ width: `${100 - metrics.winRatePercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {metrics.winningTrades} {language === 'ml' ? 'വിജയം' : 'Wins'}
              </span>
              <span className="text-rose-400 font-mono font-bold flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                {metrics.losingTrades} {language === 'ml' ? 'നഷ്ടം' : 'Losses'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Average Trade Duration */}
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
                {metrics.validDurationCount > 0 ? formatDurationString(metrics.avgDurationMs) : (tradeHistory.length > 0 ? 'Intraday' : '0m')}
              </span>
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>
              {language === 'ml' ? 'കുറഞ്ഞ സമയം' : 'Min'}:{' '}
              <strong className="text-slate-200">
                {metrics.minDurationMs > 0 ? formatDurationString(metrics.minDurationMs) : '< 1m'}
              </strong>
            </span>
            <span className="text-slate-600">|</span>
            <span>
              {language === 'ml' ? 'കൂടിയ സമയം' : 'Max'}:{' '}
              <strong className="text-slate-200">
                {metrics.maxDurationMs > 0 ? formatDurationString(metrics.maxDurationMs) : (tradeHistory.length > 0 ? 'EOD' : '0m')}
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
            ₹{metrics.avgWin.toFixed(2)}
          </span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            {language === 'ml' ? 'ശരാശരി നഷ്ടം' : 'Average Loss'}
          </span>
          <span className="font-mono font-extrabold text-rose-400 text-sm mt-0.5">
            -₹{metrics.avgLoss.toFixed(2)}
          </span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            {language === 'ml' ? 'റിസ്ക്-റിവാർഡ് നിരക്ക്' : 'Payoff Ratio (Avg W/L)'}
          </span>
          <span className="font-mono font-extrabold text-indigo-400 text-sm mt-0.5">
            {metrics.avgLoss > 0 ? `${(metrics.avgWin / metrics.avgLoss).toFixed(2)} : 1` : (metrics.avgWin > 0 ? 'Pure Profit' : '1.00 : 1')}
          </span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            {language === 'ml' ? 'ബ്രേക്ക്-ഈവൻ ട്രേഡുകൾ' : 'Break-Even Trades'}
          </span>
          <span className="font-mono font-extrabold text-slate-300 text-sm mt-0.5">
            {metrics.breakEvenTrades} {language === 'ml' ? 'എണ്ണം' : 'Trades'}
          </span>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
