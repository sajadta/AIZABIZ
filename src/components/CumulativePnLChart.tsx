import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Position } from '../types';

interface CumulativePnLChartProps {
  tradeHistory: Position[];
  language: 'en' | 'ml';
}

export const CumulativePnLChart: React.FC<CumulativePnLChartProps> = ({ tradeHistory, language }) => {
  const chartData = useMemo(() => {
    if (!tradeHistory || tradeHistory.length === 0) return [];
    
    const today = new Date();
    const dailyPnL: Record<string, number> = {};
    const dateKeys: string[] = [];
    
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyPnL[dateStr] = 0;
      dateKeys.push(dateStr);
    }
    
    (tradeHistory || []).forEach(trade => {
      if (trade.closeTime && trade.realizedPnL) {
        const tradeDate = new Date(trade.closeTime);
        const diffTime = today.getTime() - tradeDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        
        if (diffDays <= 30 && diffDays >= 0) {
          const dateStr = tradeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (dailyPnL[dateStr] !== undefined) {
             dailyPnL[dateStr] += trade.realizedPnL;
          }
        }
      }
    });

    let cumulative = 0;
    return dateKeys.map(date => {
      cumulative += dailyPnL[date];
      return { date, pnl: cumulative };
    });
  }, [tradeHistory]);

  

  const isProfit = chartData[chartData.length - 1]?.pnl >= 0;

  return (
    <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-slate-200">
          {language === 'ml' ? '30 ദിവസത്തെ ഗ്രോത്ത് ചാർട്ട്' : '30-Day PnL Growth'}
        </h3>
        <p className={`text-lg font-black ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isProfit ? '+' : ''}{chartData[chartData.length - 1]?.pnl.toFixed(2)}
        </p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="#64748b" 
              fontSize={10} 
              tickMargin={10} 
              axisLine={false} 
              tickLine={false} 
              minTickGap={20}
            />
            <YAxis 
              stroke="#64748b" 
              fontSize={10} 
              axisLine={false} 
              tickLine={false}
              tickFormatter={(value) => `₹${value}`}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
              itemStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
              formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Cumulative PnL']}
            />
            <Line 
              type="monotone" 
              dataKey="pnl" 
              stroke={isProfit ? "#34d399" : "#fb7185"} 
              strokeWidth={3} 
              dot={false}
              activeDot={{ r: 6, fill: isProfit ? "#34d399" : "#fb7185", stroke: "#0f172a", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
