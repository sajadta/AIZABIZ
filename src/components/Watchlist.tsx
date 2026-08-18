import React, { useState } from 'react';
import { Search, TrendingUp, TrendingDown, Layers, ChevronRight, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { StockQuote, Language } from '../types';
import { translations } from '../translations';

interface WatchlistProps {
  quotes: StockQuote[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  language: Language;
  onOpenOrderModal: (type: 'BUY' | 'SELL', symbol: string, price: number) => void;
}

export const Watchlist: React.FC<WatchlistProps> = ({
  quotes,
  selectedSymbol,
  onSelectSymbol,
  language,
  onOpenOrderModal,
}) => {
  const t = translations[language];
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSegment, setFilterSegment] = useState<'ALL' | 'INDEX' | 'EQUITY'>('ALL');

  const filteredQuotes = quotes.filter((q) => {
    const matchesSearch = q.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSegment = filterSegment === 'ALL' || q.segment === filterSegment;
    return matchesSearch && matchesSegment;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header & Search */}
      <div className="pb-3 border-b border-[#1d2335]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-white tracking-wider uppercase">
              {t.watchlist} <span className="text-slate-400 font-mono-num font-semibold">({filteredQuotes.length})</span>
            </h3>
          </div>
          <span className="text-[10px] font-mono-num font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30 shadow-sm flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE TICK
          </span>
        </div>

        {/* Search input */}
        <div className="relative mb-2.5">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={language === 'ml' ? 'ഓഹരികൾ തിരയുക (Search)...' : 'Search symbol, index, stock...'}
            className="w-full bg-[#070a14]/90 border border-[#1d2335]/90 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition font-medium"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          {(['ALL', 'INDEX', 'EQUITY'] as const).map((seg) => (
            <button
              key={seg}
              onClick={() => setFilterSegment(seg)}
              className={`px-3 py-1 rounded-lg transition text-xs ${
                filterSegment === seg
                  ? 'bg-[#1d2335] text-emerald-400 font-extrabold border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              {seg === 'ALL' ? (language === 'ml' ? 'എല്ലാം' : 'All') : seg}
            </button>
          ))}
        </div>
      </div>

      {/* Quote List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 mt-1 pr-0.5">
        {filteredQuotes.map((q) => {
          const isSelected = q.symbol === selectedSymbol;
          const isPositive = q.change >= 0;
          const highLowRange = q.high - q.low || 1;
          const currentPos = ((q.ltp - q.low) / highLowRange) * 100;

          return (
            <div
              key={q.instrumentKey}
              onClick={() => onSelectSymbol(q.symbol)}
              className={`py-3 px-2.5 my-1 rounded-xl transition-all cursor-pointer group border ${
                isSelected
                  ? 'bg-gradient-to-r from-slate-850 to-slate-900 border-emerald-500/50 shadow-md shadow-emerald-950/30 ring-1 ring-emerald-500/20'
                  : 'bg-transparent border-transparent hover:bg-[#111624]/60 hover:border-[#1d2335]'
              } ${q.tickFlash === 'up' ? 'flash-up' : q.tickFlash === 'down' ? 'flash-down' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                
                {/* Left: Symbol & Exchange */}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs sm:text-sm font-black tracking-tight transition ${
                      isSelected ? 'text-emerald-400' : 'text-white group-hover:text-emerald-300'
                    }`}>
                      {q.symbol}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#1d2335]/80 text-slate-400 border border-slate-700/60">
                      {q.exchange}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate max-w-[130px] sm:max-w-[170px] mt-0.5">
                    {q.name}
                  </p>
                </div>

                {/* Right: LTP & % Change */}
                <div className="text-right font-mono-num">
                  <div className="text-xs sm:text-sm font-black text-white">
                    ₹{q.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div
                    className={`flex items-center justify-end text-[10px] font-extrabold mt-0.5 ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPositive ? (
                      <ArrowUpRight className="w-3 h-3 mr-0.5 inline" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 mr-0.5 inline" />
                    )}
                    {isPositive ? '+' : ''}
                    {q.change.toFixed(2)} ({q.changePercent}%)
                  </div>
                </div>
              </div>

              {/* Day High / Low mini range bar */}
              <div className="mt-2.5 flex items-center justify-between text-[9px] text-slate-500 font-mono-num">
                <span>L: ₹{q.low.toFixed(1)}</span>
                <div className="flex-1 mx-2 h-1.5 bg-slate-900 rounded-full overflow-hidden relative border border-[#1d2335]/60">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, Math.min(95, currentPos))}%` }}
                  />
                </div>
                <span>H: ₹{q.high.toFixed(1)}</span>
              </div>

              {/* Quick Action buttons on hover/select */}
              <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-[#1d2335]/40">
                <span className="text-[10px] text-slate-400 font-mono-num font-medium">
                  Vol: {(q.volume / 100000).toFixed(2)}L
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenOrderModal('BUY', q.symbol, q.ltp);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[10px] font-black transition border border-emerald-500/30 shadow-sm active:scale-95"
                  >
                    {t.quickBuy}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenOrderModal('SELL', q.symbol, q.ltp);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white text-[10px] font-black transition border border-rose-500/30 shadow-sm active:scale-95"
                  >
                    {t.quickSell}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
