import React from 'react';
import { X, Zap } from 'lucide-react';

import { translations } from '../translations';
import type { OrderModalProps } from './order/orderTypes';
import { useOrderFormState } from './order/useOrderFormState';
import { OrderQuantityFields } from './order/OrderQuantityFields';
import { OrderMarginBanner } from './order/OrderMarginBanner';

export const OrderModal: React.FC<OrderModalProps> = (props) => {
  const { isOpen, onClose, symbol, defaultPrice, heldQuantity, mode, language } = props;
  const t = translations[language];

  const {
    isOptionOrFo,
    transactionType,
    setTransactionType,
    orderType,
    setOrderType,
    productType,
    setProductType,
    quantity,
    setQuantity,
    lotStep,
    isLoadingLot,
    lotSource,
    price,
    setPrice,
    triggerPrice,
    setTriggerPrice,
    stopLoss,
    setStopLoss,
    target,
    setTarget,
    liveUpstoxCharges,
    baseMargin,
    estimatedBrokerageAndTaxes,
    estimatedMargin,
    effectiveAvailableBalance,
    maxAffordableLots,
    isInsufficientMargin,
    handleSubmit,
  } = useOrderFormState(props);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#0b0f19] border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with BUY / SELL banner */}
        <div
          className={`p-3.5 sm:p-4 flex items-center justify-between text-white ${
            transactionType === 'BUY'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700'
              : 'bg-gradient-to-r from-rose-600 to-red-700'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight">{symbol}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-black/30 font-mono font-bold">
                LTP ₹{Number(defaultPrice || 0).toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-white/80 font-medium">
              {mode === 'UPSTOX_LIVE'
                ? 'Upstox Live v2 Order'
                : 'Paper Trading (Instant Execution)'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-black/20 hover:bg-black/40 text-white transition active:scale-95 touch-manipulation"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Buy / Sell Toggle Buttons */}
          <div className="grid grid-cols-2 gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setTransactionType('BUY')}
              className={`py-2 rounded-lg text-xs font-extrabold transition ${
                transactionType === 'BUY'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {language === 'ml' ? 'വാങ്ങുക (BUY)' : 'BUY'}
            </button>
            <button
              type="button"
              onClick={() => setTransactionType('SELL')}
              className={`py-2 rounded-lg text-xs font-extrabold transition ${
                transactionType === 'SELL'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {language === 'ml' ? 'വിൽക്കുക (SELL)' : 'SELL'}
            </button>
          </div>

          {/* Product Type (MIS vs CNC) */}
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setProductType('INTRADAY')}
              className={`p-2.5 rounded-xl border transition text-center ${
                productType === 'INTRADAY'
                  ? 'bg-indigo-950/40 border-indigo-500/70 text-indigo-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <span className="block">{t.intraday}</span>
              <span className="text-[10px] text-slate-500 font-normal">
                {isOptionOrFo ? 'Intraday Option' : '5x Leverage'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setProductType('DELIVERY')}
              className={`p-2.5 rounded-xl border transition text-center ${
                productType === 'DELIVERY'
                  ? 'bg-indigo-950/40 border-indigo-500/70 text-indigo-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <span className="block">{t.delivery}</span>
              <span className="text-[10px] text-slate-500 font-normal">
                {isOptionOrFo ? 'Carry Forward (NRML)' : 'Demat Delivery (CNC)'}
              </span>
            </button>
          </div>

          <OrderQuantityFields
            t={t}
            language={language}
            isOptionOrFo={isOptionOrFo}
            isLoadingLot={isLoadingLot}
            lotStep={lotStep}
            lotSource={lotSource}
            quantity={quantity}
            setQuantity={setQuantity}
            heldQuantity={heldQuantity}
            transactionType={transactionType}
            orderType={orderType}
            setOrderType={setOrderType}
            price={price}
            setPrice={setPrice}
            triggerPrice={triggerPrice}
            setTriggerPrice={setTriggerPrice}
          />

          {/* Stop Loss & Target */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-rose-400 block mb-1 font-bold">{t.stopLoss}</label>
              <input
                type="number"
                step="0.05"
                value={stopLoss}
                onChange={(e) => setStopLoss(Number(e.target.value))}
                className="w-full bg-slate-950 border border-rose-900/50 rounded-xl p-2 text-rose-300 font-mono font-bold focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-emerald-400 block mb-1 font-bold">{t.target1}</label>
              <input
                type="number"
                step="0.05"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="w-full bg-slate-950 border border-emerald-900/50 rounded-xl p-2 text-emerald-300 font-mono font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <OrderMarginBanner
            language={language}
            mode={mode}
            baseMargin={baseMargin}
            liveUpstoxCharges={liveUpstoxCharges}
            estimatedBrokerageAndTaxes={estimatedBrokerageAndTaxes}
            estimatedMargin={estimatedMargin}
            isInsufficientMargin={isInsufficientMargin}
            effectiveAvailableBalance={effectiveAvailableBalance}
            isOptionOrFo={isOptionOrFo}
            maxAffordableLots={maxAffordableLots}
            lotStep={lotStep}
            setQuantity={setQuantity}
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isInsufficientMargin}
              className={`flex-1 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-lg transition flex items-center justify-center gap-1.5 ${
                isInsufficientMargin
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                  : transactionType === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950 active:scale-95'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950 active:scale-95'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>
                {isLoadingLot
                  ? 'Fetching Lot Size...'
                  : transactionType === 'BUY'
                    ? t.quickBuy
                    : t.quickSell}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
