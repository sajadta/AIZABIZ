import React from 'react';
import { AlertOctagon, BarChart2 } from 'lucide-react';
import type { Order, Position, Holding, Language } from '../../types';
import type { Translations, ViewChartFn } from './types';

interface OrderBookBannersProps {
  t: Translations;
  positions: Position[];
  tradeHistory: Position[];
  language: Language;
  onSquareOffAll: () => void;
  totalPnL: number;
  onViewChart?: ViewChartFn;
}

export const OrderBookBanners: React.FC<OrderBookBannersProps> = ({
  t,
  positions,
  tradeHistory,
  language,
  onSquareOffAll,
  totalPnL,
  onViewChart,
}) => (
  <>
    {/* Desktop Total PnL Banner & Panic Square Off */}
    {positions.length > 0 && (
      <div className="hidden sm:flex items-center justify-end gap-2 pb-2">
        <div
          className={`px-3 py-1 rounded-xl border font-mono-num text-xs font-black ${
            totalPnL >= 0
              ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'
              : 'bg-rose-950/40 border-rose-800/50 text-rose-400'
          }`}
        >
          <span className="text-slate-400 text-[10px] mr-1">TOTAL P&L:</span>
          <span>
            {totalPnL >= 0 ? `+₹${totalPnL.toFixed(2)}` : `-₹${Math.abs(totalPnL).toFixed(2)}`}
          </span>
        </div>

        <button
          onClick={onSquareOffAll}
          className="px-3 py-1 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-black transition flex items-center gap-1.5 active:scale-95 shadow-sm"
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          <span>{t.squareOffAll}</span>
        </button>
      </div>
    )}

    {/* Live Chart Navigation Quick Banner */}
    <div className="mx-3 sm:mx-4 mt-2 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-950/70 via-slate-900/80 to-cyan-950/60 border border-indigo-500/30 flex items-center justify-between gap-2 text-xs flex-wrap shadow-sm">
      <div className="flex items-center gap-2 text-indigo-200 min-w-0">
        <BarChart2 className="w-4 h-4 text-cyan-400 shrink-0" />
        <span className="text-[11px] leading-tight">
          {language === 'ml'
            ? '💡 ട്രേഡ് ചാർട്ട് കാണാൻ: ഓരോ കാർഡിലുമുള്ള "📈 ലൈവ് ചാർട്ട്" ബട്ടൺ അമർത്തുക (എൻട്രി, SL, ടാർഗറ്റ് ലൈനുകളോടെ).'
            : '💡 To view chart: Click "📈 Live Chart" on any card (with Entry, SL & Target lines).'}
        </span>
      </div>
      {onViewChart && (
        <button
          type="button"
          onClick={() => {
            if (positions.length > 0) {
              const first = positions[0];
              onViewChart(first.symbol, first.instrumentKey, {
                symbol: first.symbol,
                buyPrice: first.buyPrice,
                currentLTP: first.currentLTP,
                target: first.target,
                stopLoss: first.stopLoss,
                pnl: first.pnl,
                isOption: first.isOption !== false,
              });
            } else if (tradeHistory.length > 0) {
              const first = tradeHistory[0];
              onViewChart(first.symbol, first.instrumentKey, {
                symbol: first.symbol,
                buyPrice: first.buyPrice,
                sellPrice: first.sellPrice || first.currentLTP,
                currentLTP: first.currentLTP,
                pnl: first.realizedPnL,
                isOption: first.isOption !== false,
              });
            } else {
              onViewChart('NIFTY', 'NSE_INDEX|Nifty 50');
            }
          }}
          className="px-2.5 py-1 rounded-lg bg-indigo-600/40 hover:bg-indigo-600 text-cyan-200 hover:text-white border border-indigo-500/40 text-[11px] font-extrabold transition flex items-center gap-1 active:scale-95 shadow-sm shrink-0"
        >
          <span>{language === 'ml' ? '📊 ഫുൾ ചാർട്ട് സ്ക്രീൻ' : '📊 Full Chart'}</span>
        </button>
      )}
    </div>
  </>
);
