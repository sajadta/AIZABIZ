import React from 'react';
import { Edit2, Lock } from 'lucide-react';
import type { Holding, Language } from '../../types';
import type { ViewChartFn } from './types';
import { HoldingsBuyPriceEditor } from './HoldingsBuyPriceEditor';
import { HoldingsProfitMilestone } from './HoldingsProfitMilestone';
import { HoldingsForecastPanel } from './HoldingsForecastPanel';
import { HoldingsCardFooter } from './HoldingsCardFooter';

interface HoldingsCardProps {
  h: Holding;
  idx: number;
  language: Language;
  onViewChart?: ViewChartFn;
  editingHoldingSym: string | null;
  setEditingHoldingSym: (v: string | null) => void;
  customBuyPriceInput: string;
  setCustomBuyPriceInput: (v: string) => void;
  savingBuyPrice: boolean;
  handleSaveCustomBuyPrice: (symbol: string, isin?: string) => void;
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

export const HoldingsCard: React.FC<HoldingsCardProps> = ({
  h,
  idx,
  language,
  onViewChart,
  editingHoldingSym,
  setEditingHoldingSym,
  customBuyPriceInput,
  setCustomBuyPriceInput,
  savingBuyPrice,
  handleSaveCustomBuyPrice,
  onOpenOrderModal,
}) => {
  const avgPx = Number(h.buyPrice ?? h.avgPrice ?? 0);
  const curLtp = Number(h.currentLTP || 0);
  const qty = Number(h.quantity || 0);
  const invested = h.investedValue || Number((qty * avgPx).toFixed(2));
  const currentVal = h.currentValue || Number((qty * curLtp).toFixed(2));
  const pnl = Number((currentVal - invested).toFixed(2));
  const pnlPercent = avgPx > 0 ? Number((((curLtp - avgPx) / avgPx) * 100).toFixed(2)) : 0;
  const isGain = pnl >= 0;
  const target50 = h.fiftyPercentTarget || {
    targetPrice: Number((avgPx * 1.5).toFixed(2)),
    targetTotalValue: Number((avgPx * 1.5 * qty).toFixed(2)),
    targetProfitAmount: Number((avgPx * 0.5 * qty).toFixed(2)),
    priceNeeded: Number(Math.max(0, avgPx * 1.5 - curLtp).toFixed(2)),
    profitRemaining: Number(Math.max(0, avgPx * 0.5 * qty - pnl).toFixed(2)),
    progressPct:
      avgPx > 0
        ? Number(Math.max(0, Math.min(100, ((curLtp - avgPx) / (avgPx * 0.5)) * 100)).toFixed(1))
        : 0,
    isReached: avgPx > 0 && curLtp >= avgPx * 1.5,
  };
  const forecast = h.algoForecast;
  return (
    <div
      key={idx}
      className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 shadow-sm ${
        target50.isReached
          ? 'bg-gradient-to-br from-amber-950/40 via-slate-900/95 to-emerald-950/40 border-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.25)]'
          : isGain && pnl > 0
            ? 'bg-slate-900/95 border-emerald-500/50 shadow-[0_0_14px_rgba(16,185,129,0.14)]'
            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-extrabold text-white">{h.symbol}</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              DELIVERY · CNC
            </span>
            {h.isBuyPriceLocked && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                {language === 'ml' ? 'വാങ്ങിയ വില ലോക്ക് ചെയ്തു' : 'Buy Price Locked'}
              </span>
            )}
            {h.isUpstoxZeroPrice && !h.isBuyPriceLocked && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                ⚠️{' '}
                {language === 'ml'
                  ? 'ബ്രോക്കർ വില ലഭ്യമല്ല (ക്ലോസിങ് വില)'
                  : 'Zero broker price (Using close)'}
              </span>
            )}
            {qty <= 0 && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {language === 'ml'
                  ? `ഇന്ന് വിറ്റത് (Sold Today${(h as any).soldTodayQty ? `: ${(h as any).soldTodayQty}` : ''})`
                  : `Sold Today${(h as any).soldTodayQty ? ` (${(h as any).soldTodayQty})` : ''}`}
              </span>
            )}
            {qty > 0 && target50.isReached ? (
              <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-500/25 text-amber-200 border border-amber-400/60 animate-pulse">
                ⚡ +50% PROFIT TARGET HIT!
              </span>
            ) : qty > 0 && isGain && pnl > 0 ? (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                🟢 IN PROFIT (ലാഭത്തിൽ)
              </span>
            ) : null}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{h.companyName || `${h.symbol} Ltd`}</p>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold font-mono text-white">₹{curLtp.toFixed(2)}</span>
          <span className="text-[10px] text-slate-400 block font-mono">LTP</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-center font-mono">
        <div>
          <span className="text-[9px] text-slate-400 block">
            {language === 'ml' ? 'അളവ് (Qty)' : 'Qty'}
          </span>
          <span className="text-xs font-bold text-slate-200">{qty}</span>
        </div>
        <div className="relative group">
          <div className="flex items-center justify-center gap-1">
            <span className="text-[9px] text-slate-400 block">
              {language === 'ml' ? 'വാങ്ങിയ വില (Avg)' : 'Avg Buy Price'}
            </span>
            <button
              type="button"
              onClick={() => {
                if (editingHoldingSym === h.symbol) {
                  setEditingHoldingSym(null);
                } else {
                  setEditingHoldingSym(h.symbol);
                  setCustomBuyPriceInput(String(avgPx > 0 ? avgPx : ''));
                }
              }}
              className="text-slate-400 hover:text-cyan-300 transition p-0.5"
              title={
                language === 'ml'
                  ? 'വാങ്ങിയ യഥാർത്ഥ വില എഡിറ്റ് ചെയ്ത് ലോക്ക് ചെയ്യുക'
                  : 'Edit & lock actual buy price'
              }
            >
              <Edit2 className="w-2.5 h-2.5" />
            </button>
          </div>
          <span className="text-xs font-bold text-slate-200 flex items-center justify-center gap-1">
            ₹{avgPx.toFixed(2)}
            {h.isBuyPriceLocked && <Lock className="w-2.5 h-2.5 text-cyan-400" />}
          </span>
        </div>
        <div>
          <span className="text-[9px] text-slate-400 block">
            {language === 'ml' ? 'നിക്ഷേപം (Invested)' : 'Invested'}
          </span>
          <span className="text-xs font-bold text-slate-300">₹{invested.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[9px] text-slate-400 block">
            {language === 'ml' ? 'ലാഭം / നഷ്ടം' : 'Exact P&L'}
          </span>
          <span className={`text-xs font-bold ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isGain ? '+' : ''}₹{pnl.toFixed(2)}
            <span className="block text-[9px]">
              ({pnlPercent >= 0 ? '+' : ''}
              {pnlPercent.toFixed(2)}%)
            </span>
          </span>
        </div>
      </div>
      {editingHoldingSym === h.symbol && (
        <HoldingsBuyPriceEditor
          h={h}
          language={language}
          avgPx={avgPx}
          customBuyPriceInput={customBuyPriceInput}
          setCustomBuyPriceInput={setCustomBuyPriceInput}
          savingBuyPrice={savingBuyPrice}
          handleSaveCustomBuyPrice={handleSaveCustomBuyPrice}
          setEditingHoldingSym={setEditingHoldingSym}
        />
      )}
      <HoldingsProfitMilestone language={language} target50={target50} />
      {forecast && <HoldingsForecastPanel forecast={forecast} language={language} />}
      <HoldingsCardFooter
        h={h}
        language={language}
        avgPx={avgPx}
        curLtp={curLtp}
        pnl={pnl}
        qty={qty}
        currentVal={currentVal}
        onViewChart={onViewChart}
        onOpenOrderModal={onOpenOrderModal}
      />
    </div>
  );
};
