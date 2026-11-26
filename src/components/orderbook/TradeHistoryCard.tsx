import React from 'react';
import { CheckCheck, Calendar, Clock, BarChart2, TrendingUp } from 'lucide-react';
import { formatTradeDateTime, getTradeDuration, translateExitReason } from './tradeUtils';
import { calculateTradeCharges } from '../../utils/indicators';
import type { Position, Language } from '../../types';
import type { ViewChartFn } from './types';

interface TradeHistoryCardProps {
  pos: Position;
  language: Language;
  onViewChart?: ViewChartFn;
}

export const TradeHistoryCard: React.FC<TradeHistoryCardProps> = ({
  pos,
  language,
  onViewChart,
}) => {
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
  const investedValue = buyPx * qty;
  const returnedValue = sellPx * qty;
  const peakPrice = Number(pos.highestLTP || Math.max(buyPx, sellPx));
  const peakProfit =
    pos.highestPnl !== undefined ? Number(pos.highestPnl) : Math.max(0, (peakPrice - buyPx) * qty);
  return (
    <div
      key={pos.id}
      className="bg-gradient-to-br from-[#0c1222] via-[#090d18] to-slate-900/90 p-4 rounded-2xl border border-slate-800/90 flex flex-col gap-3.5 relative overflow-hidden shadow-lg transition-all duration-300 hover:border-slate-700"
    >
      <div
        className={`absolute top-0 right-0 w-44 h-44 rounded-full blur-3xl opacity-15 pointer-events-none ${net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
      />
      {/* Top Header: Round-Trip Completed Badge, Trade Date, Duration & Chart */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 z-10 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 uppercase tracking-wider shadow-sm">
            <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
            {language === 'ml' ? 'വാങ്ങലും വിൽക്കലും പൂർത്തിയായി' : 'Completed Round-Trip'}
          </span>
          <span className="font-black text-white text-base font-sans tracking-tight">
            {pos.symbol}
          </span>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            {pos.productType || 'INTRADAY'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
          {/* Trade Date Badge */}
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-950/70 border border-indigo-500/40 text-cyan-200 text-xs font-bold shadow-sm font-sans"
            title="Trade Session Date"
          >
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>{tradeDateLabel}</span>
          </div>
          {/* Trade Duration Badge */}
          {duration && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-bold"
              title="Trade Duration"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{duration}</span>
            </div>
          )}
          {/* Chart Button */}
          {onViewChart && (
            <button
              type="button"
              onClick={() =>
                onViewChart(pos.symbol, pos.instrumentKey, {
                  symbol: pos.symbol,
                  buyPrice: pos.buyPrice,
                  sellPrice: pos.sellPrice || pos.currentLTP,
                  currentLTP: pos.currentLTP,
                  target: pos.target,
                  stopLoss: pos.stopLoss,
                  pnl: pos.realizedPnL,
                  isOption: isOpt,
                })
              }
              className="px-3 py-1.5 min-h-[34px] rounded-xl bg-gradient-to-r from-indigo-600/35 to-cyan-600/35 hover:from-indigo-600 hover:to-cyan-600 text-cyan-200 hover:text-white text-xs font-black border border-cyan-500/40 transition shadow-sm flex items-center gap-1.5 active:scale-95 touch-manipulation"
              title={
                language === 'ml'
                  ? 'ഈ ട്രേഡിന്റെ കാൻഡിൽസ്റ്റിക്ക് ചാർട്ട് കാണുക'
                  : 'View Candlestick Chart for this trade'
              }
            >
              <BarChart2 className="w-3.5 h-3.5 text-cyan-300" />
              <span>{language === 'ml' ? '📈 ലൈവ് ചാർട്ട്' : '📈 Live Chart'}</span>
            </button>
          )}
        </div>
      </div>
      {/* Two Side-by-Side Panels: Entry/Buy on Left & Exit/Sell on Right (വാങ്ങിയതും വിറ്റതും ഒന്നിച്ച്) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 z-10">
        {/* 1. ENTRY / BUY SIDE (വാങ്ങിയത്) */}
        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-black text-emerald-300 uppercase tracking-wide">
                {language === 'ml' ? '1. വാങ്ങിയത് (ENTRY / BUY)' : '1. Bought (Entry)'}
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
              {qty} Qty
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">
                {language === 'ml' ? 'വാങ്ങിയ തീയതി & സമയം' : 'Buy Date & Time'}
              </span>
              <span className="text-slate-200 font-bold text-[11px] block mt-0.5">
                {entryDt.fullStr || entryDt.timeStr || pos.openedAt || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">
                {language === 'ml' ? 'വാങ്ങിയ പ്രീമിയം വില' : 'Buy Price'}
              </span>
              <span className="text-emerald-300 font-black text-sm block mt-0.5">
                ₹{buyPx.toFixed(2)}
              </span>
            </div>
            <div className="col-span-2 pt-1.5 border-t border-emerald-500/10 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-sans">
                {language === 'ml' ? 'ആകെ മുതൽമുടക്ക് (Invested Value):' : 'Invested Value:'}
              </span>
              <span className="text-white font-bold">
                ₹{investedValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
        {/* 2. EXIT / SELL SIDE (വിറ്റത്) */}
        <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-rose-500/20 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span className="text-xs font-black text-rose-300 uppercase tracking-wide">
                {language === 'ml' ? '2. വിറ്റത് (EXIT / SELL)' : '2. Sold (Exit)'}
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60">
              {qty} Qty
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">
                {language === 'ml' ? 'വിറ്റ തീയതി & സമയം' : 'Exit Date & Time'}
              </span>
              <span className="text-slate-200 font-bold text-[11px] block mt-0.5">
                {exitDt.fullStr ||
                  exitDt.timeStr ||
                  (pos.closeTime ? new Date(pos.closeTime).toLocaleTimeString('en-IN') : '—')}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">
                {language === 'ml' ? 'വിറ്റ പ്രീമിയം വില' : 'Exit Price'}
              </span>
              <span className="text-rose-300 font-black text-sm block mt-0.5">
                ₹{sellPx.toFixed(2)}
              </span>
            </div>
            <div className="col-span-2 pt-1.5 border-t border-rose-500/10 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-sans">
                {language === 'ml' ? 'തിരിച്ചുകിട്ടിയ തുക (Returned Value):' : 'Returned Value:'}
              </span>
              <span className="text-white font-bold">
                ₹{returnedValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* Bottom Row: Peak Price Analytics & Realized P&L Breakdown */}
      <div className="p-3 rounded-xl bg-black/40 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono z-10">
        {/* Peak Price in Chart & Exit Trigger */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">
                {language === 'ml' ? 'ചാർട്ടിൽ എത്തിയ പരമാവധി വില' : 'Chart Peak High'}
              </span>
              <span className="text-amber-300 font-bold">
                ₹{peakPrice.toFixed(2)}
                {peakProfit > 0 && (
                  <span className="text-emerald-400 text-[10px] ml-1 font-sans">
                    ({language === 'ml' ? 'പരമാവധി ലാഭ സാധ്യത' : 'Peak PnL'}: +₹
                    {Math.round(peakProfit)})
                  </span>
                )}
              </span>
            </div>
          </div>
          <div className="h-6 w-px bg-slate-800 hidden sm:block" />
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">
              {language === 'ml' ? 'എക്സിറ്റ് കാരണം' : 'Exit Reason'}
            </span>
            <span className="text-cyan-300 font-bold text-[11px]">{exitReason}</span>
          </div>
        </div>
        {/* Financial Summary: Gross P&L, Brokerage/Tax, Net Realized P&L */}
        <div className="flex items-center gap-3 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/80">
          <div>
            <span className="text-[10px] text-slate-500 block font-sans uppercase">
              {language === 'ml' ? 'മൊത്തം ലാഭം (Gross)' : 'Gross P&L'}
            </span>
            <span className={`font-bold ${gross >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {gross >= 0 ? '+' : ''}₹{gross.toFixed(2)}
            </span>
          </div>
          <div>
            <span
              className="text-[10px] text-slate-500 block font-sans uppercase"
              title="Brokerage, STT, Exchange, GST"
            >
              {language === 'ml' ? 'ചാർജുകൾ' : 'Charges'}
            </span>
            <span className="text-amber-400 font-bold">-₹{estCharges.toFixed(2)}</span>
          </div>
          <div
            className={`px-3 py-1.5 rounded-xl border flex flex-col items-end ${
              net >= 0
                ? 'bg-emerald-950/60 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-rose-950/60 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
            }`}
          >
            <span className="text-[9px] uppercase font-sans font-black text-slate-300">
              {language === 'ml' ? 'അറ്റ ലാഭം (Net P&L)' : 'Net P&L'}
            </span>
            <span
              className={`text-sm font-black font-mono ${net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
            >
              {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
