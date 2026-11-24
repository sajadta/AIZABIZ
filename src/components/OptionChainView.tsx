import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import type { OptionChainData, Language, StockQuote } from '../types';
import { IndexSelectorRibbon } from './optionchain/IndexSelectorRibbon';
import { OptionChainHeader } from './optionchain/OptionChainHeader';
import { OptionChainTable } from './optionchain/OptionChainTable';

interface OptionChainViewProps {
  quotes?: StockQuote[];
  data: OptionChainData | null;
  loading: boolean;
  onRefresh: (expiry?: string) => void;
  language: Language;
  onSelectOptionTrade: (
    type: 'BUY' | 'SELL',
    optionSymbol: string,
    price: number,
    instrumentKey?: string,
    lotSize?: number,
  ) => void;
  onViewChart?: (symbol: string, instrumentKey: string) => void;
  selectedSymbol?: string;
  onSelectSymbol?: (symbol: string, instrumentKey?: string) => void;
}

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
  const handleGlide = (position: 'LEFT' | 'CENTER' | 'RIGHT') => {
    const container = tableContainerRef.current;
    if (!container) return;
    if (position === 'LEFT') container.scrollTo({ left: 0, behavior: 'smooth' });
    else if (position === 'RIGHT') container.scrollTo({ left: 500, behavior: 'smooth' });
    else
      container.scrollTo({
        left: Math.max(0, (700 - container.clientWidth) / 2),
        behavior: 'smooth',
      });
    setScrollPosition(position);
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
          {(data as any)?.error ||
            (language === 'ml' ? 'ഓപ്ഷൻ ചെയിൻ ലഭ്യമായില്ല' : 'Option Chain Unavailable')}
        </p>
        <p className="text-xs text-slate-500 max-w-xs">
          {language === 'ml'
            ? 'Upstox API യുമായി കണക്ട് ചെയ്യുക.'
            : 'Please connect your Upstox API to view live option chain.'}
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
      <IndexSelectorRibbon
        language={language}
        selectedSymbol={selectedSymbol}
        underlyingSymbol={data.underlyingSymbol}
        onSelectSymbol={onSelectSymbol}
      />

      <OptionChainHeader
        data={data}
        language={language}
        loading={loading}
        selectedExpiry={selectedExpiry}
        setSelectedExpiry={setSelectedExpiry}
        onRefresh={onRefresh}
        strikeRange={strikeRange}
        setStrikeRange={setStrikeRange}
        onJumpToAtm={handleJumpToAtm}
        scrollPosition={scrollPosition}
        onGlide={handleGlide}
      />

      <OptionChainTable
        data={data}
        strikes={displayedStrikes}
        underlyingLtp={underlyingLtp}
        selectedSymbol={selectedSymbol}
        maxCallOI={maxCallOI}
        maxPutOI={maxPutOI}
        getLtp={getLtp}
        atmRef={atmRef}
        tableContainerRef={tableContainerRef}
        onScroll={handleScroll}
        onSelectOptionTrade={onSelectOptionTrade}
        onViewChart={onViewChart}
      />
    </div>
  );
};
