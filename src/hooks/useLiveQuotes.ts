import { useEffect } from 'react';
import type { StockQuote } from '../types';
import { deduplicateQuotes } from '../utils/quotes';
import { safeStorage } from '../utils/storage';
import { INITIAL_WATCHLIST_SYMBOLS } from '../data/initialWatchlist';

interface UseLiveQuotesParams {
  accessToken: string;
  lastSseQuoteAtRef: React.MutableRefObject<number>;
  setQuotes: React.Dispatch<React.SetStateAction<StockQuote[]>>;
  setIsWsConnected: React.Dispatch<React.SetStateAction<boolean>>;
}

// Streams live quotes over SSE and falls back to HTTP polling when the stream stalls.
export const useLiveQuotes = ({
  accessToken,
  lastSseQuoteAtRef,
  setQuotes,
  setIsWsConnected,
}: UseLiveQuotesParams) => {
  useEffect(() => {
    let isMounted = true;
    let inFlightQuotes = false;
    let activeQuotesCtrl: AbortController | null = null;
    const updateQuotes = async (force = false) => {
      if (!isMounted || inFlightQuotes) return;
      if (!force && Date.now() - lastSseQuoteAtRef.current < 2800) {
        return;
      }
      inFlightQuotes = true;
      const ctrl = new AbortController();
      activeQuotesCtrl = ctrl;
      const timeoutId = setTimeout(() => ctrl.abort(), 5000);
      try {
        const token = accessToken || safeStorage.getItem('upstox_daily_token') || '';
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch('/api/market/quotes', { headers, signal: ctrl.signal });
        if (res.ok && isMounted) {
          const data = await res.json();
          const quotesList = Array.isArray(data)
            ? data
            : Array.isArray(data?.quotes)
              ? data.quotes
              : null;
          if (quotesList && quotesList.length > 0 && isMounted) {
            const uniqueQuotes = deduplicateQuotes([...quotesList, ...INITIAL_WATCHLIST_SYMBOLS]);
            setQuotes(uniqueQuotes);
            setIsWsConnected(true);
            return;
          }
        } else if (isMounted) {
          setIsWsConnected(false);
        }
      } catch {
        if (isMounted && !ctrl.signal.aborted) setIsWsConnected(false);
      } finally {
        clearTimeout(timeoutId);
        if (activeQuotesCtrl === ctrl) activeQuotesCtrl = null;
        inFlightQuotes = false;
      }
    };

    updateQuotes(true);
    const timer = setInterval(() => updateQuotes(false), 3500);

    // Subscribe to SSE (/api/stream/quotes) for real-time tick streaming
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/stream/quotes');
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (
            msg.type === 'QUOTES' &&
            Array.isArray(msg.data) &&
            msg.data.length > 0 &&
            isMounted
          ) {
            lastSseQuoteAtRef.current = Date.now();
            const uniqueQuotes = deduplicateQuotes([...msg.data, ...INITIAL_WATCHLIST_SYMBOLS]);
            setQuotes(uniqueQuotes);
            setIsWsConnected(true);
          }
        } catch {
          // Ignored
        }
      };
    } catch {
      // Ignored
    }

    return () => {
      isMounted = false;
      clearInterval(timer);
      activeQuotesCtrl?.abort();
      if (es) es.close();
    };
  }, [accessToken, lastSseQuoteAtRef, setQuotes, setIsWsConnected]);
};
