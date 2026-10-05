import React, { useState } from 'react';
import { Layers, Activity, TrendingUp, TrendingDown, RefreshCw, LineChart } from 'lucide-react';
import { OptionChainData, Language, StockQuote } from '../types';
import { translations } from '../translations';

interface OptionChainViewProps {
  quotes?: StockQuote[];
  data: OptionChainData | null;
  loading: boolean;
  onRefresh: (expiry?: string) => void;
  language: Language;
  onSelectOptionTrade: (type: 'BUY' | 'SELL', optionSymbol: string, price: number, instrumentKey?: string, lotSize?: number) => void;
  onViewChart?: (symbol: string, instrumentKey: string) => void;
}

export const OptionChainView: React.FC<OptionChainViewProps> = ({
  data,
  loading,
  onRefresh,
  language,
  onSelectOptionTrade,
  onViewChart,
  quotes = [],
}) => {
  const t = translations[language];
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  
  const getLtp = (instrumentKey?: string, defaultLtp: number = 0) => {
      if (!instrumentKey) return defaultLtp;
      const q = quotes.find(q => q.instrumentKey === instrumentKey);
      return q ? q.ltp : defaultLtp;
  };

  if (!data || (data as any).error) {
    return (
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-8 text-center flex flex-col items-center justify-center h-full">
        <Layers className="w-8 h-8 mx-auto mb-2 text-slate-600" />
        <p className="text-sm font-semibold text-rose-400 mb-2">{(data as any)?.error || (language === 'ml' ? 'ഓപ്ഷൻ ചെയിൻ ലഭ്യമായില്ല' : 'Option Chain Unavailable')}</p>
        <p className="text-xs text-slate-500 max-w-xs">{language === 'ml' ? 'Upstox API യുമായി കണക്ട് ചെയ്യുക.' : 'Please connect your Upstox API to view live option chain.'}</p>
        <button onClick={() => onRefresh(selectedExpiry || undefined)} className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors">
           <RefreshCw size={14} /> {language === 'ml' ? 'വീണ്ടും ശ്രമിക്കുക' : 'Retry'}
        </button>
      </div>
    );
  }

  const maxCallOI = Math.max(1, ...data.strikes.map(s => s.callOI || 0));
  const maxPutOI = Math.max(1, ...data.strikes.map(s => s.putOI || 0));

  return (
    <div className="flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden bg-[#070a12] rounded-xl border border-slate-800/80 p-2 sm:p-3">
      {/* Header */}
      <div className="pb-2.5 border-b border-slate-800 flex items-center justify-between gap-1.5 flex-wrap w-full max-w-full min-w-0">
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="p-1 sm:p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <h3 className="text-xs sm:text-sm font-black text-white tracking-tight uppercase">
              {t.optionChain} - {data.underlyingSymbol}
            </h3>
            <span className="text-[11px] sm:text-xs font-mono-num font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              ₹{Number(data.underlyingLTP || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-[10px] sm:text-[11px] font-mono-num text-slate-400 mt-1 flex-wrap">
            <span>PCR: <strong className={data.pcr > 1 ? 'text-emerald-400' : 'text-rose-400'}>{data.pcr}</strong></span>
            <span>Max Pain: <strong className="text-amber-400">₹{data.maxPain}</strong></span>
            {data.lotSize && data.lotSize > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-bold">
                1 Lot = {data.lotSize} Qty (Upstox Live)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Expiry Selector */}
          <select
            value={selectedExpiry || data.selectedExpiry}
            onChange={(e) => {
              const nextExp = e.target.value;
              setSelectedExpiry(nextExp);
              onRefresh(nextExp);
            }}
            className="bg-slate-900 border border-slate-700/80 rounded-xl px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs text-white font-mono-num font-bold focus:outline-none focus:border-emerald-500 shadow-inner"
          >
            {data.expiryDates.map((exp) => (
              <option key={exp} value={exp}>
                Exp: {exp}
              </option>
            ))}
          </select>

          <button
            onClick={() => onRefresh(selectedExpiry || data.selectedExpiry)}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 transition shadow-inner shrink-0"
            title="Refresh Live Option Chain"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Option Chain Table */}
      <div className="flex-1 w-full max-w-full min-w-0 overflow-x-auto overflow-y-auto smooth-scroll webkit-scrollbar pb-20 sm:pb-4">
        <table className="w-full text-left border-collapse text-[11px] font-mono-num min-w-[600px]">
          <thead className="bg-[#090d18] text-slate-400 sticky top-0 z-10 border-b border-slate-800 shadow-sm">
            <tr>
              <th colSpan={4} className="text-center py-1.5 bg-emerald-950/30 text-emerald-400 font-extrabold border-r border-slate-800 tracking-wider">
                CALLS (CE)
              </th>
              <th className="text-center py-1.5 px-3 bg-slate-900 text-amber-300 font-extrabold border-r border-slate-800 tracking-wider">
                STRIKE
              </th>
              <th colSpan={4} className="text-center py-1.5 bg-rose-950/30 text-rose-400 font-extrabold tracking-wider">
                PUTS (PE)
              </th>
            </tr>
            <tr className="border-b border-slate-800 text-[10px] text-slate-400 bg-[#070a12]">
              <th className="py-1.5 px-2 text-right">Vol (k)</th>
              <th className="py-1.5 px-2 text-right">OI (k)</th>
              <th className="py-1.5 px-2 text-right">IV</th>
              <th className="py-1.5 px-2.5 text-right border-r border-slate-800 text-emerald-400 font-bold">Call LTP</th>
              <th className="py-1.5 px-3 text-center bg-slate-900/90 text-slate-200 border-r border-slate-800 font-bold">Price</th>
              <th className="py-1.5 px-2.5 text-left text-rose-400 font-bold">Put LTP</th>
              <th className="py-1.5 px-2 text-left">IV</th>
              <th className="py-1.5 px-2 text-left">OI (k)</th>
              <th className="py-1.5 px-2 text-left">Vol (k)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {data.strikes.map((s, i) => {
              const isATM = Math.abs(s.strikePrice - data.underlyingLTP) <= 50;
              const isITMCall = s.strikePrice < data.underlyingLTP;
              const isITMPut = s.strikePrice > data.underlyingLTP;
              const callOiPct = Math.min(100, Math.round(((s.callOI || 0) / maxCallOI) * 100));
              const putOiPct = Math.min(100, Math.round(((s.putOI || 0) / maxPutOI) * 100));

              return (
                <tr
                  key={s.strikePrice + "-" + i}
                  className={`transition hover:bg-slate-850/90 ${
                    isATM ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/30' : ''
                  }`}
                >
                  {/* CALLS */}
                  <td className={`py-1.5 px-2 text-right text-slate-400 ${isITMCall ? 'bg-emerald-950/10' : ''}`}>
                    {((s.callVolume || 0) / 1000).toFixed(0)}
                  </td>
                  <td className={`py-1.5 px-2 text-right text-slate-300 relative ${isITMCall ? 'bg-emerald-950/10' : ''}`}>
                    <div
                      className="absolute inset-y-1 right-1 bg-emerald-500/15 rounded-sm pointer-events-none"
                      style={{ width: `${Math.max(4, callOiPct * 0.75)}%` }}
                    />
                    <span className="relative z-10">{((s.callOI || 0) / 1000).toFixed(0)}</span>
                  </td>
                  <td className={`py-1.5 px-2 text-right text-slate-400 ${isITMCall ? 'bg-emerald-950/10' : ''}`}>
                    {Number(s.callIV || 0).toFixed(1)}%
                  </td>
                  <td className={`py-1.5 px-2.5 text-right font-bold text-emerald-400 border-r border-slate-800 ${isITMCall ? 'bg-emerald-950/15' : ''}`}>
                    <div className="flex items-center justify-end gap-2">
                       <button
                         type="button"
                         onClick={() => onSelectOptionTrade('BUY', `${data.underlyingSymbol} ${s.strikePrice} CE`, getLtp(s.callInstrumentKey, s.callLTP), s.callInstrumentKey, s.lotSize || data.lotSize)}
                         className="px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-300 font-extrabold transition"
                         title="Click to Buy Call (CE)"
                       >
                         ₹{Number(getLtp(s.callInstrumentKey, s.callLTP) || 0).toFixed(1)}
                       </button>
                       {onViewChart && (
                         <button
                           type="button"
                           onClick={(e) => { e.stopPropagation(); onViewChart(`${data.underlyingSymbol} ${s.strikePrice} CE`, s.callInstrumentKey || ''); }}
                           className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition"
                           title="View Call Chart"
                         >
                           <LineChart className="w-3.5 h-3.5" />
                         </button>
                       )}
                    </div>
                  </td>

                  {/* STRIKE */}
                  <td className={`py-1.5 px-3 text-center font-extrabold border-r border-slate-800 ${
                    isATM ? 'bg-amber-500/20 text-amber-300 font-black' : 'bg-slate-900/90 text-white'
                  }`}>
                    {s.strikePrice}
                  </td>

                  {/* PUTS */}
                  <td className={`py-1.5 px-2.5 text-left font-bold text-rose-400 ${isITMPut ? 'bg-rose-950/15' : ''}`}>
                    <div className="flex items-center justify-start gap-2">
                       {onViewChart && (
                         <button
                           type="button"
                           onClick={(e) => { e.stopPropagation(); onViewChart(`${data.underlyingSymbol} ${s.strikePrice} PE`, s.putInstrumentKey || ''); }}
                           className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                           title="View Put Chart"
                         >
                           <LineChart className="w-3.5 h-3.5" />
                         </button>
                       )}
                       <button
                         type="button"
                         onClick={() => onSelectOptionTrade('BUY', `${data.underlyingSymbol} ${s.strikePrice} PE`, getLtp(s.putInstrumentKey, s.putLTP), s.putInstrumentKey, s.lotSize || data.lotSize)}
                         className="px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/25 text-rose-300 font-extrabold transition"
                         title="Click to Buy Put (PE)"
                       >
                         ₹{Number(getLtp(s.putInstrumentKey, s.putLTP) || 0).toFixed(1)}
                       </button>
                    </div>
                  </td>
                  <td className={`py-1.5 px-2 text-left text-slate-400 ${isITMPut ? 'bg-rose-950/10' : ''}`}>
                    {Number(s.putIV || 0).toFixed(1)}%
                  </td>
                  <td className={`py-1.5 px-2 text-left text-slate-300 relative ${isITMPut ? 'bg-rose-950/10' : ''}`}>
                    <div
                      className="absolute inset-y-1 left-1 bg-rose-500/15 rounded-sm pointer-events-none"
                      style={{ width: `${Math.max(4, putOiPct * 0.75)}%` }}
                    />
                    <span className="relative z-10">{((s.putOI || 0) / 1000).toFixed(0)}</span>
                  </td>
                  <td className={`py-1.5 px-2 text-left text-slate-400 ${isITMPut ? 'bg-rose-950/10' : ''}`}>
                    {((s.putVolume || 0) / 1000).toFixed(0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
