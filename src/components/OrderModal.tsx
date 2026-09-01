import React, { useState, useEffect } from 'react';
import { X, Check, ShieldCheck, Zap, AlertCircle } from 'lucide-react';
import { OrderTransactionType, OrderType, ProductType, Language, ExecutionMode } from '../types';
import { translations } from '../translations';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  defaultPrice: number;
  initialType: OrderTransactionType;
  defaultStopLoss?: number;
  defaultTarget?: number;
  mode: ExecutionMode;
  onPlaceOrder: (orderData: {
    symbol: string;
    transactionType: OrderTransactionType;
    orderType: OrderType;
    productType: ProductType;
    quantity: number;
    price: number;
    triggerPrice?: number;
    stopLoss?: number;
    target?: number;
  }) => void;
  language: Language;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  symbol,
  defaultPrice,
  initialType,
  defaultStopLoss,
  defaultTarget,
  mode,
  onPlaceOrder,
  language,
}) => {
  const t = translations[language];

  const [transactionType, setTransactionType] = useState<OrderTransactionType>(initialType || 'BUY');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [productType, setProductType] = useState<ProductType>('INTRADAY');
  const [lotSize, setLotSize] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(0);
  const [isLoadingLot, setIsLoadingLot] = useState<boolean>(true);

  useEffect(() => {
    const fetchInstrumentDetails = async () => {
      setIsLoadingLot(true);
      try {
        const res = await fetch(`/api/instrument/details?symbol=${encodeURIComponent(symbol)}`);
        if (res.ok) {
           const data = await res.json();
           if (data.lotSize) {
              setLotSize(data.lotSize);
              setQuantity(data.lotSize);
           }
        }
      } catch (e) {
        // Fallback for extreme cases
        setLotSize(1);
        setQuantity(1);
      } finally {
        setIsLoadingLot(false);
      }
    };
    fetchInstrumentDetails();
  }, [symbol]);
  const [price, setPrice] = useState<number>(defaultPrice || 100);
  const [triggerPrice, setTriggerPrice] = useState<number>(Number(((defaultPrice || 0) * 0.99).toFixed(2)));
  const [stopLoss, setStopLoss] = useState<number>(Number(((defaultPrice || 0) * 0.985).toFixed(2)));
  const [target, setTarget] = useState<number>(Number(((defaultPrice || 0) * 1.025).toFixed(2)));

  useEffect(() => {
     setPrice(defaultPrice || 100);
     setTriggerPrice(Number(((defaultPrice || 0) * 0.99).toFixed(2)));
     
     // More sensible default for options vs index
     const slRatio = defaultPrice < 1000 ? 0.8 : 0.985;
     const tgtRatio = defaultPrice < 1000 ? 1.5 : 1.025;
     
     setStopLoss(defaultStopLoss !== undefined ? defaultStopLoss : Number(((defaultPrice || 0) * slRatio).toFixed(2)));
     setTarget(defaultTarget !== undefined ? defaultTarget : Number(((defaultPrice || 0) * tgtRatio).toFixed(2)));
     setTransactionType(initialType || 'BUY');
  }, [defaultPrice, initialType, defaultStopLoss, defaultTarget]);

  if (!isOpen) return null;

  const lotStep = lotSize;
  const estimatedMargin = Number(((price || defaultPrice) * quantity * (productType === 'INTRADAY' ? 0.2 : 1)).toFixed(2));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onPlaceOrder({
      symbol,
      transactionType,
      orderType,
      productType,
      quantity,
      price: orderType === 'MARKET' ? defaultPrice : price,
      triggerPrice: orderType.includes('SL') ? triggerPrice : undefined,
      stopLoss,
      target,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0b0f19] border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with BUY / SELL banner */}
        <div className={`p-4 flex items-center justify-between text-white ${
          transactionType === 'BUY'
            ? 'bg-gradient-to-r from-emerald-600 to-teal-700'
            : 'bg-gradient-to-r from-rose-600 to-red-700'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight">{symbol}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-black/30 font-mono font-bold">
                LTP ₹{Number(defaultPrice || 0).toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-white/80 font-medium">
              {mode === 'UPSTOX_LIVE' ? 'Upstox Live v2 Order' : 'Paper Trading (Instant Execution)'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-black/20 hover:bg-black/40 text-white transition"
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
              {t.quickBuy} (BUY)
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
              {t.quickSell} (SELL)
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
              <span className="text-[10px] text-slate-500 font-normal">5x Leverage</span>
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
              <span className="text-[10px] text-slate-500 font-normal">Full Cash</span>
            </button>
          </div>

          {/* Quantity & Order Type */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1 font-bold">
                {t.quantity}
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={lotStep || 1}
                  step={lotStep || 1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-1 mt-1">
                {[1, 2, 5].map((multiplier) => (
                  <button
                    key={multiplier}
                    type="button"
                    onClick={() => setQuantity(lotStep * multiplier)}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                  >
                    {multiplier}x
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-bold">
                {t.orderType}
              </label>
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

          {/* Margin Estimation Banner */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Est. Margin:</span>
            <span className="font-extrabold text-white">₹{estimatedMargin.toLocaleString('en-IN')}</span>
          </div>

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
              className={`flex-1 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-lg transition active:scale-95 flex items-center justify-center gap-1.5 ${
                transactionType === 'BUY'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>{isLoadingLot ? 'Fetching Lot Size...' : transactionType === 'BUY' ? t.quickBuy : t.quickSell}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
