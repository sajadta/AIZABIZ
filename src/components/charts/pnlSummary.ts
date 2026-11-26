// Aggregate equity-curve metrics shown above the PnL chart.
import type { Position } from '../../types';

export interface PnLSummary {
  totalPnL: number;
  winningTrades: number;
  winRate: number;
}

export function computePnLSummary(tradeHistory: Position[]): PnLSummary {
  const totalPnL = tradeHistory.reduce((acc, t) => acc + (t.realizedPnL || 0), 0);
  const winningTrades = tradeHistory.filter((t) => (t.realizedPnL || 0) > 0).length;
  const winRate =
    tradeHistory.length === 0 ? 0 : Math.round((winningTrades / tradeHistory.length) * 100);
  return { totalPnL, winningTrades, winRate };
}
