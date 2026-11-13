import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Layers, RefreshCw, LineChart, Target, ArrowRight, ArrowLeft, MoveHorizontal } from 'lucide-react';
import { OptionChainData, Language, StockQuote } from '../types';

interface OptionChainViewProps {
  quotes?: StockQuote[];
  data: OptionChainData | null;
  loading: boolean;
  onRefresh: (expiry?: string) => void;
  language: Language;
  onSelectOptionTrade: (type: 'BUY' | 'SELL', optionSymbol: string, price: number, instrumentKey?: string, lotSize?: number) => void;
  onViewChart?: (symbol: string, instrumentKey: string) => void;
  selectedSymbol?: string;
  onSelectSymbol?: (symbol: string, instrumentKey?: string) => void;
}

const MAJOR_INDICES = [
  { symbol: 'NIFTY 50', key: 'NSE_INDEX|Nifty 50', name: 'NIFTY 50' },
  { symbol: 'BANKNIFTY', key: 'NSE_INDEX|Nifty Bank', name: 'BANKNIFTY' },
  { symbol: 'SENSEX', key: 'BSE_INDEX|SENSEX', name: 'SENSEX' },
  { symbol: 'FINNIFTY', key: 'NSE_INDEX|Nifty Fin Service', name: 'FINNIFTY' },
  { symbol: 'MIDCPNIFTY', key: 'NSE_INDEX|NIFTY MID SELECT', name: 'MIDCPNIFTY' },
  { symbol: 'BANKEX', key: 'BSE_INDEX|BANKEX', name: 'BANKEX' },
];

export const OptionChainView: React.FC<OptionChainViewProps> = ({
  data,
  loading,
  onRefresh,
  language,
  onSelectOptionTrade,
  onViewChart,
  quotes = [],
  selectedSymbol = 'NIFTY 50',
  onSelectSymbol,
}) => {
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [strikeRange, setStrikeRange] = useState<'ALL' | '10' | '5'>('10');
  const [scrollPosition, setScrollPosition] = useState<'LEFT' | 'CENTER' | 'RIGHT'>('CENTER');
  
  const atmRef = useRef<HTMLTableRowElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  const getLtp = (instrumentKey?: string, defaultLtp: number = 0) => {
    if (!instrumentKey) return defaultLtp;
    const q = quotes.find((item) => item.instrumentKey === instrumentKey);
    return q && q.ltp > 0 ? q.ltp : defaultLtp;
  };

  const formatCompactNumber = (val: number) => {
    const n = Number(val || 0);
    if (n >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`;
    if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return n.toString();
  };

  const strikes = data?.strikes || [];
  const underlyingLtp = data?.underlyingLTP || 0;

  const atmIndex = useMemo(() => {
    if (!strikes.length || underlyingLtp <= 0) return -1;
    let closestIdx = 0;
    let minDiff = Infinity;
    strikes.forEach((s, idx) => {
      const diff = Math.abs(s.strikePrice - underlyingLtp);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    return closestIdx;
  }, [strikes, underlyingLtp]);

  const displayedStrikes = useMemo(() => {
    if (!strikes.length) return [];
    if (strikeRange === 'ALL' || atmIndex === -1) return strikes;
    const count = strikeRange === '5' ? 5 : 10;
    const start = Math.max(0, atmIndex - count);
    const end = Math.min(strikes.length, atmIndex + count + 1);
    return strikes.slice(start, end);
  }, [strikes, strikeRange, atmIndex]);

  // Jump to ATM row vertically
  const handleJumpToAtm = () => {
    if (atmRef.current) {
      atmRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Smooth Horizontal Glides (Calls / Center / Puts)
  const glideToCalls = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      setScrollPosition('LEFT');
    }
  };

  const glideToCenter = () => {
    if (tableContainerRef.current) {
      const containerWidth = tableContainerRef.current.clientWidth;
      const targetLeft = Math.max(0, (700 - containerWidth) / 2);
      tableContainerRef.current.scrollTo({ left: targetLeft, behavior: 'smooth' });
      setScrollPosition('CENTER');
    }
  };

  const glideToPuts = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ left: 500, behavior: 'smooth' });
      setScrollPosition('RIGHT');
    }
  };

  // Auto-center horizontally on initial load so both Calls LTP, Strike, and Puts LTP are immediately visible
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tableContainerRef.current) {
        const containerWidth = tableContainerRef.current.clientWidth;
        if (containerWidth < 700) {
          const targetLeft = Math.max(0, (700 - containerWidth) / 2);
          tableContainerRef.current.scrollTo({ left: targetLeft, behavior: 'smooth' });
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [data?.underlyingSymbol, selectedSymbol]);

  // Track scroll position to update glide indicator
  const handleScroll = () => {
    if (!tableContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tableContainerRef.current;
    if (scrollLeft <= 50) {
      setScrollPosition('LEFT');
    } else if (scrollLeft >= scrollWidth - clientWidth - 50) {
      setScrollPosition('RIGHT');
    } else {
      setScrollPosition('CENTER');
    }
  };

  if (!data || (data as any).error) {
    return (
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-8 text-center flex flex-col items-center justify-center h-full">
        <Layers className="w-8 h-8 mx-auto mb-2 text-slate-600" />
        <p className="text-sm font-semibold text-rose-400 mb-2">
          {(data as any)?.error || (language === 'ml' ? 'ഓപ്ഷൻ ചെയിൻ ലഭ്യമായില്ല' : 'Option Chain Unavailable')}
        </p>
        <p className="text-xs text-slate-500 max-w-xs">
          {language === 'ml' ? 'Upstox API യുമായി കണക്ട് ചെയ്യുക.' : 'Please connect your Upstox API to view live option chain.'}
        </p>
        <button
          onClick={() => onRefresh(selectedExpiry || undefined)}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors"
        >
          <RefreshCw size={14} /> {language === 'ml' ? 'വീണ്ടും ശ്രമിക്കുക' : 'Retry'}
        </button>
      </div>
    );
  }

  const maxCallOI = Math.max(1, ...data.strikes.map((s) => s.callOI || 0));
  const maxPutOI = Math.max(1, ...data.strikes.map((s) => s.putOI || 0));

  return (
    <div className="flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden bg-[#070a12] rounded-xl border border-slate-800/80">
      {/* 1. QUICK INDEX SELECTOR RIBBON */}
      <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-slate-800 bg-[#090d18] overflow-x-auto scrollbar-none shrink-0">
        <span className="text-[10px] text-slate-400 font-bold shrink-0 uppercase tracking-wider flex items-center gap-1">
          <Layers className="w-3 h-3 text-cyan-400" />
          <span>{language === 'ml' ? 'സൂചിക:' : 'Index:'}</span>
        </span>
        {MAJOR_INDICES.map((idx) => {
          const normalizeSym = (s?: string) => {
            const str = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (str.includes('BANKNIFTY') || str.includes('NIFTYBANK')) return 'BANKNIFTY';
            if (str.includes('FINNIFTY') || str.includes('FINSERVICE')) return 'FINNIFTY';
            if (str.includes('MIDCP') || str.includes('MIDSELECT')) return 'MIDCPNIFTY';
            if (str.includes('BANKEX')) return 'BANKEX';
            if (str.includes('SENSEX')) return 'SENSEX';
            if (str.includes('NIFTY') || str.includes('NIFTY50')) return 'NIFTY 50';
            return str;
          };
          const activeNorm = normalizeSym(selectedSymbol || data.underlyingSymbol);
          const idxNorm = normalizeSym(idx.symbol);
          const isActive = activeNorm === idxNorm;
          return (
            <button
              key={idx.symbol}
              onClick={() => {
                if (onSelectSymbol) {
                  onSelectSymbol(idx.symbol, idx.key);
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black shrink-0 transition-all ${
                isActive
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950 font-black ring-1 ring-cyan-300'
                  : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              {idx.name}
            </button>
          );
        })}
      </div>

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
              PCR: <strong className={data.pcr > 1 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{data.pcr}</strong>
            </span>
            <span className="text-slate-600">•</span>
            <span>
              Max Pain: <strong className="text-amber-400 font-bold">₹{data.maxPain}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Jump to ATM button */}
            <button
              onClick={handleJumpToAtm}
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
                    strikeRange === rng ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
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
              onClick={glideToCalls}
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
              onClick={glideToCenter}
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
              onClick={glideToPuts}
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

      {/* 3. SINGLE UNIFIED FULL-COLUMN OPTION CHAIN TABLE (ZERO-JAM DUAL-AXIS SCROLL) */}
      <div
        ref={tableContainerRef}
        onScroll={handleScroll}
        className="flex-1 w-full max-w-full min-w-0 overflow-x-auto overflow-y-auto smooth-scroll overscroll-contain pb-36 sm:pb-8 select-none"
        style={{
          touchAction: 'pan-x pan-y',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <table className="w-full text-left border-collapse text-[11px] font-mono min-w-[700px]">
          {/* STICKY HEADER */}
          <thead className="bg-[#090d18] text-slate-400 sticky top-0 z-20 border-b border-slate-800 shadow-md">
            <tr>
              <th colSpan={4} className="text-center py-1.5 bg-emerald-950/30 text-emerald-400 font-extrabold border-r border-slate-800 tracking-wider">
                CALLS (CE)
              </th>
              <th className="text-center py-1.5 px-3 bg-[#0d1322] text-amber-300 font-black border-r border-slate-800 tracking-wider">
                STRIKE
              </th>
              <th colSpan={4} className="text-center py-1.5 bg-rose-950/30 text-rose-400 font-extrabold tracking-wider">
                PUTS (PE)
              </th>
            </tr>
            <tr className="border-b border-slate-800 text-[10px] text-slate-400 bg-[#070a12]">
              <th className="py-1.5 px-2 text-right whitespace-nowrap w-16">Vol</th>
              <th className="py-1.5 px-2 text-right whitespace-nowrap w-20">OI</th>
              <th className="py-1.5 px-2 text-right whitespace-nowrap w-14">IV</th>
              <th className="py-1.5 px-2.5 text-right border-r border-slate-800 text-emerald-400 font-black whitespace-nowrap w-24">Call LTP</th>
              <th className="py-1.5 px-3 text-center bg-[#0d1322] text-amber-300 border-r border-slate-800 font-black whitespace-nowrap w-20">Price</th>
              <th className="py-1.5 px-2.5 text-left text-rose-400 font-black whitespace-nowrap w-24">Put LTP</th>
              <th className="py-1.5 px-2 text-left whitespace-nowrap w-14">IV</th>
              <th className="py-1.5 px-2 text-left whitespace-nowrap w-20">OI</th>
              <th className="py-1.5 px-2 text-left whitespace-nowrap w-16">Vol</th>
            </tr>
          </thead>

          {/* TABLE BODY */}
          <tbody className="divide-y divide-slate-800/40">
            {displayedStrikes.map((s, i) => {
              const isATM = Math.abs(s.strikePrice - underlyingLtp) <= (selectedSymbol.includes('BANK') ? 100 : 50);
              const isITMCall = s.strikePrice < underlyingLtp;
              const isITMPut = s.strikePrice > underlyingLtp;
              const callOiPct = Math.min(100, Math.round(((s.callOI || 0) / maxCallOI) * 100));
              const putOiPct = Math.min(100, Math.round(((s.putOI || 0) / maxPutOI) * 100));
              const callLtp = Number(getLtp(s.callInstrumentKey, s.callLTP) || 0);
              const putLtp = Number(getLtp(s.putInstrumentKey, s.putLTP) || 0);

              return (
                <tr
                  key={s.strikePrice + '-' + i}
                  ref={isATM ? atmRef : null}
                  className={`transition hover:bg-slate-850/90 ${
                    isATM ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/30' : ''
                  }`}
                >
                  {/* 1. CALL VOLUME */}
                  <td className={`py-1.5 px-2 text-right text-slate-400 whitespace-nowrap overflow-hidden ${isITMCall ? 'bg-emerald-950/10' : ''}`}>
                    {formatCompactNumber(s.callVolume || 0)}
                  </td>

                  {/* 2. CALL OI (With Visual Depth Bar) */}
                  <td className={`py-1.5 px-2 text-right text-slate-300 relative overflow-hidden whitespace-nowrap min-w-[68px] max-w-[88px] ${isITMCall ? 'bg-emerald-950/10' : ''}`}>
                    <div
                      className="absolute inset-y-1 right-1 bg-emerald-500/15 rounded-sm pointer-events-none"
                      style={{ width: `${Math.min(90, Math.max(4, callOiPct * 0.7))}%` }}
                    />
                    <span className="relative z-10 block truncate font-semibold">{formatCompactNumber(s.callOI || 0)}</span>
                  </td>

                  {/* 3. CALL IV */}
                  <td className={`py-1.5 px-2 text-right text-slate-400 whitespace-nowrap ${isITMCall ? 'bg-emerald-950/10' : ''}`}>
                    {Number(s.callIV || 0).toFixed(1)}%
                  </td>

                  {/* 4. CALL LTP & 1-TAP BUY */}
                  <td className={`py-1.5 px-2.5 text-right font-bold text-emerald-400 border-r border-slate-800 whitespace-nowrap ${isITMCall ? 'bg-emerald-950/15' : ''}`}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onSelectOptionTrade(
                            'BUY',
                            `${data.underlyingSymbol} ${s.strikePrice} CE`,
                            callLtp,
                            s.callInstrumentKey,
                            s.lotSize || data.lotSize
                          )
                        }
                        className="px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-300 font-extrabold transition active:scale-95 shadow-sm"
                        title="Click to Buy Call (CE)"
                      >
                        ₹{callLtp.toFixed(1)}
                      </button>
                      {onViewChart && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewChart(`${data.underlyingSymbol} ${s.strikePrice} CE`, s.callInstrumentKey || '');
                          }}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition"
                          title="View Call Chart"
                        >
                          <LineChart className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* 5. STRIKE PRICE (Center Anchor) */}
                  <td
                    className={`py-1.5 px-3 text-center font-black border-r border-slate-800 whitespace-nowrap ${
                      isATM ? 'bg-amber-500/25 text-amber-300' : 'bg-[#0d1322] text-white'
                    }`}
                  >
                    <span className="text-xs">{s.strikePrice}</span>
                    {isATM && (
                      <span className="block text-[7px] text-amber-400 font-black uppercase">ATM</span>
                    )}
                  </td>

                  {/* 6. PUT LTP & 1-TAP BUY */}
                  <td className={`py-1.5 px-2.5 text-left font-bold text-rose-400 whitespace-nowrap ${isITMPut ? 'bg-rose-950/15' : ''}`}>
                    <div className="flex items-center justify-start gap-1.5">
                      {onViewChart && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewChart(`${data.underlyingSymbol} ${s.strikePrice} PE`, s.putInstrumentKey || '');
                          }}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                          title="View Put Chart"
                        >
                          <LineChart className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onSelectOptionTrade(
                            'BUY',
                            `${data.underlyingSymbol} ${s.strikePrice} PE`,
                            putLtp,
                            s.putInstrumentKey,
                            s.lotSize || data.lotSize
                          )
                        }
                        className="px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/25 text-rose-300 font-extrabold transition active:scale-95 shadow-sm"
                        title="Click to Buy Put (PE)"
                      >
                        ₹{putLtp.toFixed(1)}
                      </button>
                    </div>
                  </td>

                  {/* 7. PUT IV */}
                  <td className={`py-1.5 px-2 text-left text-slate-400 whitespace-nowrap ${isITMPut ? 'bg-rose-950/10' : ''}`}>
                    {Number(s.putIV || 0).toFixed(1)}%
                  </td>

                  {/* 8. PUT OI (With Visual Depth Bar) */}
                  <td className={`py-1.5 px-2 text-left text-slate-300 relative overflow-hidden whitespace-nowrap min-w-[68px] max-w-[88px] ${isITMPut ? 'bg-rose-950/10' : ''}`}>
                    <div
                      className="absolute inset-y-1 left-1 bg-rose-500/15 rounded-sm pointer-events-none"
                      style={{ width: `${Math.min(90, Math.max(4, putOiPct * 0.7))}%` }}
                    />
                    <span className="relative z-10 block truncate font-semibold">{formatCompactNumber(s.putOI || 0)}</span>
                  </td>

                  {/* 9. PUT VOLUME */}
                  <td className={`py-1.5 px-2 text-left text-slate-400 whitespace-nowrap overflow-hidden ${isITMPut ? 'bg-rose-950/10' : ''}`}>
                    {formatCompactNumber(s.putVolume || 0)}
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
