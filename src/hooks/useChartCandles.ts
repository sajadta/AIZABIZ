import { useCallback, useEffect, useRef } from 'react';
import type { CandleData } from '../types';
import { enrichCandlesWithIndicators } from '../utils/indicators';
import { safeStorage } from '../utils/storage';

interface UseChartCandlesParams {
  accessToken: string;
  selectedSymbol: string;
  selectedInstrumentKey: string;
  chartInterval: string;
  setCandles: React.Dispatch<React.SetStateAction<CandleData[]>>;
}

// Polls real Upstox candles for the selected instrument and clears the chart the
// moment the selection changes so price scales never mix between symbols.
export const useChartCandles = ({
  accessToken,
  selectedSymbol,
  selectedInstrumentKey,
  chartInterval,
  setCandles,
}: UseChartCandlesParams) => {
  const candlesInFlightRef = useRef(false);
  const candlesAbortRef = useRef<AbortController | null>(null);
  const fetchRealCandles = useCallback(async () => {
    if (candlesInFlightRef.current) return;
    candlesInFlightRef.current = true;
    const ctrl = new AbortController();
    candlesAbortRef.current = ctrl;
    const timeoutId = setTimeout(() => ctrl.abort(), 5500);

    const token = accessToken || safeStorage.getItem('upstox_daily_token') || '';
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const url = `/api/market/candles?symbol=${encodeURIComponent(selectedSymbol)}&interval=${chartInterval}&instrumentKey=${encodeURIComponent(selectedInstrumentKey)}`;
      const res = await fetch(url, { headers, signal: ctrl.signal });
      if (res.ok && !ctrl.signal.aborted) {
        const json = await res.json();
        if (
          json.success &&
          Array.isArray(json.candles) &&
          json.candles.length > 0 &&
          !ctrl.signal.aborted
        ) {
          const enriched = enrichCandlesWithIndicators(json.candles);
          setCandles(enriched);
          return;
        }
      }
    } catch (e) {
      if (!ctrl.signal.aborted) {
        console.warn('Real candle fetch notice:', e);
      }
    } finally {
      clearTimeout(timeoutId);
      if (candlesAbortRef.current === ctrl) candlesAbortRef.current = null;
      candlesInFlightRef.current = false;
    }
  }, [selectedSymbol, selectedInstrumentKey, chartInterval, accessToken]);

  // Clear stale candles immediately when selectedSymbol or selectedInstrumentKey changes so old symbol's price scale never mixes with new symbol
  useEffect(() => {
    setCandles([]);
  }, [selectedSymbol, selectedInstrumentKey]);

  useEffect(() => {
    fetchRealCandles();
    const candleIntervalTimer = setInterval(fetchRealCandles, 5000);
    return () => {
      candlesAbortRef.current?.abort();
      candlesInFlightRef.current = false;
      clearInterval(candleIntervalTimer);
    };
  }, [fetchRealCandles]);
};
