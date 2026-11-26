import { useMemo } from 'react';
import type { Holding, Position } from '../../types';
import { calculateTradeCharges } from '../../utils/indicators';

export interface AccountSummary {
  totalGrossProfit: number;
  totalGrossLoss: number;
  totalBrokerageCharges: number;
  netPnLAfterCharges: number;
  totalWins: number;
  totalLosses: number;
  allTimeWinRate: number;
  totalTradesCount: number;
  today: {
    todayGrossProfit: number;
    todayGrossLoss: number;
    todayBrokerage: number;
    todayNetPnL: number;
    todayWins: number;
    todayLosses: number;
    todayWinRate: number;
    todayTradesCount: number;
  };
}

export interface HoldingsTotals {
  totalHoldingsInvested: number;
  totalHoldingsValue: number;
  totalHoldingsPnL: number;
  totalHoldingsPnLPercent: number;
}

/** Aggregate holdings cost/value and closed+open PnL statistics for the order book header. */
export function useOrderBookSummary(
  positions: Position[],
  tradeHistory: Position[],
  holdings: Holding[],
): { accountSummary: AccountSummary; holdingsTotals: HoldingsTotals; todayIst: string } {
  const totalHoldingsInvested = holdings.reduce(
    (acc, h) => acc + (h.investedValue || h.quantity * (h.buyPrice ?? h.avgPrice ?? 0)),
    0,
  );
  const totalHoldingsValue = holdings.reduce(
    (acc, h) => acc + (h.currentValue || h.quantity * (h.currentLTP || 0)),
    0,
  );
  const totalHoldingsPnL = totalHoldingsValue - totalHoldingsInvested;
  const totalHoldingsPnLPercent =
    totalHoldingsInvested > 0 ? (totalHoldingsPnL / totalHoldingsInvested) * 100 : 0;

  const todayIst = useMemo(
    () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    [],
  );

  // Compute combined Summary Stats: Separate Today's Trading Performance and Total Cumulative Performance
  const accountSummary = useMemo(() => {
    let totalGrossProfit = 0;
    let totalGrossLoss = 0;
    let totalBrokerageCharges = 0;
    let totalWins = 0;
    let totalLosses = 0;

    let todayGrossProfit = 0;
    let todayGrossLoss = 0;
    let todayBrokerage = 0;
    let todayWins = 0;
    let todayLosses = 0;
    let todayTradesCount = 0;

    // 1. Open positions: track entry-side charges already paid + live open MTM cleanly
    // WITHOUT counting open positions as closed trades or double-counting pos.realizedPnL!
    let openBuyBrokeragePaid = 0;
    let openGrossMtm = 0;
    positions.forEach((p) => {
      const isOpt = Boolean(
        p.isOption ||
        /\b(CE|PE)\b/i.test(p.symbol || '') ||
        String(p.instrumentKey || '').includes('FO'),
      );
      const buyP = Number(p.buyPrice || 0);
      const curP = Number(p.currentLTP || buyP);
      const qty = Math.max(1, Number(p.quantity || 1));
      const pnl = p.pnl !== undefined ? Number(p.pnl) : (curP - buyP) * qty;
      const chg = calculateTradeCharges(buyP, qty, isOpt, curP, p.instrumentKey || p.symbol);
      const entrySideChg = p.type === 'SELL' ? chg.sellCharges : chg.buyCharges;

      openBuyBrokeragePaid += entrySideChg;
      openGrossMtm += pnl;
    });

    // 2. Closed trade history (realized wins, losses, and exact round-trip brokerage)
    tradeHistory.forEach((t) => {
      const isOpt = Boolean(
        t.isOption ||
        /\b(CE|PE)\b/i.test(t.symbol || '') ||
        String(t.instrumentKey || '').includes('FO'),
      );
      const buyP = Number(t.buyPrice || 0);
      const sellP = Number(t.sellPrice || t.currentLTP || buyP);
      const qty = Math.max(1, Number(t.quantity || 1));
      const pnl = t.realizedPnL !== undefined ? Number(t.realizedPnL) : (sellP - buyP) * qty;

      const chg =
        Number(t.brokerageCharges) > 0
          ? Number(t.brokerageCharges)
          : calculateTradeCharges(buyP, qty, isOpt, sellP, t.instrumentKey || t.symbol)
              .roundTripCharges;
      totalBrokerageCharges += chg;

      if (pnl > 0) {
        totalGrossProfit += pnl;
        totalWins += 1;
      } else if (pnl < 0) {
        totalGrossLoss += Math.abs(pnl);
        totalLosses += 1;
      }

      // Check if trade was opened today in IST
      const tradeDate =
        t.openedAtMs && !isNaN(Number(t.openedAtMs))
          ? new Date(Number(t.openedAtMs)).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
          : t.openedAt && !isNaN(new Date(t.openedAt).getTime())
            ? new Date(t.openedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
            : t.closeTime
              ? new Date(t.closeTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
              : todayIst;

      if (tradeDate === todayIst) {
        todayTradesCount += 1;
        todayBrokerage += chg;
        if (pnl > 0) {
          todayGrossProfit += pnl;
          todayWins += 1;
        } else if (pnl < 0) {
          todayGrossLoss += Math.abs(pnl);
          todayLosses += 1;
        }
      }
    });

    totalBrokerageCharges += openBuyBrokeragePaid;
    todayBrokerage += openBuyBrokeragePaid;
    if (openGrossMtm > 0) {
      totalGrossProfit += openGrossMtm;
      todayGrossProfit += openGrossMtm;
    } else if (openGrossMtm < 0) {
      totalGrossLoss += Math.abs(openGrossMtm);
      todayGrossLoss += Math.abs(openGrossMtm);
    }

    const netPnLAfterCharges = totalGrossProfit - totalGrossLoss - totalBrokerageCharges;
    const todayNetPnL = todayGrossProfit - todayGrossLoss - todayBrokerage;
    const todayWinRate =
      todayTradesCount > 0 ? Math.round((todayWins / todayTradesCount) * 100) : 0;
    const totalTradesCount = tradeHistory.length;
    const allTimeWinRate =
      totalTradesCount > 0 ? Math.round((totalWins / totalTradesCount) * 100) : 0;

    return {
      totalGrossProfit,
      totalGrossLoss,
      totalBrokerageCharges,
      netPnLAfterCharges,
      totalWins,
      totalLosses,
      allTimeWinRate,
      totalTradesCount,
      today: {
        todayGrossProfit,
        todayGrossLoss,
        todayBrokerage,
        todayNetPnL,
        todayWins,
        todayLosses,
        todayWinRate,
        todayTradesCount,
      },
    };
  }, [positions, tradeHistory, todayIst]);

  return {
    accountSummary,
    todayIst,
    holdingsTotals: {
      totalHoldingsInvested,
      totalHoldingsValue,
      totalHoldingsPnL,
      totalHoldingsPnLPercent,
    },
  };
}
