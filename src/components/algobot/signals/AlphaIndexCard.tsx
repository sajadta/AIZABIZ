// One index radar card: spot, 15m trend, best option strike and the action verdict.
import React from 'react';
import type { BotConfig, MultiIndexAlphaItem, StockQuote, TradingSignal } from '../../../types';

export interface AlphaIndexItem {
  name: string;
  key: string;
  exch: string;
  lot: number;
  exp: string;
}

interface AlphaIndexCardProps {
  item: AlphaIndexItem;
  idx: number;
  matrixItem?: MultiIndexAlphaItem;
  matchingSig?: TradingSignal;
  matchingQuote?: StockQuote;
  botConfig: BotConfig;
  selectedSymbol?: string;
  onSelectSymbol?: (symbol: string, instrumentKey?: string) => void;
  onSelectOptionTrade?: (
    type: 'BUY' | 'SELL',
    optionSymbol: string,
    price: number,
    instrumentKey?: string,
    lotSize?: number,
  ) => void;
  onExecuteSignal: (signal: TradingSignal) => void;
}

export const AlphaIndexCard: React.FC<AlphaIndexCardProps> = ({
  item,
  idx,
  matrixItem,
  matchingSig,
  matchingQuote,
  botConfig,
  selectedSymbol,
  onSelectSymbol,
  onSelectOptionTrade,
  onExecuteSignal,
}) => {
  const ltp = matrixItem?.spotLtp || matchingQuote?.ltp || 0;
  const ltpDisplay = ltp > 0 ? `₹${ltp.toLocaleString('en-IN')}` : '--';
  const trend15 = matrixItem?.trend15m || matchingSig?.mtfConfirmation?.timeframe15m || 'NEUTRAL';
  const signalType = matrixItem?.signalType || matchingSig?.signalType || 'HOLD';
  const isHold = signalType === 'HOLD';
  const isCall = signalType === 'BUY';
  const isPut = signalType === 'SELL';
  const isSelected = item.name === selectedSymbol;
  const isTopPickNow =
    !!matrixItem?.isTopPick && botConfig.selectedIndexPriority === 'FULL_AUTO_MULTI_INDEX';
  const optSymbol = matrixItem?.bestOptionSymbol || matchingSig?.symbol || '--';
  const optLtp = matrixItem?.bestOptionLtp || (matchingSig?.price ? Number(matchingSig.price) : 0);
  const expNet = matrixItem?.expectedNetProfit || 0;
  const delta = matrixItem?.delta || matchingSig?.recommendedOptionStrike?.delta || 0;
  return (
    <div
      key={item.name}
      onClick={() => onSelectSymbol && onSelectSymbol(item.name, item.key)}
      className={`p-3.5 rounded-2xl flex flex-col justify-between gap-3 transition-all duration-500 backdrop-blur-md relative overflow-hidden group cursor-pointer border ${
        isSelected
          ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30'
          : isTopPickNow && !selectedSymbol
            ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30 scale-[1.01]'
            : 'bg-slate-900/60 border-slate-800/60 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)]'
      }`}
    >
      {(isTopPickNow || isSelected) && (
        <div
          className={`absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent ${isSelected ? 'via-cyan-400' : 'via-emerald-400'} to-transparent`}
        ></div>
      )}
      <div className="flex items-center justify-between gap-1">
        <div>
          <span
            className={`font-black text-[13px] tracking-tight block ${isSelected ? 'text-cyan-300' : 'text-white'}`}
          >
            {item.name}
          </span>
          <span className="text-[9px] text-slate-500 font-sans font-bold uppercase tracking-tighter block mt-0.5">
            {item.exch} • LOT: {matrixItem?.lotSize || item.lot}
          </span>
        </div>
        {isTopPickNow ? (
          <div className="flex flex-col items-end">
            <span
              className={`px-2 py-0.5 rounded text-[8px] font-black ${isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-emerald-500 text-slate-950'} shadow-[0_0_8px_rgba(16,185,129,0.4)]`}
            >
              {isSelected ? 'SELECTED' : 'ALPHA #1'}
            </span>
          </div>
        ) : isSelected ? (
          <span className="px-2 py-0.5 rounded text-[8px] font-black bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.4)]">
            ACTIVE
          </span>
        ) : (
          <span className="text-[10px] font-black text-slate-600 font-mono">
            0{matrixItem?.rank || idx + 1}
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between py-1 border-b border-slate-800/30">
        <span className="text-slate-100 font-mono text-[12px] font-black tracking-tighter">
          {ltpDisplay}
        </span>
        <span
          className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
            trend15 === 'BULLISH'
              ? 'text-emerald-400 bg-emerald-500/10'
              : trend15 === 'BEARISH'
                ? 'text-rose-400 bg-rose-500/10'
                : 'text-amber-400 bg-amber-500/10'
          }`}
        >
          {trend15}
        </span>
      </div>
      {/* Best Option Strike & Profit Potential (Flat Hairline Separator) */}
      <div
        onClick={() => {
          if (optSymbol !== '--' && optLtp > 0 && onSelectOptionTrade) {
            onSelectOptionTrade(
              isPut ? 'BUY' : 'BUY',
              optSymbol,
              optLtp,
              matrixItem?.key || item.key,
              matrixItem?.lotSize || item.lot,
            );
          }
        }}
        className={`py-1.5 px-1 border-t border-b border-slate-800/50 space-y-1 transition active:scale-95 ${
          optSymbol !== '--' && optLtp > 0 ? 'cursor-pointer hover:bg-slate-800/30' : ''
        }`}
      >
        <div className="flex items-center justify-between text-[9px]">
          <span className="text-cyan-300 font-bold truncate max-w-[90px]">
            {optSymbol !== '--'
              ? optSymbol.replace('NSE_FO|', '').replace('BSE_FO|', '')
              : 'Option Strike'}
          </span>
          <span className="font-bold text-white">
            {optLtp > 0 ? `₹${optLtp.toFixed(1)}` : '--'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[8px] font-mono">
          <span className="text-slate-400">Δ: {delta ? delta.toFixed(2) : '0.50'}</span>
          {expNet > 0 ? (
            <span className="text-emerald-400 font-bold">
              +₹{Math.round(expNet).toLocaleString('en-IN')} Net
            </span>
          ) : (
            <span className="text-slate-500">Wait breakout</span>
          )}
        </div>
      </div>
      {/* Action Verdict Button */}
      <div className="pt-0.5 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => {
            if (matchingSig) {
              onExecuteSignal(matchingSig);
            } else if (onSelectOptionTrade && optSymbol !== '--' && optLtp > 0) {
              onSelectOptionTrade(
                isPut ? 'BUY' : 'BUY',
                optSymbol,
                optLtp,
                matrixItem?.key || item.key,
                matrixItem?.lotSize || item.lot,
              );
            }
          }}
          className={`w-full text-center py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition active:scale-95 shadow ${
            isHold
              ? 'bg-slate-800/80 text-slate-400 border border-slate-700/50 hover:bg-slate-700'
              : isCall
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-md shadow-emerald-900/50'
                : 'bg-rose-500 hover:bg-rose-400 text-white font-black shadow-md shadow-rose-900/50'
          }`}
        >
          {isHold
            ? optSymbol !== '--' && optLtp > 0
              ? `TRADE ${item.name}`
              : 'HOLD (Wait)'
            : isCall
              ? 'BUY CALL (CE)'
              : 'BUY PUT (PE)'}
        </button>
      </div>
    </div>
  );
};
