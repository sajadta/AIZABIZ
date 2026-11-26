import React from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Activity } from 'lucide-react';

interface TradeHistory {
  id: string;
  symbol: string;
  type: string;
  buyPrice: number;
  sellPrice: number;
  realizedPnL: number;
  closeTime: string;
}

const ANALYTICS_CHART_MARGIN = { top: 10, right: 10, left: -20, bottom: 0 };
const ANALYTICS_TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  borderColor: '#334155',
  borderRadius: '8px',
  fontSize: '12px',
};
const ANALYTICS_TOOLTIP_ITEM_STYLE = { color: '#e2e8f0' };

export const AdvancedAnalytics = ({ history }: { history: TradeHistory[] }) => {
  // Generate cumulative PnL data
  let cumulative = 0;
  const chartData = [...history].reverse().map((t, index) => {
    cumulative += t.realizedPnL;
    return {
      name: `Trade ${index + 1}`,
      pnl: t.realizedPnL,
      cumulative: cumulative,
      time: new Date(t.closeTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      symbol: t.symbol,
    };
  });

  const totalProfit = history
    .filter((t) => t.realizedPnL > 0)
    .reduce((a, b) => a + b.realizedPnL, 0);
  const totalLoss = Math.abs(
    history.filter((t) => t.realizedPnL < 0).reduce((a, b) => a + b.realizedPnL, 0),
  );
  const totalBrokerage = history.reduce((sum, t: any) => {
    if (Number(t.brokerageCharges) > 0) return sum + Number(t.brokerageCharges);
    const qty = Math.max(1, Number(t.quantity || 1));
    const buyVal = Number(t.buyPrice || 0) * qty;
    const sellVal = Number(t.sellPrice || t.buyPrice || 0) * qty;
    return sum + (40 + sellVal * 0.00125 + (buyVal + sellVal) * 0.0005 + 40 * 0.18);
  }, 0);
  const netAfterCharges = cumulative - totalBrokerage;
  const winRate =
    history.length > 0
      ? ((history.filter((t) => t.realizedPnL > 0).length / history.length) * 100).toFixed(1)
      : 0;

  return (
    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 space-y-4">
      <h3 className="font-bold text-slate-200 flex items-center gap-2">
        <Activity size={18} className="text-indigo-400" />
        Performance Analytics & Equity Curve
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-emerald-950/30 p-3 rounded-lg border border-emerald-800/50">
          <p className="text-xs text-emerald-300/90 font-semibold">Total Profit</p>
          <p className="text-lg font-bold font-mono text-emerald-400">+₹{totalProfit.toFixed(2)}</p>
        </div>
        <div className="bg-rose-950/30 p-3 rounded-lg border border-rose-800/50">
          <p className="text-xs text-rose-300/90 font-semibold">Total Loss</p>
          <p className="text-lg font-bold font-mono text-rose-400">-₹{totalLoss.toFixed(2)}</p>
        </div>
        <div className="bg-amber-950/30 p-3 rounded-lg border border-amber-800/50">
          <p className="text-xs text-amber-300/90 font-semibold">Total Brokerage</p>
          <p className="text-lg font-bold font-mono text-amber-400">₹{totalBrokerage.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
          <p className="text-xs text-cyan-300 font-semibold">Net P&L (After Tax)</p>
          <p
            className={`text-lg font-bold font-mono ${netAfterCharges >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {netAfterCharges >= 0 ? '+' : '-'}₹{Math.abs(netAfterCharges).toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
          <p className="text-xs text-slate-400">Win Rate ({history.length} Trades)</p>
          <p className="text-lg font-bold font-mono text-blue-400">{winRate}%</p>
        </div>
      </div>

      {chartData.length > 0 ? (
        <div className="h-64 w-full mt-4">
          <ResponsiveContainer width="100%" height={256} minWidth={0}>
            <AreaChart data={chartData} margin={ANALYTICS_CHART_MARGIN}>
              <defs>
                <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={cumulative >= 0 ? '#4ade80' : '#f87171'}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={cumulative >= 0 ? '#4ade80' : '#f87171'}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickMargin={10} />
              <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `₹${val}`} />
              <Tooltip
                contentStyle={ANALYTICS_TOOLTIP_STYLE}
                itemStyle={ANALYTICS_TOOLTIP_ITEM_STYLE}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={cumulative >= 0 ? '#4ade80' : '#f87171'}
                strokeWidth={2}
                isAnimationActive={false}
                fillOpacity={1}
                fill="url(#colorPnL)"
                name="Cumulative PnL"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 w-full flex items-center justify-center border border-dashed border-slate-700 rounded-lg text-slate-500 text-sm mt-4">
          No trades taken yet. Start the bot to generate analytics.
        </div>
      )}
    </div>
  );
};
