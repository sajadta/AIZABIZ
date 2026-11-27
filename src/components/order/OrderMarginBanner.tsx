// Brokerage, total cash requirement and affordability banner.
import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { Language } from '../../types';
import type { LiveUpstoxCharges } from './orderTypes';

interface OrderMarginBannerProps {
  language: Language;
  mode: string;
  baseMargin: number;
  liveUpstoxCharges?: LiveUpstoxCharges | null;
  estimatedBrokerageAndTaxes: number;
  estimatedMargin: number;
  isInsufficientMargin: boolean;
  effectiveAvailableBalance: number;
  isOptionOrFo: boolean;
  maxAffordableLots: number;
  lotStep: number;
  setQuantity: (qty: number) => void;
}

export const OrderMarginBanner: React.FC<OrderMarginBannerProps> = ({
  language,
  mode,
  baseMargin,
  liveUpstoxCharges,
  estimatedBrokerageAndTaxes,
  estimatedMargin,
  isInsufficientMargin,
  effectiveAvailableBalance,
  isOptionOrFo,
  maxAffordableLots,
  lotStep,
  setQuantity,
}) => (
  <>
    {/* Margin, Brokerage & Account Balance Affordability Banner */}
    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400">
          {language === 'ml' ? 'ട്രേഡ് മൂല്യം (Premium × Qty):' : 'Trade Value (Premium × Qty):'}
        </span>
        <span className="font-bold text-slate-200">₹{baseMargin.toLocaleString('en-IN')}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400 flex items-center gap-1">
          {language === 'ml'
            ? 'ബ്രോക്കറേജ് & ടാക്സ് (Buy+Sell GST/STT):'
            : 'Est. Brokerage & Taxes (Buy+Sell):'}
          {liveUpstoxCharges?.isLiveUpstox && (
            <span className="px-1 py-0.2 rounded text-[8px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Upstox Live API
            </span>
          )}
        </span>
        <span className="font-bold text-amber-300">+₹{estimatedBrokerageAndTaxes.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
        <span className="text-slate-300 font-bold">
          {language === 'ml'
            ? 'ആകെ വേണ്ട തുക (Incl. Brokerage):'
            : 'Total Cash Required (Incl. Brokerage):'}
        </span>
        <span className={`font-extrabold ${isInsufficientMargin ? 'text-rose-400' : 'text-white'}`}>
          ₹{estimatedMargin.toLocaleString('en-IN')}
        </span>
      </div>
      <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[11px]">
        <span className="text-slate-400">
          {mode === 'UPSTOX_LIVE'
            ? language === 'ml'
              ? 'Upstox ലഭ്യമായ ബാലൻസ്:'
              : 'Upstox Available Margin:'
            : language === 'ml'
              ? 'ട്രേഡ് ക്യാപിറ്റൽ പരിധി:'
              : 'Allocated Trade Capital:'}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-emerald-400">
            ₹
            {Number(effectiveAvailableBalance || 0).toLocaleString('en-IN', {
              maximumFractionDigits: 2,
            })}
          </span>
          {isOptionOrFo && maxAffordableLots > 0 && (
            <button
              type="button"
              onClick={() => setQuantity(maxAffordableLots * lotStep)}
              className="px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition"
            >
              Max {maxAffordableLots} Lot
            </button>
          )}
        </div>
      </div>
      {isInsufficientMargin && (
        <div className="p-2 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-[10px] font-sans flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>
            {language === 'ml'
              ? `അക്കൗണ്ടിൽ മതിയായ ബാലൻസ് ഇല്ല! ഈ ട്രേഡിന് ബ്രോക്കറേജ് ഉൾപ്പെടെ ₹${estimatedMargin.toLocaleString('en-IN')} വേണം. ലഭ്യമായ ബാലൻസ്: ₹${Number(effectiveAvailableBalance || 0).toLocaleString('en-IN')}.`
              : `Insufficient balance! This trade requires ₹${estimatedMargin.toLocaleString('en-IN')} incl. brokerage, but available balance is only ₹${Number(effectiveAvailableBalance || 0).toLocaleString('en-IN')}.`}
          </span>
        </div>
      )}
    </div>
  </>
);
