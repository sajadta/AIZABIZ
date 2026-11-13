import React, { useState, useEffect } from 'react';
import { X, Zap, AlertCircle } from 'lucide-react';
import { OrderTransactionType, OrderType, ProductType, Language, ExecutionMode } from '../types';
import { translations } from '../translations';
import { calculateTradeCharges, calculateAffordableLotsWithBrokerage } from '../utils/indicators';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  instrumentKey?: string;
  defaultPrice: number;
  initialType: OrderTransactionType;
  defaultQuantity?: number;
  defaultLotSize?: number;
  defaultProductType?: ProductType;
  heldQuantity?: number;
  defaultStopLoss?: number;
  defaultTarget?: number;
  availableMargin?: number;
  maxCapitalPerTrade?: number;
  mode: ExecutionMode;
  onPlaceOrder: (orderData: {
    symbol: string;
    instrumentKey?: string;
    transactionType: OrderTransactionType;
    orderType: OrderType;
    productType: ProductType;
    quantity: number;
    price: number;
    triggerPrice?: number;
    stopLoss?: number;
    target?: number;
    is_amo?: boolean;
  }) => void;
  language: Language;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  symbol,
  instrumentKey,
  defaultPrice,
  initialType,
  defaultQuantity,
  defaultLotSize,
  defaultProductType,
  heldQuantity,
  defaultStopLoss,
  defaultTarget,
  availableMargin = 0,
  maxCapitalPerTrade = 2000,
  mode,
  onPlaceOrder,
  language,
}) => {
  const t = translations[language];

  // Detect whether this instrument is an Option / F&O contract (uses Lots) or an Equity Stock (uses Shares Qty)
  const symUpper = (symbol || '').toUpperCase();
  const isOptionOrFo =
    /\b(CE|PE|CALL|PUT|FUT)\b/.test(symUpper) ||
    symUpper.includes('NIFTY') ||
    symUpper.includes('BANKNIFTY') ||
    symUpper.includes('FINNIFTY') ||
    symUpper.includes('MIDCP') ||
    symUpper.includes('SENSEX') ||
    symUpper.includes('BANKEX') ||
    (instrumentKey || '').includes('FO') ||
    (instrumentKey || '').includes('INDEX');

  const [transactionType, setTransactionType] = useState<OrderTransactionType>(initialType || 'BUY');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [productType, setProductType] = useState<ProductType>(defaultProductType || 'INTRADAY');
  const [lotSize, setLotSize] = useState<number>(defaultLotSize && defaultLotSize > 1 ? defaultLotSize : 1);
  const [lotSource, setLotSource] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(defaultQuantity || defaultLotSize || 1);
  const [isLoadingLot, setIsLoadingLot] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    if (!isOptionOrFo) {
      // Equity / Delivery Stock: 1 Share unit (never Lots!)
      setLotSize(1);
      setLotSource('EQUITY_SHARES');
      setQuantity(defaultQuantity && defaultQuantity > 0 ? defaultQuantity : 1);
      setIsLoadingLot(false);
      return;
    }

    if (defaultLotSize && defaultLotSize > 1) {
      setLotSize(defaultLotSize);
      setLotSource('UPSTOX_LIVE');
      setQuantity(defaultQuantity && defaultQuantity > 0 ? defaultQuantity : defaultLotSize);
    }

    const fetchInstrumentDetails = async () => {
      setIsLoadingLot(true);
      try {
        const headers: Record<string, string> = {};
        try {
          const savedTok = localStorage.getItem('upstox_daily_token');
          if (savedTok && savedTok.length > 30) {
            headers['Authorization'] = `Bearer ${savedTok}`;
          }
        } catch {}

        const qs = new URLSearchParams({ symbol });
        if (instrumentKey) qs.set('instrumentKey', instrumentKey);
        const res = await fetch(`/api/instrument/details?${qs.toString()}`, { headers });
        if (res.ok) {
          const data = await res.json();
          const fetchedLot = Number(data.lotSize) || defaultLotSize || 1;
          setLotSize(fetchedLot);
          setLotSource(data.source || 'UPSTOX_LIVE');
          setQuantity(defaultQuantity && defaultQuantity > 0 ? defaultQuantity : fetchedLot);
        }
      } catch (e) {
        const fallbackLot = defaultLotSize || 1;
        setLotSize(fallbackLot);
        setQuantity(defaultQuantity || fallbackLot);
      } finally {
        setIsLoadingLot(false);
      }
    };
    fetchInstrumentDetails();
  }, [symbol, instrumentKey, isOpen, isOptionOrFo, defaultQuantity, defaultLotSize]);

  const [price, setPrice] = useState<number>(defaultPrice || 100);
  const [triggerPrice, setTriggerPrice] = useState<number>(Number(((defaultPrice || 0) * 0.99).toFixed(2)));
  const [stopLoss, setStopLoss] = useState<number>(Number(((defaultPrice || 0) * 0.985).toFixed(2)));
  const [target, setTarget] = useState<number>(Number(((defaultPrice || 0) * 1.025).toFixed(2)));
  const [isAmo, setIsAmo] = useState<boolean>(false);
  const [liveUpstoxCharges, setLiveUpstoxCharges] = useState<{
    total: number;
    brokerage: number;
    source: string;
    isLiveUpstox: boolean;
  } | null>(null);

  useEffect(() => {
    setPrice(defaultPrice || 100);
    setTriggerPrice(Number(((defaultPrice || 0) * 0.99).toFixed(2)));

    const slRatio = isOptionOrFo ? 0.85 : 0.95;
    const tgtRatio = isOptionOrFo ? 1.35 : 1.10;

    setStopLoss(defaultStopLoss !== undefined ? defaultStopLoss : Number(((defaultPrice || 0) * slRatio).toFixed(2)));
    setTarget(defaultTarget !== undefined ? defaultTarget : Number(((defaultPrice || 0) * tgtRatio).toFixed(2)));
    setTransactionType(initialType || 'BUY');
    if (defaultProductType) {
      setProductType(defaultProductType);
    } else if (heldQuantity && heldQuantity > 0) {
      setProductType('DELIVERY');
    } else {
      setProductType(isOptionOrFo ? 'INTRADAY' : 'DELIVERY');
    }
  }, [defaultPrice, initialType, defaultProductType, heldQuantity, defaultStopLoss, defaultTarget, isOptionOrFo]);

  const effectivePrice = orderType === 'MARKET' ? (defaultPrice || price || 100) : (price || defaultPrice || 100);

  useEffect(() => {
    if (!isOpen) return;
    const fetchLiveBrokerage = async () => {
      try {
        const qs = new URLSearchParams({
          instrumentToken: instrumentKey || symbol,
          quantity: String(quantity),
          price: String(effectivePrice),
          product: productType,
          transactionType: transactionType,
          roundTrip: 'true',
        });
        const headers: Record<string, string> = {};
        try {
          const savedTok = localStorage.getItem('upstox_daily_token');
          if (savedTok) headers['Authorization'] = `Bearer ${savedTok}`;
        } catch {}
        const res = await fetch(`/api/market/brokerage?${qs.toString()}`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json?.data?.charges) {
            setLiveUpstoxCharges({
              total: Number(json.data.charges.total || 0),
              brokerage: Number(json.data.charges.brokerage || 0),
              source: json.data.source || json.source || 'UPSTOX_LIVE_API',
              isLiveUpstox: Boolean(json.isLiveUpstox),
            });
          }
        }
      } catch {}
    };
    fetchLiveBrokerage();
  }, [isOpen, symbol, instrumentKey, quantity, price, defaultPrice, orderType, productType, transactionType, effectivePrice]);

  if (!isOpen) return null;

  const lotStep = isOptionOrFo ? (lotSize || 1) : 1;
  const oneLotCharges = calculateTradeCharges(effectivePrice, lotStep, isOptionOrFo, target);
  const oneLotCost = oneLotCharges.tradeValue;
  const oneLotTotalWithBrokerage = oneLotCharges.totalRequiredWithBrokerage;

  const currentOrderCharges = calculateTradeCharges(effectivePrice, quantity, isOptionOrFo, target);
  const baseMargin = Number((effectivePrice * quantity * (productType === 'INTRADAY' && !isOptionOrFo ? 0.2 : 1)).toFixed(2));
  const estimatedBrokerageAndTaxes = liveUpstoxCharges?.total && liveUpstoxCharges.total > 0
    ? liveUpstoxCharges.total
    : currentOrderCharges.roundTripCharges;
  const estimatedMargin = Number((baseMargin + estimatedBrokerageAndTaxes).toFixed(2));

  // Strict Balance Protection for both UPSTOX_LIVE and PAPER_TRADING
  const effectiveAvailableBalance = Number(availableMargin || 0);
  const lotAffordability = calculateAffordableLotsWithBrokerage(
    effectivePrice,
    lotStep,
    effectiveAvailableBalance,
    isOptionOrFo,
    50,
  );
  const maxAffordableLots = lotAffordability.affordableLots;
  const isInsufficientMargin =
    transactionType === 'BUY' &&
    estimatedMargin > effectiveAvailableBalance;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isInsufficientMargin) return;
    onPlaceOrder({
      symbol,
      instrumentKey,
      transactionType,
      orderType,
      productType,
      quantity,
      price: orderType === 'MARKET' ? defaultPrice : price,
      triggerPrice: orderType.includes('SL') ? triggerPrice : undefined,
      stopLoss,
      target,
      is_amo: isAmo,
    });
    onClose();
  };

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
        <div className={`p-3.5 sm:p-4 flex items-center justify-between text-white ${
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

          {/* Margin, Brokerage & Account Balance Affordability Banner */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">
                {language === 'ml' ? 'ട്രേഡ് മൂല്യം (Premium × Qty):' : 'Trade Value (Premium × Qty):'}
              </span>
              <span className="font-bold text-slate-200">
                ₹{baseMargin.toLocaleString('en-IN')}
              </span>
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
              <span className="font-bold text-amber-300">
                +₹{estimatedBrokerageAndTaxes.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
              <span className="text-slate-300 font-bold">
                {language === 'ml' ? 'ആകെ വേണ്ട തുക (Incl. Brokerage):' : 'Total Cash Required (Incl. Brokerage):'}
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
                  ₹{Number(effectiveAvailableBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
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
              <span>{isLoadingLot ? 'Fetching Lot Size...' : transactionType === 'BUY' ? t.quickBuy : t.quickSell}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
