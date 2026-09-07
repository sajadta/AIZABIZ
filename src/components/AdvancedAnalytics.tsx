import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, TrendingUp, DollarSign, Target } from 'lucide-react';

interface TradeHistory {
    id: string;
    symbol: string;
    type: string;
    buyPrice: number;
    sellPrice: number;
    realizedPnL: number;
    closeTime: string;
}

export const AdvancedAnalytics = ({ history }: { history: TradeHistory[] }) => {
    // Generate cumulative PnL data
    let cumulative = 0;
    const chartData = [...history].reverse().map((t, index) => {
        cumulative += t.realizedPnL;
        return {
            name: `Trade ${index + 1}`,
            pnl: t.realizedPnL,
            cumulative: cumulative,
            time: new Date(t.closeTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            symbol: t.symbol
        };
    });

    const totalProfit = history.filter(t => t.realizedPnL > 0).reduce((a, b) => a + b.realizedPnL, 0);
    const totalLoss = Math.abs(history.filter(t => t.realizedPnL < 0).reduce((a, b) => a + b.realizedPnL, 0));
    const winRate = history.length > 0 ? ((history.filter(t => t.realizedPnL > 0).length / history.length) * 100).toFixed(1) : 0;

    return (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 space-y-4">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
                <Activity size={18} className="text-indigo-400" />
                Performance Analytics & Equity Curve
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                    <p className="text-xs text-slate-400">Total PnL</p>
                    <p className={`text-lg font-bold ${cumulative >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ₹{cumulative.toFixed(2)}
                    </p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                    <p className="text-xs text-slate-400">Win Rate</p>
                    <p className="text-lg font-bold text-blue-400">{winRate}%</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                    <p className="text-xs text-slate-400">Total Trades</p>
                    <p className="text-lg font-bold text-slate-200">{history.length}</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                    <p className="text-xs text-slate-400">Profit Factor</p>
                    <p className="text-lg font-bold text-indigo-400">
                        {totalLoss === 0 ? (totalProfit > 0 ? 'MAX' : '0.0') : (totalProfit / totalLoss).toFixed(2)}
                    </p>
                </div>
            </div>

            {chartData.length > 0 ? (
                <div className="h-64 w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={cumulative >= 0 ? "#4ade80" : "#f87171"} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={cumulative >= 0 ? "#4ade80" : "#f87171"} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickMargin={10} />
                            <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `₹${val}`} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                                itemStyle={{ color: '#e2e8f0' }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="cumulative" 
                                stroke={cumulative >= 0 ? "#4ade80" : "#f87171"} 
                                strokeWidth={2}
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
