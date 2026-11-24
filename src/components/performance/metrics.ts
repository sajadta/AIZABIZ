// Trade-performance aggregation helpers for the performance overview card.
import type { Position, Language } from '../../types';
import { calculateTradeCharges } from '../../utils/indicators';

export type PerformanceMetrics = ReturnType<typeof computeMetrics>;

export function computeMetrics(trades: Position[]) {
  const totalTrades = trades.length;
  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      totalRealizedPnL: 0,
      totalNetRealizedPnL: 0,
      totalBrokerageCharges: 0,
      grossProfit: 0,
      grossLoss: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakEvenTrades: 0,
      winLossRatio: '0.00 : 1',
      winRatePercent: 0,
      avgDurationMs: 0,
      minDurationMs: 0,
      maxDurationMs: 0,
      validDurationCount: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      totalCapitalInvested: 0,
      avgCapitalPerTrade: 0,
      roiPercent: 0,
    };
  }

  let totalRealizedPnL = 0;
  let totalBrokerageCharges = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let breakEvenTrades = 0;
  let totalCapitalInvested = 0;

  let totalDurationMs = 0;
  let validDurationCount = 0;
  let minDurationMs = Number.MAX_SAFE_INTEGER;
  let maxDurationMs = 0;

  trades.forEach((trade) => {
    const buyP = Number(trade.buyPrice || 0);
    const sellP = Number(trade.sellPrice || trade.currentLTP || buyP);
    const qty = Math.max(1, Number(trade.quantity || 1));
    const capital = buyP * qty;
    totalCapitalInvested += capital;

    const pnl =
      trade.realizedPnL !== undefined
        ? Number(trade.realizedPnL)
        : trade.pnl !== undefined
          ? Number(trade.pnl)
          : (sellP - buyP) * qty;
    totalRealizedPnL += pnl;

    const isOpt = Boolean(
      trade.isOption ||
      /\b(CE|PE)\b/i.test(trade.symbol || '') ||
      String(trade.instrumentKey || '').includes('FO'),
    );
    const tradeCharges =
      Number((trade as any).brokerageCharges) > 0
        ? Number((trade as any).brokerageCharges)
        : calculateTradeCharges(buyP, qty, isOpt, sellP, trade.instrumentKey || trade.symbol)
            .roundTripCharges;
    totalBrokerageCharges += tradeCharges;

    if (pnl > 0) {
      winningTrades += 1;
      grossProfit += pnl;
    } else if (pnl < 0) {
      losingTrades += 1;
      grossLoss += Math.abs(pnl);
    } else {
      breakEvenTrades += 1;
    }

    // Calculate trade duration
    const startTime = trade.openedAt
      ? new Date(trade.openedAt).getTime()
      : (trade as any).openTime
        ? new Date((trade as any).openTime).getTime()
        : (trade as any).timestamp
          ? new Date((trade as any).timestamp).getTime()
          : 0;

    const endTime = trade.closeTime ? new Date(trade.closeTime).getTime() : 0;

    if (startTime > 0 && endTime > 0 && endTime >= startTime) {
      const duration = endTime - startTime;
      totalDurationMs += duration;
      validDurationCount += 1;
      if (duration < minDurationMs) minDurationMs = duration;
      if (duration > maxDurationMs) maxDurationMs = duration;
    }
  });

  let winLossRatio = '0.00 : 1';
  if (losingTrades === 0) {
    winLossRatio = winningTrades > 0 ? `${winningTrades}.0 : 0` : '0.0 : 0';
  } else {
    winLossRatio = `${(winningTrades / losingTrades).toFixed(2)} : 1`;
  }

  const winRatePercent = Math.round((winningTrades / totalTrades) * 100);
  const avgDurationMs =
    validDurationCount > 0 ? Math.round(totalDurationMs / validDurationCount) : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;
  const avgWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
  const avgLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
  const netPnL = totalRealizedPnL - totalBrokerageCharges;
  const avgCapitalPerTrade = totalTrades > 0 ? totalCapitalInvested / totalTrades : 0;
  const roiPercent = totalCapitalInvested > 0 ? (netPnL / totalCapitalInvested) * 100 : 0;

  return {
    totalTrades,
    totalRealizedPnL,
    totalNetRealizedPnL: netPnL,
    totalBrokerageCharges,
    grossProfit,
    grossLoss,
    winningTrades,
    losingTrades,
    breakEvenTrades,
    winLossRatio,
    winRatePercent,
    avgDurationMs,
    minDurationMs: minDurationMs === Number.MAX_SAFE_INTEGER ? 0 : minDurationMs,
    maxDurationMs,
    validDurationCount,
    profitFactor,
    avgWin,
    avgLoss,
    totalCapitalInvested,
    avgCapitalPerTrade,
    roiPercent,
  };
}

export function getTradeSessionDate(t: Position, todayIst: string) {
  if (t.openedAtMs && !isNaN(Number(t.openedAtMs))) {
    return new Date(Number(t.openedAtMs)).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }
  if (t.openedAt && !isNaN(new Date(t.openedAt).getTime())) {
    return new Date(t.openedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }
  if (t.closeTime && !isNaN(new Date(t.closeTime).getTime())) {
    return new Date(t.closeTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }
  return todayIst;
}

export function formatDurationString(ms: number, language: Language) {
  if (ms <= 0) return language === 'ml' ? '< 1 മി' : '< 1 min';
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (days > 0)
    return language === 'ml'
      ? `${days}ദി ${hours > 0 ? `${hours}മ` : ''}`
      : `${days}d ${hours > 0 ? `${hours}h` : ''}`;
  if (hours > 0)
    return language === 'ml'
      ? `${hours}മ ${minutes > 0 ? `${minutes}മി` : ''}`
      : `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;
  if (minutes > 0)
    return language === 'ml'
      ? `${minutes}മി ${remainingSeconds > 0 ? `${remainingSeconds}സെ` : ''}`
      : `${minutes}m ${remainingSeconds > 0 ? `${remainingSeconds}s` : ''}`;
  return language === 'ml' ? `${remainingSeconds}സെ` : `${remainingSeconds}s`;
}
