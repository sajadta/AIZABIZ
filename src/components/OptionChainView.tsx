import React, { useState } from 'react';
import { Layers, Activity, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { OptionChainData, Language } from '../types';
import { translations } from '../translations';

interface OptionChainViewProps {
  data: OptionChainData | null;
  loading: boolean;
  onRefresh: () => void;
  language: Language;
  onSelectOptionTrade: (type: 'BUY' | 'SELL', optionSymbol: string, price: number) => void;
}

export const OptionChainView: React.FC<OptionChainViewProps> = ({
  data,
  loading,
  onRefresh,
  language,
  onSelectOptionTrade,
}) => {
  const t = translations[language];
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');

  if (!data) {
    return (
      <div className="bg-[#0b0f19] rounded-2xl border border-slate-800 p-8 text-center text-slate-500">
        <Layers className="w-8 h-8 mx-auto mb-2 text-slate-600 animate-pulse" />
        <p className="text-xs font-semibold">{language === 'ml' ? 'ഓപ്ഷൻ ചെയിൻ വിവരങ്ങൾ ലോഡ് ചെയ്യുന്നു...' : 'Loading real-time Option Chain data...'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="pb-3 border-b border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-xs sm:text-sm font-black text-white tracking-tight uppercase">
              {t.optionChain} - {data.underlyingSymbol}
            </h3>
            <span className="text-xs font-mono-num font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              ₹{Number(data.underlyingLTP || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono-num text-slate-400 mt-1">
            <span>PCR: <strong className={data.pcr > 1 ? 'text-emerald-400' : 'text-rose-400'}>{data.pcr}</strong></span>
            <span>Max Pain: <strong className="text-amber-400">₹{data.maxPain}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Expiry Selector */}
          <select
            value={selectedExpiry || data.selectedExpiry}
            onChange={(e) => setSelectedExpiry(e.target.value)}
            className="bg-[#070a14] border border-slate-800 rounded-xl px-3 py-1 text-xs text-white font-mono-num font-bold focus:outline-none focus:border-indigo-500 shadow-inner"
          >
            {data.expiryDates.map((exp) => (
              <option key={exp} value={exp}>
                Exp: {exp}
              </option>
            ))}
          </select>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-xl bg-[#070a14] hover:bg-slate-800 border border-slate-800 text-slate-300 transition shadow-inner"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Option Chain Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-[11px] font-mono">
          <thead className="bg-[#070a12] text-slate-400 sticky top-0 z-10 border-b border-slate-800">
            <tr>
              <th colSpan={3} className="text-center py-1.5 bg-emerald-950/20 text-emerald-400 font-bold border-r border-slate-800">
                CALLS (CE)
              </th>
              <th className="text-center py-1.5 px-3 bg-slate-900 text-amber-300 font-extrabold border-r border-slate-800">
                STRIKE
              </th>
              <th colSpan={3} className="text-center py-1.5 bg-rose-950/20 text-rose-400 font-bold">
                PUTS (PE)
              </th>
            </tr>
            <tr className="border-b border-slate-800 text-[10px] text-slate-500">
              <th className="py-1 px-2 text-right">OI (k)</th>
              <th className="py-1 px-2 text-right">IV</th>
              <th className="py-1 px-2 text-right border-r border-slate-800 text-emerald-400 font-bold">LTP</th>
              <th className="py-1 px-2 text-center bg-slate-900 text-slate-300 border-r border-slate-800">Price</th>
              <th className="py-1 px-2 text-left text-rose-400 font-bold">LTP</th>
              <th className="py-1 px-2 text-left">IV</th>
              <th className="py-1 px-2 text-left">OI (k)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {data.strikes.map((s, i) => {
              const isATM = Math.abs(s.strikePrice - data.underlyingLTP) <= 50;
              const isITMCall = s.strikePrice < data.underlyingLTP;
              const isITMPut = s.strikePrice > data.underlyingLTP;

              return (
                <tr
                  key={s.strikePrice + "-" + i}
                  className={`transition hover:bg-slate-850 ${
                    isATM ? 'bg-amber-500/10' : ''
                  }`}
                >
                  {/* CALLS */}
                  <td className={`py-1.5 px-2 text-right text-slate-400 ${isITMCall ? 'bg-emerald-950/10' : ''}`}>
                    {((s.callOI || 0) / 1000).toFixed(0)}
                  </td>
                  <td className={`py-1.5 px-2 text-right text-slate-500 ${isITMCall ? 'bg-emerald-950/10' : ''}`}>
                    {s.callIV}%
                  </td>
                  <td className={`py-1.5 px-2 text-right font-bold text-emerald-400 border-r border-slate-800 cursor-pointer hover:underline ${isITMCall ? 'bg-emerald-950/15' : ''}`}
                    onClick={() => onSelectOptionTrade('BUY', `${data.underlyingSymbol} ${s.strikePrice} CE`, s.callLTP)}
                  >
                    ₹{Number(s.callLTP || 0).toFixed(1)}
                  </td>

                  {/* STRIKE */}
                  <td className={`py-1.5 px-2 text-center font-extrabold border-r border-slate-800 ${
                    isATM ? 'bg-amber-500/20 text-amber-300 font-black' : 'bg-slate-900 text-white'
                  }`}>
                    {s.strikePrice}
                  </td>

                  {/* PUTS */}
                  <td className={`py-1.5 px-2 text-left font-bold text-rose-400 cursor-pointer hover:underline ${isITMPut ? 'bg-rose-950/15' : ''}`}
                    onClick={() => onSelectOptionTrade('BUY', `${data.underlyingSymbol} ${s.strikePrice} PE`, s.putLTP)}
                  >
                    ₹{Number(s.putLTP || 0).toFixed(1)}
                  </td>
                  <td className={`py-1.5 px-2 text-left text-slate-500 ${isITMPut ? 'bg-rose-950/10' : ''}`}>
                    {s.putIV}%
                  </td>
                  <td className={`py-1.5 px-2 text-left text-slate-400 ${isITMPut ? 'bg-rose-950/10' : ''}`}>
                    {((s.putOI || 0) / 1000).toFixed(0)}
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
