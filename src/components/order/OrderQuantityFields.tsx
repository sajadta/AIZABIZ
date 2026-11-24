// Quantity/lot selector, order type and limit/trigger price inputs.
import React from 'react';
import type { OrderType } from '../../types';
import type { Language } from '../../types';
import { translations } from '../../translations';

type Translations = (typeof translations)[Language];

interface OrderQuantityFieldsProps {
  t: Translations;
  language: Language;
  isOptionOrFo: boolean;
  isLoadingLot: boolean;
  lotStep: number;
  lotSource: string;
  quantity: number;
  setQuantity: (qty: number) => void;
  heldQuantity?: number;
  transactionType: 'BUY' | 'SELL';
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  price: number;
  setPrice: (price: number) => void;
  triggerPrice: number;
  setTriggerPrice: (price: number) => void;
}

export const OrderQuantityFields: React.FC<OrderQuantityFieldsProps> = ({
  t,
  language,
  isOptionOrFo,
  isLoadingLot,
  lotStep,
  lotSource,
  quantity,
  setQuantity,
  heldQuantity,
  transactionType,
  orderType,
  setOrderType,
  price,
  setPrice,
  triggerPrice,
  setTriggerPrice,
}) => (
  <>
    {/* Quantity (Shares for Equity vs Lots for Options) & Order Type */}
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div>
        <label className="text-slate-400 block mb-1 font-bold">
          {isOptionOrFo
            ? language === 'ml'
              ? `ലോട്ടുകൾ / അളവ് (1 Lot = ${isLoadingLot ? '...' : lotStep} • ${lotSource.includes('UPSTOX') ? 'Upstox Live' : 'Live'})`
              : `Lots / Qty (1 Lot = ${isLoadingLot ? '...' : lotStep} • ${lotSource.includes('UPSTOX') ? 'Upstox Live' : 'Live'})`
            : language === 'ml'
              ? 'ഓഹരികളുടെ എണ്ണം (Shares Qty)'
              : 'Quantity (Shares)'}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={lotStep || 1}
            step={lotStep || 1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
          />
        </div>
        {isOptionOrFo ? (
          <div className="flex gap-1 mt-1">
            {[1, 2, 5].map((multiplier) => (
              <button
                key={multiplier}
                type="button"
                onClick={() => setQuantity(lotStep * multiplier)}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
              >
                {multiplier} Lot ({lotStep * multiplier})
              </button>
            ))}
          </div>
        ) : heldQuantity && heldQuantity > 0 && transactionType === 'SELL' ? (
          <div className="flex flex-wrap gap-1 mt-1">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, Math.floor(heldQuantity * 0.25)))}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
            >
              25%
            </button>
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, Math.floor(heldQuantity * 0.5)))}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
            >
              50%
            </button>
            <button
              type="button"
              onClick={() => setQuantity(heldQuantity)}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 hover:text-white border border-rose-700/50 font-bold"
            >
              Full ({heldQuantity} Shares)
            </button>
          </div>
        ) : (
          <div className="flex gap-1 mt-1">
            {[1, 10, 50, 100].map((shareCount) => (
              <button
                key={shareCount}
                type="button"
                onClick={() => setQuantity(shareCount)}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
              >
                {shareCount} Sh
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="text-slate-400 block mb-1 font-bold">{t.orderType}</label>
        <select
          value={orderType}
          onChange={(e) => setOrderType(e.target.value as OrderType)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
        >
          <option value="MARKET">MARKET</option>
          <option value="LIMIT">LIMIT</option>
          <option value="SL">SL (Limit)</option>
          <option value="SL-M">SL-M (Market)</option>
        </select>
      </div>
    </div>

    {/* Price inputs if Limit / SL */}
    {orderType !== 'MARKET' && (
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label className="text-slate-400 block mb-1 font-bold">Limit Price</label>
          <input
            type="number"
            step="0.05"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
          />
        </div>
        {orderType.includes('SL') && (
          <div>
            <label className="text-slate-400 block mb-1 font-bold">Trigger Price</label>
            <input
              type="number"
              step="0.05"
              value={triggerPrice}
              onChange={(e) => setTriggerPrice(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
            />
          </div>
        )}
      </div>
    )}
  </>
);
