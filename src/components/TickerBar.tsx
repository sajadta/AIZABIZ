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
  const uniqueQuotes = Array.from(
    new Map(quotes.map((q, idx) => [q.instrumentKey || `${q.symbol}-${idx}`, q])).values()
  );

  return (
    <div className="w-full max-w-full min-w-0 bg-black/30 border-b border-slate-800/60 overflow-x-auto no-scrollbar py-1 px-2 shrink-0">
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-max">
        {uniqueQuotes.map((q, idx) => {
          const isSelected = q.symbol === selectedSymbol;
          const isPositive = q.change >= 0;

          return (
            <button
              key={`${q.instrumentKey || q.symbol}-${idx}`}
              onClick={() => onSelectSymbol && onSelectSymbol(q.symbol, q.instrumentKey)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 min-h-[44px] rounded-lg border text-left transition-all font-mono touch-manipulation select-none active:scale-95 ${
                isSelected
                  ? 'bg-slate-800/90 border-slate-600 shadow-sm'
                  : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700'
              } ${q.tickFlash === 'up' ? 'flash-up' : q.tickFlash === 'down' ? 'flash-down' : ''}`}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-200 tracking-tight">
                    {q.symbol}
                  </span>
                  <span className="text-[8px] sm:text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                    {q.exchange}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold">
                  <span className="text-slate-100">{q.ltp > 0 ? `₹${q.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Live...'}</span>
                  {q.ltp > 0 && (
                    <span
                      className={`flex items-center text-[9px] sm:text-[10px] ${
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
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
