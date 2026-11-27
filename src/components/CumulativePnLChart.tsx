import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { Position } from '../types';
import { buildPnLChartData } from './charts/pnlChartData';
import { computePnLSummary } from './charts/pnlSummary';

interface CumulativePnLChartProps {
  tradeHistory: Position[];
  language: 'en' | 'ml';
}

interface ChartPoint {
  date: string;
  displayDate: string;
  dailyPnL: number;
  cumulative: number;
  tradesCount: number;
}

const PNL_CHART_MARGIN = { top: 10, right: 16, left: -10, bottom: 5 };
const PNL_AXIS_LINE = { stroke: '#334155' };
const PNL_REF_LABEL = {
  value: '₹0 Break-Even',
  position: 'insideBottomLeft' as const,
  fill: '#64748b',
  fontSize: 10,
};

export const CumulativePnLChart: React.FC<CumulativePnLChartProps> = ({
  tradeHistory = [],
  language,
}) => {
  const chartData = useMemo<ChartPoint[]>(
    () => buildPnLChartData(tradeHistory, language),
    [tradeHistory, language],
  );

  const { totalPnL, winningTrades, winRate } = useMemo(
    () => computePnLSummary(tradeHistory),
    [tradeHistory],
  );

  const maxCumulative = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.max(...chartData.map((d) => d.cumulative));
  }, [chartData]);

  const isProfit = totalPnL >= 0;
  const strokeColor = isProfit ? '#10b981' : '#f43f5e';
  const dotConfig = useMemo(
    () => ({
      r: 4,
      fill: '#090d16',
      strokeWidth: 2,
      stroke: strokeColor,
    }),
    [strokeColor],
  );
  const activeDotConfig = useMemo(
    () => ({
      r: 6,
      fill: strokeColor,
      stroke: '#0f172a',
      strokeWidth: 2,
    }),
    [strokeColor],
  );

  return (
    <section className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
              {language === 'ml'
                ? 'പ്രതിദിന ക്യുമുലേറ്റീവ് P&L പ്രകടനം'
                : 'Daily Cumulative P&L Performance'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {language === 'ml'
                ? 'ട്രേഡ് ഹിസ്റ്ററി അടിസ്ഥാനമാക്കിയുള്ള ലൈവ് പ്രകടന ഗ്രാഫ്'
                : 'Performance trajectory and equity curve generated from trade history'}
            </p>
          </div>
        </div>

        {/* Quick Stat Highlights */}
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-slate-800 flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {language === 'ml' ? 'വിൻ റേറ്റ്' : 'Win Rate'}:
            </span>
            <span
              className={`text-xs font-black font-mono ${winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}
            >
              {winRate}%
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-slate-800 flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {language === 'ml' ? 'ക്യുമുലേറ്റീവ് P&L' : 'Net P&L'}:
            </span>
            <span
              className={`text-xs sm:text-sm font-black font-mono flex items-center gap-0.5 ${
                isProfit ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isProfit ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {isProfit ? '+' : ''}₹{totalPnL.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Canvas or Empty State */}
      {chartData.length > 0 ? (
        <div className="w-full">
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height={256} minWidth={0}>
              <LineChart data={chartData} margin={PNL_CHART_MARGIN}>
                <defs>
                  <linearGradient id="pnlGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={PNL_AXIS_LINE}
                  tickMargin={8}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={PNL_AXIS_LINE}
                  tickFormatter={(val) => `₹${val}`}
                />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" label={PNL_REF_LABEL} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as ChartPoint;
                      const pointPositive = data.cumulative >= 0;
                      return (
                        <div className="bg-[#0b0f19]/95 backdrop-blur-md border border-slate-700 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 font-sans min-w-[170px]">
                          <div className="text-[11px] font-bold text-slate-300 border-b border-slate-800 pb-1 flex items-center justify-between">
                            <span>{data.displayDate}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              #{data.tradesCount} {data.tradesCount === 1 ? 'trade' : 'trades'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-400">
                            <span>{language === 'ml' ? 'ഈ ദിവസത്തെ P&L' : 'Period P&L'}:</span>
                            <span
                              className={`font-mono font-bold ${
                                data.dailyPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {data.dailyPnL >= 0 ? '+' : ''}₹{data.dailyPnL.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-200 font-bold pt-1 border-t border-slate-800/80">
                            <span>
                              {language === 'ml' ? 'ആകെ ക്യുമുലേറ്റീവ്' : 'Cumulative P&L'}:
                            </span>
                            <span
                              className={`font-mono font-black text-sm ${
                                pointPositive ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {pointPositive ? '+' : ''}₹{data.cumulative.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  stroke={strokeColor}
                  strokeWidth={3}
                  isAnimationActive={false}
                  dot={dotConfig}
                  activeDot={activeDotConfig}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Metrics Footer */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800/60 text-xs">
            <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800/50">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                {language === 'ml' ? 'ആകെ ട്രേഡുകൾ' : 'Total Trades'}
              </span>
              <span className="font-mono font-extrabold text-slate-200 text-sm">
                {tradeHistory.length}
              </span>
            </div>

            <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800/50">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                {language === 'ml' ? 'വിജയിച്ച ട്രേഡുകൾ' : 'Winning Trades'}
              </span>
              <span className="font-mono font-extrabold text-emerald-400 text-sm">
                {winningTrades} / {tradeHistory.length}
              </span>
            </div>

            <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800/50">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                {language === 'ml' ? 'പരമാവധി പീക്ക്' : 'Peak Equity'}
              </span>
              <span className="font-mono font-extrabold text-cyan-400 text-sm">
                ₹{maxCumulative.toFixed(2)}
              </span>
            </div>

            <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800/50">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                {language === 'ml' ? 'അവസ്ഥ' : 'Trajectory Status'}
              </span>
              <span
                className={`font-mono font-black text-sm ${
                  isProfit ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isProfit ? 'PROFITABLE' : 'DRAWDOWN'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-56 w-full flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-black/20 text-slate-400 text-xs p-6 text-center space-y-2">
          <div className="p-3 rounded-full bg-slate-800/80 text-slate-500">
            <Activity className="w-6 h-6" />
          </div>
          <p className="font-semibold text-slate-300">
            {language === 'ml' ? 'ട്രേഡ് ഹിസ്റ്ററി രേഖപ്പെടുത്തിയിട്ടില്ല' : 'No Closed Trades Yet'}
          </p>
          <p className="text-[11px] text-slate-500 max-w-sm">
            {language === 'ml'
              ? 'ഓർഡറുകൾ പൂർത്തിയാക്കി പൊസിഷനുകൾ ക്ലോസ് ചെയ്യുമ്പോൾ പ്രതിദിന ക്യുമുലേറ്റീവ് P&L ലൈൻ ചാർട്ട് ഇവിടെ തത്സമയം ദൃശ്യമാകും.'
              : 'As trades execute and close, your daily cumulative PnL performance line chart will automatically render here in real time.'}
          </p>
        </div>
      )}
    </section>
  );
};
