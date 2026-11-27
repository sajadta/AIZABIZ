import React from 'react';
import { LineChart } from 'lucide-react';
import type { OptionChainData } from '../../types';
import { formatCompactNumber } from './formatCompactNumber';

interface OptionChainRowProps {
  strike: OptionChainData['strikes'][number];
  rowIndex: number;
  underlyingLtp: number;
  underlyingSymbol: string;
  chainLotSize?: number;
  selectedSymbol: string;
  maxCallOI: number;
  maxPutOI: number;
  getLtp: (instrumentKey?: string, defaultLtp?: number) => number;
  atmRef: React.MutableRefObject<HTMLTableRowElement | null>;
  onSelectOptionTrade: (
    type: 'BUY' | 'SELL',
    optionSymbol: string,
    price: number,
    instrumentKey?: string,
    lotSize?: number,
  ) => void;
  onViewChart?: (symbol: string, instrumentKey: string) => void;
}

export const OptionChainRow: React.FC<OptionChainRowProps> = ({
  strike: s,
  rowIndex: i,
  underlyingLtp,
  underlyingSymbol,
  chainLotSize,
  selectedSymbol,
  maxCallOI,
  maxPutOI,
  getLtp,
  atmRef,
  onSelectOptionTrade,
  onViewChart,
}) => {
  const isATM =
    Math.abs(s.strikePrice - underlyingLtp) <= (selectedSymbol.includes('BANK') ? 100 : 50);
  const isITMCall = s.strikePrice < underlyingLtp;
  const isITMPut = s.strikePrice > underlyingLtp;
  const callOiPct = Math.min(100, Math.round(((s.callOI || 0) / maxCallOI) * 100));
  const putOiPct = Math.min(100, Math.round(((s.putOI || 0) / maxPutOI) * 100));
  const callLtp = Number(getLtp(s.callInstrumentKey, s.callLTP) || 0);
  const putLtp = Number(getLtp(s.putInstrumentKey, s.putLTP) || 0);

  return (
    <tr
      key={s.strikePrice + '-' + i}
      ref={isATM ? atmRef : undefined}
      className={`transition hover:bg-slate-850/90 ${
        isATM ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/30' : ''
      }`}
    >
      {/* 1. CALL VOLUME */}
      <td
        className={`py-1.5 px-2 text-right text-slate-400 whitespace-nowrap overflow-hidden ${isITMCall ? 'bg-emerald-950/10' : ''}`}
      >
        {formatCompactNumber(s.callVolume || 0)}
      </td>

      {/* 2. CALL OI (With Visual Depth Bar) */}
      <td
        className={`py-1.5 px-2 text-right text-slate-300 relative overflow-hidden whitespace-nowrap min-w-[68px] max-w-[88px] ${isITMCall ? 'bg-emerald-950/10' : ''}`}
      >
        <div
          className="absolute inset-y-1 right-1 bg-emerald-500/15 rounded-sm pointer-events-none"
          style={{ width: `${Math.min(90, Math.max(4, callOiPct * 0.7))}%` }}
        />
        <span className="relative z-10 block truncate font-semibold">
          {formatCompactNumber(s.callOI || 0)}
        </span>
      </td>

      {/* 3. CALL IV */}
      <td
        className={`py-1.5 px-2 text-right text-slate-400 whitespace-nowrap ${isITMCall ? 'bg-emerald-950/10' : ''}`}
      >
        {Number(s.callIV || 0).toFixed(1)}%
      </td>

      {/* 4. CALL LTP & 1-TAP BUY */}
      <td
        className={`py-1.5 px-2.5 text-right font-bold text-emerald-400 border-r border-slate-800 whitespace-nowrap ${isITMCall ? 'bg-emerald-950/15' : ''}`}
      >
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() =>
              onSelectOptionTrade(
                'BUY',
                `${underlyingSymbol} ${s.strikePrice} CE`,
                callLtp,
                s.callInstrumentKey,
                s.lotSize || chainLotSize,
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
                onViewChart(`${underlyingSymbol} ${s.strikePrice} CE`, s.callInstrumentKey || '');
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
        {isATM && <span className="block text-[7px] text-amber-400 font-black uppercase">ATM</span>}
      </td>

      {/* 6. PUT LTP & 1-TAP BUY */}
      <td
        className={`py-1.5 px-2.5 text-left font-bold text-rose-400 whitespace-nowrap ${isITMPut ? 'bg-rose-950/15' : ''}`}
      >
        <div className="flex items-center justify-start gap-1.5">
          {onViewChart && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewChart(`${underlyingSymbol} ${s.strikePrice} PE`, s.putInstrumentKey || '');
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
                `${underlyingSymbol} ${s.strikePrice} PE`,
                putLtp,
                s.putInstrumentKey,
                s.lotSize || chainLotSize,
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
      <td
        className={`py-1.5 px-2 text-left text-slate-400 whitespace-nowrap ${isITMPut ? 'bg-rose-950/10' : ''}`}
      >
        {Number(s.putIV || 0).toFixed(1)}%
      </td>

      {/* 8. PUT OI (With Visual Depth Bar) */}
      <td
        className={`py-1.5 px-2 text-left text-slate-300 relative overflow-hidden whitespace-nowrap min-w-[68px] max-w-[88px] ${isITMPut ? 'bg-rose-950/10' : ''}`}
      >
        <div
          className="absolute inset-y-1 left-1 bg-rose-500/15 rounded-sm pointer-events-none"
          style={{ width: `${Math.min(90, Math.max(4, putOiPct * 0.7))}%` }}
        />
        <span className="relative z-10 block truncate font-semibold">
          {formatCompactNumber(s.putOI || 0)}
        </span>
      </td>

      {/* 9. PUT VOLUME */}
      <td
        className={`py-1.5 px-2 text-left text-slate-400 whitespace-nowrap overflow-hidden ${isITMPut ? 'bg-rose-950/10' : ''}`}
      >
        {formatCompactNumber(s.putVolume || 0)}
      </td>
    </tr>
  );
};
