import React from 'react';
import { StockQuote } from '../types';

interface TickerBarProps {
  quotes: StockQuote[];
  selectedSymbol: string;
  onSelectSymbol?: (symbol: string, instrumentKey?: string) => void;
}

export const TickerBar: React.FC<TickerBarProps> = ({ quotes, selectedSymbol, onSelectSymbol }) => {
  const uniqueQuotes = Array.from(
    new Map(quotes.map((q, idx) => [q.instrumentKey || `${q.symbol}-${idx}`, q])).values(),
  );

  return (
    <div className="w-full max-w-full min-w-0 bg-slate-950/60 border-b border-slate-800/50 overflow-x-auto no-scrollbar py-1 px-2 shrink-0">
      <div className="flex items-center gap-1 sm:gap-2 min-w-max">
        {uniqueQuotes.map((q, idx) => {
          const isSelected = q.symbol === selectedSymbol;
          const isPositive = q.change >= 0;

          return (
            <button
              key={`${q.instrumentKey || q.symbol}-${idx}`}
              onClick={() => onSelectSymbol && onSelectSymbol(q.symbol, q.instrumentKey)}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-left transition-all font-mono touch-manipulation select-none active:scale-95 ${
                isSelected
                  ? 'bg-slate-800/80 text-white shadow-sm ring-1 ring-slate-700/80'
                  : 'hover:bg-slate-900/80 text-slate-300'
              } ${q.tickFlash === 'up' ? 'flash-up' : q.tickFlash === 'down' ? 'flash-down' : ''}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold tracking-tight text-slate-200">
                  {q.symbol}
                </span>
                <span className="text-[8px] text-slate-400 font-sans">{q.exchange}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold">
                <span className="text-slate-100 font-bold">
                  {q.ltp > 0
                    ? `₹${q.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : 'Live...'}
                </span>
                {q.ltp > 0 && (
                  <span
                    className={`flex items-center text-[10px] font-medium ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {q.changePercent}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
