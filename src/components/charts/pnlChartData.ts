// Cumulative PnL series for the equity curve: groups realised PnL by day and
// falls back to a trade-by-trade progression for single-day histories.
import type { Position } from '../../types';

export interface PnLChartPoint {
  date: string;
  displayDate: string;
  dailyPnL: number;
  cumulative: number;
  tradesCount: number;
}

export function buildPnLChartData(
  tradeHistory: Position[],
  language: 'en' | 'ml',
): PnLChartPoint[] {
  if (!tradeHistory || tradeHistory.length === 0) return [];

  // Sort trade history by closeTime ascending (oldest first)
  const sortedTrades = [...tradeHistory].sort((a, b) => {
    const timeA = a.closeTime ? new Date(a.closeTime).getTime() : 0;
    const timeB = b.closeTime ? new Date(b.closeTime).getTime() : 0;
    return timeA - timeB;
  });

  // Group realized PnL by calendar date
  const dailyMap = new Map<string, { pnl: number; count: number; rawDate: Date }>();

  sortedTrades.forEach((trade) => {
    const d = trade.closeTime ? new Date(trade.closeTime) : new Date();
    // Format YYYY-MM-DD for grouping
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const realized = trade.realizedPnL || 0;
    const existing = dailyMap.get(dateKey);
    if (existing) {
      existing.pnl += realized;
      existing.count += 1;
    } else {
      dailyMap.set(dateKey, { pnl: realized, count: 1, rawDate: d });
    }
  });

  // If only one day of trades exists, also provide an intraday baseline and trade-by-trade cumulative progression
  // so the line chart shows a rich trajectory even on the first trading day!
  if (dailyMap.size === 1) {
    const points: PnLChartPoint[] = [];
    const singleDay = Array.from(dailyMap.values())[0];
    const dayLabel = singleDay.rawDate.toLocaleDateString(language === 'ml' ? 'ml-IN' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });

    // Starting break-even point
    points.push({
      date: 'Start',
      displayDate: `${dayLabel} (Open)`,
      dailyPnL: 0,
      cumulative: 0,
      tradesCount: 0,
    });

    let running = 0;
    sortedTrades.forEach((t, idx) => {
      running += t.realizedPnL || 0;
      const tradeTime = t.closeTime
        ? new Date(t.closeTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : `T-${idx + 1}`;

      points.push({
        date: tradeTime,
        displayDate: `${t.symbol} (${tradeTime})`,
        dailyPnL: t.realizedPnL || 0,
        cumulative: Math.round(running * 100) / 100,
        tradesCount: idx + 1,
      });
    });

    return points;
  }

  // Multi-day cumulative PnL progression
  let runningCumulative = 0;
  const points: PnLChartPoint[] = [];

  // Initial baseline point
  const firstDate = Array.from(dailyMap.values())[0]?.rawDate;
  if (firstDate) {
    points.push({
      date: 'Start',
      displayDate: 'Initial (₹0.00)',
      dailyPnL: 0,
      cumulative: 0,
      tradesCount: 0,
    });
  }

  dailyMap.forEach((val) => {
    runningCumulative += val.pnl;
    const displayLabel = val.rawDate.toLocaleDateString(language === 'ml' ? 'ml-IN' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });

    points.push({
      date: displayLabel,
      displayDate: `${displayLabel} (${val.count} ${val.count === 1 ? 'trade' : 'trades'})`,
      dailyPnL: Math.round(val.pnl * 100) / 100,
      cumulative: Math.round(runningCumulative * 100) / 100,
      tradesCount: val.count,
    });
  });

  return points;
}
