import React from 'react';
import { Layers } from 'lucide-react';
import type { Language } from '../../types';

const MAJOR_INDICES = [
  { symbol: 'NIFTY 50', key: 'NSE_INDEX|Nifty 50', name: 'NIFTY 50' },
  { symbol: 'BANKNIFTY', key: 'NSE_INDEX|Nifty Bank', name: 'BANKNIFTY' },
  { symbol: 'SENSEX', key: 'BSE_INDEX|SENSEX', name: 'SENSEX' },
  { symbol: 'FINNIFTY', key: 'NSE_INDEX|Nifty Fin Service', name: 'FINNIFTY' },
  { symbol: 'MIDCPNIFTY', key: 'NSE_INDEX|NIFTY MID SELECT', name: 'MIDCPNIFTY' },
  { symbol: 'BANKEX', key: 'BSE_INDEX|BANKEX', name: 'BANKEX' },
];

export const normalizeIndexSymbol = (s?: string): string => {
  const str = String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (str.includes('BANKNIFTY') || str.includes('NIFTYBANK')) return 'BANKNIFTY';
  if (str.includes('FINNIFTY') || str.includes('FINSERVICE')) return 'FINNIFTY';
  if (str.includes('MIDCP') || str.includes('MIDSELECT')) return 'MIDCPNIFTY';
  if (str.includes('BANKEX')) return 'BANKEX';
  if (str.includes('SENSEX')) return 'SENSEX';
  if (str.includes('NIFTY') || str.includes('NIFTY50')) return 'NIFTY 50';
  return str;
};

interface IndexSelectorRibbonProps {
  language: Language;
  selectedSymbol?: string;
  underlyingSymbol: string;
  onSelectSymbol?: (symbol: string, instrumentKey?: string) => void;
}

export const IndexSelectorRibbon: React.FC<IndexSelectorRibbonProps> = ({
  language,
  selectedSymbol,
  underlyingSymbol,
  onSelectSymbol,
}) => (
  // Quick index selector ribbon
  <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-slate-800 bg-[#090d18] overflow-x-auto scrollbar-none shrink-0">
    <span className="text-[10px] text-slate-400 font-bold shrink-0 uppercase tracking-wider flex items-center gap-1">
      <Layers className="w-3 h-3 text-cyan-400" />
      <span>{language === 'ml' ? 'സൂചിക:' : 'Index:'}</span>
    </span>
    {MAJOR_INDICES.map((idx) => {
      const activeNorm = normalizeIndexSymbol(selectedSymbol || underlyingSymbol);
      const idxNorm = normalizeIndexSymbol(idx.symbol);
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
);
