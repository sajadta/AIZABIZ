import React from 'react';
import { BarChart2, Calendar } from 'lucide-react';
import { formatTradeDateTime, getTradeDuration, translateExitReason } from './tradeUtils';
import { calculateTradeCharges } from '../../utils/indicators';
import type { Position, Language } from '../../types';
import type { ViewChartFn } from './types';

interface PairedTradeCardProps {
  pos: Position;
  language: Language;
  onViewChart?: ViewChartFn;
}

export const PairedTradeCard: React.FC<PairedTradeCardProps> = ({ pos, language, onViewChart }) => {
  const gross = pos.realizedPnL || 0;
  const isOpt = Boolean(
    pos.isOption ||
    /\b(CE|PE)\b/i.test(pos.symbol || '') ||
    String(pos.instrumentKey || '').includes('FO'),
  );
  const estCharges =
    Number(pos.brokerageCharges) > 0
      ? Number(pos.brokerageCharges)
      : calculateTradeCharges(
          Number(pos.buyPrice || 0),
          Math.max(1, Number(pos.quantity || 1)),
          isOpt,
          Number(pos.sellPrice || pos.currentLTP || pos.buyPrice || 0),
          pos.instrumentKey || pos.symbol,
        ).roundTripCharges;
  const net = gross - estCharges;
  const entryDt = formatTradeDateTime(pos.openedAtMs || pos.openedAt, language);
  const exitDt = formatTradeDateTime(pos.closeTime, language);
  const tradeDateLabel =
    entryDt.dateStr ||
    exitDt.dateStr ||
    (pos.closeTime ? new Date(pos.closeTime).toLocaleDateString('en-IN') : 'Trade Session');
  const duration = getTradeDuration(pos.openedAtMs || pos.openedAt, pos.closeTime, language);
  const exitReason = translateExitReason(pos.exitReason, language, net, gross);
  const buyPx = Number(pos.buyPrice || 0);
  const sellPx = Number(pos.sellPrice || pos.currentLTP || buyPx);
  const qty = Math.max(1, Number(pos.quantity || 1));
  return (
    <div
      key={`paired_${pos.id}`}
      className="bg-gradient-to-br from-[#0c1222]/80 via-[#080c16]/95 to-[#111827]/80 backdrop-blur-md p-4 rounded-2xl border border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:border-slate-700/80 transition-all duration-500 relative overflow-hidden flex flex-col gap-3 group"
    >
      {/* Top Glowing Accent Line */}
      <div
        className={`h-[2px] w-full absolute top-0 left-0 ${net >= 0 ? 'bg-gradient-to-r from-emerald-500/60 via-cyan-400/40 to-transparent' : 'bg-gradient-to-r from-rose-500/60 via-amber-400/40 to-transparent'}`}
      />
      {/* Header Row: Symbol, Date, Chart Action, and Net P&L */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-black text-white text-base tracking-tight">{pos.symbol}</span>
          <span className="text-[11px] text-slate-300 bg-slate-800/70 px-2 py-0.5 rounded-md border border-slate-700/50 font-mono">
            Qty: <strong className="text-white">{qty}</strong>
          </span>
          <div className="flex items-center gap-1 text-slate-400 text-xs font-sans">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>{tradeDateLabel}</span>
          </div>
          {duration && <span className="text-[10px] text-slate-400 font-mono">({duration})</span>}
        </div>
        <div className="flex items-center gap-3">
          {onViewChart && (
            <button
              type="button"
              onClick={() =>
                onViewChart(pos.symbol, pos.instrumentKey, {
                  symbol: pos.symbol,
                  buyPrice: buyPx,
                  sellPrice: sellPx,
                  currentLTP: sellPx,
                  pnl: net,
                  isOption: /\b(CE|PE)\b/i.test(pos.symbol),
                })
              }
              className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-cyan-300 hover:text-white text-xs font-bold border border-indigo-500/30 transition flex items-center gap-1 active:scale-95"
              title={
                language === 'ml'
                  ? 'ഈ ട്രേഡിന്റെ ലൈവ് ചാർട്ട് കാണുക'
                  : 'View Live Candlestick Chart for this trade'
              }
            >
              <BarChart2 className="w-3.5 h-3.5 text-cyan-300" />
              <span>{language === 'ml' ? 'ലൈവ് ചാർട്ട്' : 'Live Chart'}</span>
            </button>
          )}
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Net P&L</span>
            <span
              className={`text-base sm:text-lg font-black font-mono tracking-tight ${
                net >= 0
                  ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]'
                  : 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]'
              }`}
            >
              {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      {/* Execution Details: Seamless Horizontal Flow (Light lines, no rigid box clutter) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono pt-1">
        <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black text-emerald-400 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              BUY
            </span>
            <span className="text-white font-bold text-sm">₹{buyPx.toFixed(2)}</span>
            <span className="text-slate-400 text-[11px] font-sans">
              ({entryDt.timeStr || pos.openedAt || '—'})
            </span>
          </div>
          <span className="text-slate-600 font-bold hidden sm:inline">→</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black text-rose-400 uppercase bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
              SELL
            </span>
            <span className="text-white font-bold text-sm">₹{sellPx.toFixed(2)}</span>
            <span className="text-slate-400 text-[11px] font-sans">
              (
              {exitDt.timeStr ||
                (pos.closeTime ? new Date(pos.closeTime).toLocaleTimeString('en-IN') : '—')}
              )
            </span>
          </div>
        </div>
        {/* Financial charges & Exit reason */}
        <div className="flex items-center gap-2.5 flex-wrap justify-between sm:justify-end">
          <span className="text-[11px] text-slate-400 font-sans">
            Gross: <strong className="text-slate-200">₹{gross.toFixed(2)}</strong> • Charges:{' '}
            <strong className="text-slate-300">₹{estCharges.toFixed(2)}</strong>
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              net >= 0
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            {exitReason}
          </span>
        </div>
      </div>
    </div>
  );
};
