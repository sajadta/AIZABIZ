import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { StockQuote } from '../types';

interface TickerBarProps {
  quotes: StockQuote[];
  selectedSymbol: string;
  onSelectSymbol?: (symbol: string, instrumentKey?: string) => void;
}

export const TickerBar: React.FC<TickerBarProps> = ({
  quotes,
  selectedSymbol,
  onSelectSymbol,
}) => {
  return (
    <div className="bg-[#070a11] border-b border-slate-800/60 overflow-x-auto no-scrollbar py-1.5 px-3">
      <div className="flex items-center gap-2 sm:gap-3 min-w-max">
        {quotes.map((q) => {
          const isSelected = q.symbol === selectedSymbol;
          const isPositive = q.change >= 0;

          return (
            <button
              key={q.instrumentKey || q.symbol}
              onClick={() => onSelectSymbol && onSelectSymbol(q.symbol, q.instrumentKey)}
              className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-left transition-all font-mono ${
                isSelected
                  ? 'bg-slate-800/90 border-slate-600 shadow-sm'
                  : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
              } ${q.tickFlash === 'up' ? 'flash-up' : q.tickFlash === 'down' ? 'flash-down' : ''}`}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-200 tracking-tight">
                    {q.symbol}
                  </span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                    {q.exchange}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="text-slate-100">₹{q.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  <span
                    className={`flex items-center text-[10px] ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-2.5 h-2.5 mr-0.5 inline" />
                    ) : (
                      <TrendingDown className="w-2.5 h-2.5 mr-0.5 inline" />
                    )}
                    {isPositive ? '+' : ''}
                    {q.changePercent}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
