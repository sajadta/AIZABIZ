import { useCallback } from 'react';
import type { BotLog, ExecutionMode, OrderTransactionType, TradingSignal } from '../types';
import { safeStorage } from '../utils/storage';
import { calculateTradeCharges, calculateAffordableLotsWithBrokerage } from '../utils/indicators';

interface PlaceOrderPayload {
  symbol: string;
  instrumentKey?: string;
  transactionType: OrderTransactionType;
  orderType: 'MARKET' | 'LIMIT';
  productType: 'INTRADAY' | 'DELIVERY';
  quantity: number;
  price: number;
  stopLoss?: number;
  target?: number;
}

interface UseSignalExecutionParams {
  mode: ExecutionMode;
  availableMargin: number;
  maxCapitalPerTrade?: number;
  paperAccountBalance: number;
  setBotLogs: React.Dispatch<React.SetStateAction<BotLog[]>>;
  handlePlaceOrder: (payload: PlaceOrderPayload) => void | Promise<void>;
}

// Executes an analysed signal with the live Upstox lot size and the same capital
// and brokerage guards the order modal uses.
export const useSignalExecution = ({
  mode,
  availableMargin,
  maxCapitalPerTrade,
  paperAccountBalance,
  setBotLogs,
  handlePlaceOrder,
}: UseSignalExecutionParams) => {
  const handleExecuteSignal = useCallback(
    async (sig: TradingSignal) => {
      const price = sig.recommendedOptionStrike ? sig.recommendedOptionStrike.ltp : sig.price;
      const rawSym = sig.symbol || '';
      const isAlreadyOptionSym = /\b(CE|PE)\b/i.test(rawSym);
      const symbol =
        !isAlreadyOptionSym && sig.recommendedOptionStrike
          ? `${rawSym} ${sig.recommendedOptionStrike.strikePrice} ${sig.recommendedOptionStrike.optionType}`
          : rawSym;
      const isOptionTrade = /\b(CE|PE)\b/i.test(symbol) || Boolean(sig.recommendedOptionStrike);

      let liveLot = sig.recommendedOptionStrike?.lotSize || 0;
      if (!liveLot || liveLot <= 1) {
        try {
          const headers: Record<string, string> = {};
          const savedTok = safeStorage.getItem('upstox_daily_token');
          if (savedTok && savedTok.length > 30) {
            headers['Authorization'] = `Bearer ${savedTok}`;
          }
          const qs = new URLSearchParams({ symbol });
          if (sig.instrumentKey) qs.set('instrumentKey', sig.instrumentKey);
          const res = await fetch(`/api/instrument/details?${qs.toString()}`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (Number(data.lotSize) > 0) {
              liveLot = Number(data.lotSize);
            }
          }
        } catch {
          // Ignored
        }
      }

      const baseLot = liveLot > 0 ? liveLot : 1;
      const oneLotCharges = calculateTradeCharges(
        price,
        baseLot,
        isOptionTrade,
        sig.target1 || price * 1.25,
      );
      const oneLotCost = oneLotCharges.tradeValue;
      const oneLotBrokerage = oneLotCharges.roundTripCharges;
      const oneLotTotalWithBrokerage = oneLotCharges.totalRequiredWithBrokerage;

      // Strict Capital & Brokerage Separation:
      // - UPSTOX_LIVE: strictly uses real Upstox account cash (apiConfig.availableMargin), never dummy cash!
      // - PAPER_TRADING: uses allocated virtual/dummy capital (botConfig.maxCapitalPerTrade || 2000).
      const effectiveCap =
        mode === 'UPSTOX_LIVE'
          ? (maxCapitalPerTrade ?? 0) > 0
            ? Math.min(availableMargin, maxCapitalPerTrade ?? 0)
            : availableMargin
          : (maxCapitalPerTrade ?? 0) > 0
            ? Math.min(paperAccountBalance, maxCapitalPerTrade ?? 0)
            : paperAccountBalance;

      if (oneLotTotalWithBrokerage > effectiveCap) {
        setBotLogs((prev) => [
          {
            id: Date.now().toString(),
            timestamp: new Date().toLocaleTimeString(),
            message: `[CAPITAL & BROKERAGE GUARD] Cannot buy ${symbol}: 1 Lot (${baseLot} Qty @ ₹${price}) requires ₹${oneLotTotalWithBrokerage.toLocaleString('en-IN')} (Premium ₹${oneLotCost.toLocaleString('en-IN')} + Brokerage & Taxes ₹${oneLotBrokerage.toFixed(2)}), but available capital is ₹${effectiveCap.toLocaleString('en-IN')}. Order blocked to prevent overleveraging.`,
            type: 'ERROR',
          },
          ...prev.slice(0, 199),
        ]);
        return;
      }

      const lotCalc = calculateAffordableLotsWithBrokerage(
        price,
        baseLot,
        effectiveCap,
        isOptionTrade,
        5,
      );
      if (lotCalc.affordableLots <= 0) {
        return;
      }
      const affordableLots = lotCalc.affordableLots;
      const qty = isOptionTrade ? affordableLots * baseLot : baseLot;

      // For Option buying (both CE and PE), transactionType is ALWAYS 'BUY'!
      const txType: OrderTransactionType = isOptionTrade
        ? 'BUY'
        : sig.signalType === 'SELL'
          ? 'SELL'
          : 'BUY';

      handlePlaceOrder({
        symbol,
        instrumentKey: sig.recommendedOptionStrike?.instrumentKey || sig.instrumentKey,
        transactionType: txType,
        orderType: 'MARKET',
        productType: 'INTRADAY',
        quantity: qty,
        price,
        stopLoss: sig.stopLoss,
        target: sig.target1,
      });
    },
    [mode, availableMargin, maxCapitalPerTrade, paperAccountBalance, setBotLogs, handlePlaceOrder],
  );

  return { handleExecuteSignal };
};
