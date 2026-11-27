// Symbol/expiry controls, PCR metrics and horizontal glide controls.
import React from 'react';
import { ArrowLeft, ArrowRight, MoveHorizontal, RefreshCw, Target } from 'lucide-react';
import type { OptionChainData, Language } from '../../types';

export type StrikeRange = 'ALL' | '10' | '5';
export type ScrollPosition = 'LEFT' | 'CENTER' | 'RIGHT';

interface OptionChainHeaderProps {
  data: OptionChainData;
  language: Language;
  loading: boolean;
  selectedExpiry: string;
  setSelectedExpiry: (expiry: string) => void;
  onRefresh: (expiry?: string) => void;
  strikeRange: StrikeRange;
  setStrikeRange: (range: StrikeRange) => void;
  onJumpToAtm: () => void;
  scrollPosition: ScrollPosition;
  onGlide: (position: ScrollPosition) => void;
}

export const OptionChainHeader: React.FC<OptionChainHeaderProps> = ({
  data,
  language,
  loading,
  selectedExpiry,
  setSelectedExpiry,
  onRefresh,
  strikeRange,
  setStrikeRange,
  onJumpToAtm,
  scrollPosition,
  onGlide,
}) => (
  <>
    {/* 2. STATS & CONTROLS HEADER */}
    <div className="p-2 sm:p-3 border-b border-slate-800/80 bg-[#080c16] shrink-0 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Symbol, Spot LTP & Lot Size */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-black text-white tracking-tight uppercase">
            {data.underlyingSymbol}
          </span>
          <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            ₹{Number(data.underlyingLTP || 0).toFixed(2)}
          </span>
          {data.lotSize && data.lotSize > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono font-bold">
              1 Lot = {data.lotSize}
            </span>
          )}
        </div>

        {/* Expiry Selector & Refresh */}
        <div className="flex items-center gap-1.5">
          <select
            value={selectedExpiry || data.selectedExpiry}
            onChange={(e) => {
              const nextExp = e.target.value;
              setSelectedExpiry(nextExp);
              onRefresh(nextExp);
            }}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-[10px] sm:text-[11px] text-white font-mono font-bold focus:outline-none focus:border-cyan-500 shadow-inner"
          >
            {data.expiryDates.map((exp) => (
              <option key={exp} value={exp}>
                {exp}
              </option>
            ))}
          </select>

          <button
            onClick={() => onRefresh(selectedExpiry || data.selectedExpiry)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 transition shrink-0"
            title="Refresh Live Option Chain"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* PCR, Max Pain & Quick ATM Jump & Range Filters */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] font-mono text-slate-400 pt-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span>
            PCR:{' '}
            <strong
              className={data.pcr > 1 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}
            >
              {data.pcr}
            </strong>
          </span>
          <span className="text-slate-600">•</span>
          <span>
            Max Pain: <strong className="text-amber-400 font-bold">₹{data.maxPain}</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Jump to ATM button */}
          <button
            onClick={onJumpToAtm}
            className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1 text-[9px] transition active:scale-95"
          >
            <Target className="w-2.5 h-2.5 text-amber-400" />
            <span>{language === 'ml' ? '🎯 ATM സ്ട്രൈക്ക്' : '🎯 Jump to ATM'}</span>
          </button>

          {/* Range Pills */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800 text-[9px]">
            {(['5', '10', 'ALL'] as const).map((rng) => (
              <button
                key={rng}
                onClick={() => setStrikeRange(rng)}
                className={`px-1.5 py-0.5 rounded font-bold transition ${
                  strikeRange === rng
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {rng === 'ALL' ? (language === 'ml' ? 'എല്ലാം' : 'All') : `±${rng}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2.1 HORIZONTAL GLIDE MASTER BAR (Left-Right Scrolling Controller) */}
      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-800/60 text-[10px]">
        <div className="flex items-center gap-1 text-slate-400 font-bold">
          <MoveHorizontal className="w-3 h-3 text-cyan-400" />
          <span className="text-[9px] text-slate-400 hidden xs:inline">
            {language === 'ml' ? 'സ്ക്രോൾ ഗ്ലൈഡ്:' : 'Glide View:'}
          </span>
        </div>

        {/* Tactile Glide Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onGlide('LEFT')}
            className={`px-2.5 py-0.5 rounded-lg font-black text-[10px] flex items-center gap-1 transition active:scale-95 border ${
              scrollPosition === 'LEFT'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/30'
            }`}
            title="View Calls (CE) Columns"
          >
            <ArrowLeft className="w-2.5 h-2.5" />
            <span>{language === 'ml' ? 'കാൾ (CE)' : 'Calls'}</span>
          </button>

          <button
            type="button"
            onClick={() => onGlide('CENTER')}
            className={`px-2.5 py-0.5 rounded-lg font-black text-[10px] flex items-center gap-1 transition active:scale-95 border ${
              scrollPosition === 'CENTER'
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-500/30'
            }`}
            title="Center on Strike Price"
          >
            <Target className="w-2.5 h-2.5" />
            <span>{language === 'ml' ? 'സ്ട്രൈക്ക് (Center)' : 'Strike'}</span>
          </button>

          <button
            type="button"
            onClick={() => onGlide('RIGHT')}
            className={`px-2.5 py-0.5 rounded-lg font-black text-[10px] flex items-center gap-1 transition active:scale-95 border ${
              scrollPosition === 'RIGHT'
                ? 'bg-rose-500 text-white border-rose-400 shadow-sm'
                : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-500/30'
            }`}
            title="View Puts (PE) Columns"
          >
            <span>{language === 'ml' ? 'പുട്ട് (PE)' : 'Puts'}</span>
            <ArrowRight className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </div>
  </>
);
