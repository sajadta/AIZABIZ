// Scrollable option chain table with sticky column headers.
import React from 'react';
import type { OptionChainData, OptionStrike } from '../../types';
import { OptionChainRow } from './OptionChainRow';

interface OptionChainTableProps {
  data: OptionChainData;
  strikes: OptionStrike[];
  underlyingLtp: number;
  selectedSymbol: string;
  maxCallOI: number;
  maxPutOI: number;
  getLtp: (instrumentKey?: string, defaultLtp?: number) => number;
  atmRef: React.RefObject<HTMLTableRowElement>;
  tableContainerRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  onSelectOptionTrade: (
    type: 'BUY' | 'SELL',
    optionSymbol: string,
    price: number,
    instrumentKey?: string,
    lotSize?: number,
  ) => void;
  onViewChart?: (symbol: string, instrumentKey: string) => void;
}

export const OptionChainTable: React.FC<OptionChainTableProps> = ({
  data,
  strikes,
  underlyingLtp,
  selectedSymbol,
  maxCallOI,
  maxPutOI,
  getLtp,
  atmRef,
  tableContainerRef,
  onScroll,
  onSelectOptionTrade,
  onViewChart,
}) => (
  <div
    ref={tableContainerRef}
    onScroll={onScroll}
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
          <th
            colSpan={4}
            className="text-center py-1.5 bg-emerald-950/30 text-emerald-400 font-extrabold border-r border-slate-800 tracking-wider"
          >
            CALLS (CE)
          </th>
          <th className="text-center py-1.5 px-3 bg-[#0d1322] text-amber-300 font-black border-r border-slate-800 tracking-wider">
            STRIKE
          </th>
          <th
            colSpan={4}
            className="text-center py-1.5 bg-rose-950/30 text-rose-400 font-extrabold tracking-wider"
          >
            PUTS (PE)
          </th>
        </tr>
        <tr className="border-b border-slate-800 text-[10px] text-slate-400 bg-[#070a12]">
          <th className="py-1.5 px-2 text-right whitespace-nowrap w-16">Vol</th>
          <th className="py-1.5 px-2 text-right whitespace-nowrap w-20">OI</th>
          <th className="py-1.5 px-2 text-right whitespace-nowrap w-14">IV</th>
          <th className="py-1.5 px-2.5 text-right border-r border-slate-800 text-emerald-400 font-black whitespace-nowrap w-24">
            Call LTP
          </th>
          <th className="py-1.5 px-3 text-center bg-[#0d1322] text-amber-300 border-r border-slate-800 font-black whitespace-nowrap w-20">
            Price
          </th>
          <th className="py-1.5 px-2.5 text-left text-rose-400 font-black whitespace-nowrap w-24">
            Put LTP
          </th>
          <th className="py-1.5 px-2 text-left whitespace-nowrap w-14">IV</th>
          <th className="py-1.5 px-2 text-left whitespace-nowrap w-20">OI</th>
          <th className="py-1.5 px-2 text-left whitespace-nowrap w-16">Vol</th>
        </tr>
      </thead>

      {/* TABLE BODY */}
      <tbody className="divide-y divide-slate-800/40">
        {strikes.map((s, i) => (
          <OptionChainRow
            key={`${s.strikePrice}-${i}`}
            strike={s}
            rowIndex={i}
            underlyingLtp={underlyingLtp}
            underlyingSymbol={data.underlyingSymbol}
            chainLotSize={data.lotSize}
            selectedSymbol={selectedSymbol}
            maxCallOI={maxCallOI}
            maxPutOI={maxPutOI}
            getLtp={getLtp}
            atmRef={atmRef}
            onSelectOptionTrade={onSelectOptionTrade}
            onViewChart={onViewChart}
          />
        ))}
      </tbody>
    </table>
  </div>
);
