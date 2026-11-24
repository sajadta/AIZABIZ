// Footer with current value plus chart and buy/sell actions.
import React from 'react';
import { BarChart2, Plus } from 'lucide-react';
import type { Holding, Language } from '../../types';
import type { ViewChartFn } from './types';

interface HoldingsCardFooterProps {
  h: Holding;
  language: Language;
  avgPx: number;
  curLtp: number;
  pnl: number;
  qty: number;
  currentVal: number;
  onViewChart?: ViewChartFn;
  onOpenOrderModal?: (
    type: 'BUY' | 'SELL',
    symbol: string,
    price: number,
    options?: {
      quantity?: number;
      heldQuantity?: number;
      productType?: 'INTRADAY' | 'DELIVERY';
      instrumentKey?: string;
    },
  ) => void;
}

export const HoldingsCardFooter: React.FC<HoldingsCardFooterProps> = ({
  h,
  language,
  avgPx,
  curLtp,
  pnl,
  qty,
  currentVal,
  onViewChart,
  onOpenOrderModal,
}) => (
  <>
    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
      <div className="text-[11px] text-slate-400">
        <span>{language === 'ml' ? 'നിലവിലെ മൂല്യം' : 'Cur Value'}: </span>
        <strong className="text-slate-200 font-mono">
          ₹{currentVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </strong>
      </div>
      <div className="flex items-center gap-1.5">
        {onViewChart && (
          <button
            type="button"
            onClick={() =>
              onViewChart(h.symbol, (h as any).instrumentKey || `NSE_EQ|${h.symbol}`, {
                symbol: h.symbol,
                buyPrice: avgPx,
                currentLTP: curLtp,
                pnl: pnl,
                isOption: false,
              })
            }
            className="px-3 py-1.5 min-h-[36px] rounded-xl bg-gradient-to-r from-indigo-600/35 to-cyan-600/35 hover:from-indigo-600 hover:to-cyan-600 text-cyan-200 hover:text-white border border-cyan-500/40 text-xs font-black transition flex items-center gap-1.5 active:scale-95 touch-manipulation shadow-sm"
            title={language === 'ml' ? 'ഈ ഓഹരിയുടെ ലൈവ് ചാർട്ട് കാണുക' : 'View Live Stock Chart'}
          >
            <BarChart2 className="w-3.5 h-3.5 text-cyan-300" />
            <span>{language === 'ml' ? '📈 ലൈവ് ചാർട്ട്' : '📈 Live Chart'}</span>
          </button>
        )}
        {onOpenOrderModal && (
          <>
            <button
              type="button"
              onClick={() =>
                onOpenOrderModal('BUY', h.symbol, h.currentLTP || 0, {
                  quantity: 1,
                  heldQuantity: h.quantity,
                  productType: 'DELIVERY',
                  instrumentKey: (h as any).instrumentKey,
                })
              }
              className="px-2.5 py-1 min-h-[36px] rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition flex items-center gap-1 active:scale-95 touch-manipulation"
            >
              <Plus className="w-3 h-3" />
              <span>{language === 'ml' ? 'വാങ്ങുക' : 'Buy'}</span>
            </button>
            <button
              type="button"
              disabled={qty <= 0}
              onClick={() =>
                onOpenOrderModal('SELL', h.symbol, h.currentLTP || 0, {
                  quantity: h.quantity || 1,
                  heldQuantity: h.quantity,
                  productType: 'DELIVERY',
                  instrumentKey: (h as any).instrumentKey,
                })
              }
              className="px-2.5 py-1 min-h-[36px] rounded-lg bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-rose-400 border border-rose-500/30 text-[11px] font-bold transition flex items-center gap-1 active:scale-95 touch-manipulation"
            >
              <span>{language === 'ml' ? 'വിൽക്കുക' : 'Sell'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  </>
);
