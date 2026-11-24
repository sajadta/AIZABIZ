// Chart/tick synchronization effects shared by the app shell: keep the open chart
// trade context live and fold the selected symbol's tick into the last candle.
import { useEffect } from 'react';
import type { CandleData, Position } from '../types';
import { enrichCandlesWithIndicators } from '../utils/indicators';

export interface ChartTradeContextSyncParams {
  positions: Position[];
  candles: CandleData[];
  chartTradeContext: any;
  setChartTradeContext: (updater: (prev: any) => any) => void;
}

export function useChartTradeContextSync({
  positions,
  candles,
  chartTradeContext,
  setChartTradeContext,
}: ChartTradeContextSyncParams): void {
  useEffect(() => {
    if (!chartTradeContext) return;
    const active = positions.find(
      (p) => p.id === chartTradeContext.id || p.symbol === chartTradeContext.symbol,
    );
    const lastCandleClose = candles.length > 0 ? Number(candles[candles.length - 1].close || 0) : 0;
    if (active) {
      const liveLtp =
        lastCandleClose > 0 && Math.abs(lastCandleClose - active.buyPrice) < active.buyPrice * 5
          ? lastCandleClose
          : Number(active.currentLTP || active.buyPrice);
      const livePnl = Number(((liveLtp - active.buyPrice) * active.quantity).toFixed(2));
      setChartTradeContext((prev: any) => {
        if (!prev) return prev;
        if (
          prev.currentLTP === liveLtp &&
          prev.pnl === livePnl &&
          prev.stopLoss === active.stopLoss
        )
          return prev;
        return {
          ...prev,
          ...active,
          currentLTP: liveLtp,
          pnl: livePnl,
        };
      });
    } else if (lastCandleClose > 0) {
      setChartTradeContext((prev: any) => {
        if (!prev || prev.currentLTP === lastCandleClose) return prev;
        const livePnl = Number(
          ((lastCandleClose - prev.buyPrice) * (prev.quantity || 1)).toFixed(2),
        );
        return {
          ...prev,
          currentLTP: lastCandleClose,
          pnl: livePnl,
        };
      });
    }
  }, [positions, candles, chartTradeContext?.symbol]);
}

export interface CandleTickSyncParams {
  currentQuote: { ltp: number } | undefined;
  setCandles: (updater: (prev: CandleData[]) => CandleData[]) => void;
}

export function useCandleTickSync({ currentQuote, setCandles }: CandleTickSyncParams): void {
  useEffect(() => {
    if (!currentQuote || !currentQuote.ltp || currentQuote.ltp <= 0) return;
    setCandles((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (!last || !last.close || last.close <= 0) return prev;
      // Guard against cross-symbol contamination (e.g., merging a ₹54,450 NIFTY BANK quote into ₹22,700 NIFTY 50 candles)
      const priceDiffRatio = Math.abs(currentQuote.ltp - last.close) / last.close;
      if (priceDiffRatio > 0.15) {
        return prev;
      }
      if (
        last.close === currentQuote.ltp &&
        currentQuote.ltp <= last.high &&
        currentQuote.ltp >= last.low
      ) {
        return prev;
      }
      const updatedLast: CandleData = {
        ...last,
        close: currentQuote.ltp,
        high: Math.max(last.high, currentQuote.ltp),
        low: Math.min(last.low, currentQuote.ltp),
      };
      const copy = [...prev.slice(0, -1), updatedLast];
      return enrichCandlesWithIndicators(copy);
    });
  }, [currentQuote?.ltp]);
}
