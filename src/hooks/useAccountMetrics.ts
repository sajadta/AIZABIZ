import { useMemo } from 'react';
import type { ExecutionMode, Order, Position } from '../types';
import { calculateTradeCharges } from '../utils/indicators';

interface UseAccountMetricsParams {
  positions: Position[];
  tradeHistory: Position[];
  orders: Order[];
  mode: ExecutionMode;
}

export const useAccountMetrics = ({
  positions,
  tradeHistory,
  orders,
  mode,
}: UseAccountMetricsParams) => {
  const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const totalGrossMtm = positions.reduce((acc, p) => acc + Number(p.pnl || 0), 0);

  const openEntryCharges = positions.reduce((acc, p) => {
    const chg = calculateTradeCharges(
      p.buyPrice,
      p.quantity,
      p.isOption !== false,
      p.currentLTP,
      p.instrumentKey || p.symbol,
    );
    const isShort = p.type === 'SELL';
    const entryLegChg = isShort ? chg.sellCharges : chg.buyCharges;
    return acc + entryLegChg;
  }, 0);

  const totalNetMtm = Number((totalGrossMtm - openEntryCharges).toFixed(2));

  const getTradeSessionDate = (t: Position) => {
    if (t.openedAtMs && !isNaN(Number(t.openedAtMs))) {
      return new Date(Number(t.openedAtMs)).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Kolkata',
      });
    }
    if (t.openedAt && !isNaN(new Date(t.openedAt).getTime())) {
      return new Date(t.openedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    }
    if (t.closeTime && !isNaN(new Date(t.closeTime).getTime())) {
      return new Date(t.closeTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    }
    return todayIst;
  };

  const modeTradeHistory = useMemo(
    () => tradeHistory.filter((t) => (t.mode || 'PAPER_TRADING') === mode),
    [tradeHistory, mode],
  );

  const modeOrders = useMemo(
    () => orders.filter((o) => (o.mode || 'PAPER_TRADING') === mode),
    [orders, mode],
  );

  const todayClosedTrades = modeTradeHistory.filter((t) => getTradeSessionDate(t) === todayIst);

  const todayRealizedNet = todayClosedTrades.reduce((acc, t) => {
    const gross = Number(t.realizedPnL ?? 0);
    const brok = Number(
      t.brokerageCharges ||
        calculateTradeCharges(
          t.buyPrice || 0,
          t.quantity || 1,
          t.isOption !== false,
          t.sellPrice || t.currentLTP || t.buyPrice || 0,
          t.instrumentKey || t.symbol,
        ).roundTripCharges,
    );
    return acc + (t.netRealizedPnL !== undefined ? Number(t.netRealizedPnL) : gross - brok);
  }, 0);

  const totalRealizedNet = modeTradeHistory.reduce((acc, t) => {
    const gross = Number(t.realizedPnL ?? 0);
    const brok = Number(
      t.brokerageCharges ||
        calculateTradeCharges(
          t.buyPrice || 0,
          t.quantity || 1,
          t.isOption !== false,
          t.sellPrice || t.currentLTP || t.buyPrice || 0,
          t.instrumentKey || t.symbol,
        ).roundTripCharges,
    );
    return acc + (t.netRealizedPnL !== undefined ? Number(t.netRealizedPnL) : gross - brok);
  }, 0);

  const todayProfit = todayRealizedNet + totalNetMtm;
  const totalCumulativeProfit = totalRealizedNet + totalNetMtm;

  const openPositionsInvested = positions.reduce(
    (acc, p) => acc + Number(p.buyPrice || 0) * Math.max(1, Number(p.quantity || 1)),
    0,
  );
  const paperAccountBalance = 10000 + totalRealizedNet - openPositionsInvested;

  return {
    todayIst,
    totalGrossMtm,
    openEntryCharges,
    totalNetMtm,
    getTradeSessionDate,
    modeTradeHistory,
    modeOrders,
    todayClosedTrades,
    todayRealizedNet,
    totalRealizedNet,
    todayProfit,
    totalCumulativeProfit,
    openPositionsInvested,
    paperAccountBalance,
  };
};
