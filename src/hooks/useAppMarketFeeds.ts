// Market feed wiring for the app root: wakeup heartbeat, live quotes SSE, candles,
// selected-quote derivation and candle tick merging.
import { useRef, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import type { CandleData, ChartTradeContext, Position, StockQuote } from '../types';
import { deriveCurrentQuote } from '../utils/currentQuote';
import { useServerWakeup } from './useServerWakeup';
import { useLiveQuotes } from './useLiveQuotes';
import { useChartCandles } from './useChartCandles';
import { useChartTradeContextSync, useCandleTickSync } from './useAppChartSync';

export interface AppMarketFeedsParams {
  accessToken: string;
  selectedSymbol: string;
  selectedInstrumentKey: string;
  chartInterval: string;
  chartTradeContext: ChartTradeContext | null;
  quotes: StockQuote[];
  candles: CandleData[];
  positions: Position[];
  setQuotes: Dispatch<SetStateAction<StockQuote[]>>;
  setIsWsConnected: Dispatch<SetStateAction<boolean>>;
  setCandles: Dispatch<SetStateAction<CandleData[]>>;
  setChartTradeContext: (
    updater: (prev: ChartTradeContext | null) => ChartTradeContext | null,
  ) => void;
}

export interface AppMarketFeeds {
  currentQuote: StockQuote;
  lastSseQuoteAtRef: MutableRefObject<number>;
}

export const useAppMarketFeeds = ({
  accessToken,
  selectedSymbol,
  selectedInstrumentKey,
  chartInterval,
  chartTradeContext,
  quotes,
  candles,
  positions,
  setQuotes,
  setIsWsConnected,
  setCandles,
  setChartTradeContext,
}: AppMarketFeedsParams): AppMarketFeeds => {
  const lastSseQuoteAtRef = useRef<number>(0);

  // Server wakeup heartbeat
  useServerWakeup();

  // Live Upstox quotes via SSE with resilient HTTP fallback
  useLiveQuotes({
    accessToken,
    lastSseQuoteAtRef,
    setQuotes,
    setIsWsConnected,
  });

  // Upstox candlesticks and technical indicators
  useChartCandles({
    accessToken,
    selectedSymbol,
    selectedInstrumentKey,
    chartInterval,
    setCandles,
  });

  useChartTradeContextSync({ positions, candles, chartTradeContext, setChartTradeContext });

  // Only fold a tick into the latest candle when the price belongs to the same instrument scale.
  const currentQuote = deriveCurrentQuote({
    quotes,
    selectedSymbol,
    selectedInstrumentKey,
    chartTradeContext,
    positions,
    candles,
  });

  useCandleTickSync({ currentQuote, setCandles });

  return { currentQuote, lastSseQuoteAtRef };
};
