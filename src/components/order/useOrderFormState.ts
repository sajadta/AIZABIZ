import { useState, useEffect } from 'react';
import type { OrderTransactionType, OrderType, ProductType } from '../../types';
import {
  calculateTradeCharges,
  calculateAffordableLotsWithBrokerage,
} from '../../utils/indicators';
import type { OrderModalProps } from './orderTypes';

type OrderFormParams = Pick<
  OrderModalProps,
  | 'isOpen'
  | 'onClose'
  | 'symbol'
  | 'instrumentKey'
  | 'defaultPrice'
  | 'initialType'
  | 'defaultQuantity'
  | 'defaultLotSize'
  | 'defaultProductType'
  | 'heldQuantity'
  | 'defaultStopLoss'
  | 'defaultTarget'
  | 'availableMargin'
  | 'onPlaceOrder'
>;

export const useOrderFormState = ({
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
  onPlaceOrder,
}: OrderFormParams) => {
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

  const [transactionType, setTransactionType] = useState<OrderTransactionType>(
    initialType || 'BUY',
  );
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [productType, setProductType] = useState<ProductType>(defaultProductType || 'INTRADAY');
  const [lotSize, setLotSize] = useState<number>(
    defaultLotSize && defaultLotSize > 1 ? defaultLotSize : 1,
  );
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
        } catch {
          /* ignored */
        }

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
      } catch {
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
  const [triggerPrice, setTriggerPrice] = useState<number>(
    Number(((defaultPrice || 0) * 0.99).toFixed(2)),
  );
  const [stopLoss, setStopLoss] = useState<number>(
    Number(((defaultPrice || 0) * 0.985).toFixed(2)),
  );
  const [target, setTarget] = useState<number>(Number(((defaultPrice || 0) * 1.025).toFixed(2)));
  const [isAmo] = useState<boolean>(false);
  const [liveUpstoxCharges, setLiveUpstoxCharges] = useState<{
    total: number;
    brokerage: number;
    source: string;
    isLiveUpstox: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPrice(defaultPrice || 100);
    setTriggerPrice(Number(((defaultPrice || 0) * 0.99).toFixed(2)));

    const slRatio = isOptionOrFo ? 0.85 : 0.95;
    const tgtRatio = isOptionOrFo ? 1.35 : 1.1;

    setStopLoss(
      defaultStopLoss !== undefined
        ? defaultStopLoss
        : Number(((defaultPrice || 0) * slRatio).toFixed(2)),
    );
    setTarget(
      defaultTarget !== undefined
        ? defaultTarget
        : Number(((defaultPrice || 0) * tgtRatio).toFixed(2)),
    );
    setTransactionType(initialType || 'BUY');
    if (defaultProductType) {
      setProductType(defaultProductType);
    } else if (heldQuantity && heldQuantity > 0) {
      setProductType('DELIVERY');
    } else {
      setProductType(isOptionOrFo ? 'INTRADAY' : 'DELIVERY');
    }
  }, [
    isOpen,
    defaultPrice,
    initialType,
    defaultProductType,
    heldQuantity,
    defaultStopLoss,
    defaultTarget,
    isOptionOrFo,
  ]);

  const effectivePrice =
    orderType === 'MARKET' ? defaultPrice || price || 100 : price || defaultPrice || 100;

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
        } catch {
          /* ignored */
        }
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
      } catch {
        /* ignored */
      }
    };
    fetchLiveBrokerage();
  }, [
    isOpen,
    symbol,
    instrumentKey,
    quantity,
    price,
    defaultPrice,
    orderType,
    productType,
    transactionType,
    effectivePrice,
  ]);

  const currentOrderCharges = calculateTradeCharges(effectivePrice, quantity, isOptionOrFo, target);
  const baseMargin = Number(
    (effectivePrice * quantity * (productType === 'INTRADAY' && !isOptionOrFo ? 0.2 : 1)).toFixed(
      2,
    ),
  );
  const estimatedBrokerageAndTaxes =
    liveUpstoxCharges?.total && liveUpstoxCharges.total > 0
      ? liveUpstoxCharges.total
      : currentOrderCharges.roundTripCharges;
  const estimatedMargin = Number((baseMargin + estimatedBrokerageAndTaxes).toFixed(2));

  // Strict Balance Protection for both UPSTOX_LIVE and PAPER_TRADING
  const lotStep = isOptionOrFo ? lotSize || 1 : 1;
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
    transactionType === 'BUY' && estimatedMargin > effectiveAvailableBalance;

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

  return {
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
  };
};
