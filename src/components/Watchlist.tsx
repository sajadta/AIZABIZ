import React, { useState } from 'react';
import { Search, TrendingUp, TrendingDown, Layers, ChevronRight, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { StockQuote, Language } from '../types';
import { translations } from '../translations';

interface WatchlistProps {
  quotes: StockQuote[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string, instrumentKey?: string) => void;
  language: Language;
  onOpenOrderModal: (type: 'BUY' | 'SELL', symbol: string, price: number) => void;
  priceAlerts?: PriceAlert[];
  onAddAlert?: (symbol: string, instrumentKey: string, targetPrice: number, condition: 'GREATER_THAN'|'LESS_THAN') => void;
  onRemoveAlert?: (id: string) => void;
}

export const Watchlist: React.FC<WatchlistProps> = ({
  quotes,
  selectedSymbol,
  onSelectSymbol,
  language,
  onOpenOrderModal,
  priceAlerts = [],
  onAddAlert,
  onRemoveAlert
}) => {
  const t = translations[language];
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSegment, setFilterSegment] = useState<'ALL' | 'INDEX' | 'EQUITY'>('ALL');
  const [alertTargetSymbol, setAlertTargetSymbol] = useState<string | null>(null);
  const [alertPrice, setAlertPrice] = useState<string>('');

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
          {(['ALL', 'INDEX', 'EQUITY', 'GLOBAL'] as const).map((seg) => (
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
              key={q.instrumentKey || q.symbol}
              onClick={() => onSelectSymbol(q.symbol, q.instrumentKey)}
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
                    {Number(q.change || 0).toFixed(2)} ({q.changePercent}%)
                  </div>
                </div>
              </div>

              {/* Day High / Low mini range bar */}
              <div className="mt-2.5 flex items-center justify-between text-[9px] text-slate-500 font-mono-num">
                <span>L: ₹{Number(q.low || 0).toFixed(1)}</span>
                <div className="flex-1 mx-2 h-1.5 bg-slate-900 rounded-full overflow-hidden relative border border-[#1d2335]/60">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, Math.min(95, currentPos))}%` }}
                  />
                </div>
                <span>H: ₹{Number(q.high || 0).toFixed(1)}</span>
              </div>

              {/* Active Alerts for this symbol */}
              {priceAlerts.filter(a => a.symbol === q.symbol && a.isActive).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {priceAlerts.filter(a => a.symbol === q.symbol && a.isActive).map(alert => (
                    <span key={alert.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-[9px] text-blue-300 font-mono-num font-bold">
                      <BellRing className="w-2.5 h-2.5" />
                      {alert.condition === 'GREATER_THAN' ? '≥' : '≤'} ₹{alert.targetPrice.toFixed(2)}
                      <button onClick={(e) => { e.stopPropagation(); onRemoveAlert?.(alert.id); }} className="hover:text-rose-400 ml-0.5">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              {/* Quick Action buttons on hover/select */}
              <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-[#1d2335]/40">
                <div className="flex flex-col gap-1 w-1/3">
                  <span className="text-[10px] text-slate-400 font-mono-num font-medium">
                    Vol: {Number((q.volume || 0) / 100000).toFixed(2)}L
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-1 justify-end">
                  {alertTargetSymbol === q.symbol ? (
                     <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          autoFocus
                          value={alertPrice}
                          onChange={(e) => setAlertPrice(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Target ₹"
                          className="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-white"
                        />
                        <button 
                          onClick={(e) => {
                             e.stopPropagation();
                             if (onAddAlert && alertPrice) {
                               onAddAlert(q.symbol, q.instrumentKey, Number(alertPrice), Number(alertPrice) > q.ltp ? 'GREATER_THAN' : 'LESS_THAN');
                             }
                             setAlertTargetSymbol(null);
                          }}
                          className="px-1.5 py-0.5 rounded bg-blue-500 hover:bg-blue-600 text-white text-[9px] font-bold"
                        >OK</button>
                        <button onClick={(e) => { e.stopPropagation(); setAlertTargetSymbol(null); }} className="text-slate-500 hover:text-white"><X className="w-3 h-3"/></button>
                     </div>
                  ) : (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setAlertTargetSymbol(q.symbol); 
                        setAlertPrice(q.ltp.toFixed(2));
                      }}
                      className="px-1.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition"
                      title="Set Alert"
                    >
                      <Bell className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {q.segment === 'INDEX' ? (
                   <span className="text-[10px] text-slate-500 italic mr-2">{language === 'ml' ? 'ഓപ്ഷൻ ചെയിൻ ഉപയോഗിക്കുക' : 'Trade via Options'}</span>
                  ) : (
                  <>
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
                  </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
