// Derive the quote shown for the selected symbol: prefer the live watchlist tick,
// then the open chart trade context, then a matching position, then the candles.
import type { CandleData, Position, StockQuote } from '../types';

export interface DeriveCurrentQuoteParams {
  quotes: StockQuote[];
  selectedSymbol: string;
  selectedInstrumentKey: string;
  chartTradeContext: any;
  positions: Position[];
  candles: CandleData[];
}

export function deriveCurrentQuote({
  quotes,
  selectedSymbol,
  selectedInstrumentKey,
  chartTradeContext,
  positions,
  candles,
}: DeriveCurrentQuoteParams): StockQuote {
  const quote =
    quotes.find(
      (q) =>
        q.symbol === selectedSymbol ||
        q.instrumentKey === selectedInstrumentKey ||
        (selectedSymbol.includes('BANK') && q.symbol.includes('BANK') && q.segment === 'INDEX'),
    ) ||
    (() => {
      // If viewing an option contract from chartTradeContext, synthesize quote from trade context
      if (
        chartTradeContext &&
        (chartTradeContext.symbol === selectedSymbol ||
          selectedSymbol.includes(chartTradeContext.symbol))
      ) {
        const lastCandlePrice =
          candles.length > 0 ? Number(candles[candles.length - 1].close || 0) : 0;
        const ltp =
          lastCandlePrice > 0
            ? lastCandlePrice
            : Number(chartTradeContext.currentLTP || chartTradeContext.buyPrice || 0);
        const buy = Number(chartTradeContext.buyPrice || ltp);
        const diff = ltp - buy;
        const diffPct = buy > 0 ? (diff / buy) * 100 : 0;
        return {
          symbol: selectedSymbol,
          name: selectedSymbol,
          exchange: 'NSE',
          segment: 'OPTIONS',
          instrumentKey: chartTradeContext.instrumentKey || selectedInstrumentKey,
          ltp,
          change: Number(diff.toFixed(2)),
          changePercent: Number(diffPct.toFixed(2)),
          volume: 0,
          open: buy,
          high: Math.max(buy, ltp),
          low: Math.min(buy, ltp),
          close: buy,
        } as StockQuote;
      }
      // If an open position matches selectedSymbol, use its live position price
      const matchPos = positions.find(
        (p) => p.symbol === selectedSymbol || selectedSymbol.includes(p.symbol),
      );
      if (matchPos) {
        const ltp = Number(matchPos.currentLTP || matchPos.buyPrice || 0);
        const buy = Number(matchPos.buyPrice || ltp);
        const diff = ltp - buy;
        const diffPct = buy > 0 ? (diff / buy) * 100 : 0;
        return {
          symbol: selectedSymbol,
          name: selectedSymbol,
          exchange: 'NSE',
          segment: 'OPTIONS',
          instrumentKey: matchPos.instrumentKey || selectedInstrumentKey,
          ltp,
          change: Number(diff.toFixed(2)),
          changePercent: Number(diffPct.toFixed(2)),
          volume: 0,
          open: buy,
          high: Math.max(buy, ltp),
          low: Math.min(buy, ltp),
          close: buy,
        } as StockQuote;
      }
      // Fallback: derive quote from display candles for this symbol rather than picking an unrelated stock!
      const lastCandle = candles[candles.length - 1];
      const firstCandle = candles[0];
      const candleLtp = lastCandle?.close || 0;
      const candleOpen = firstCandle?.open || candleLtp;
      const diff = candleLtp - candleOpen;
      const diffPct = candleOpen > 0 ? (diff / candleOpen) * 100 : 0;
      if (candleLtp > 0) {
        return {
          symbol: selectedSymbol,
          name: selectedSymbol,
          exchange: 'NSE',
          segment: 'EQUITY',
          instrumentKey: selectedInstrumentKey,
          ltp: candleLtp,
          change: Number(diff.toFixed(2)),
          changePercent: Number(diffPct.toFixed(2)),
          volume: lastCandle?.volume || 0,
          open: candleOpen,
          high: candleLtp,
          low: candleLtp,
          close: candleOpen,
        } as StockQuote;
      }
      return quotes[0];
    })();
  return quote;
}
