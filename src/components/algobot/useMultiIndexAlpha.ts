// Polls the multi-index alpha endpoint that feeds the index radar cards.
import { useEffect, useState } from 'react';
import type { MultiIndexAlphaItem } from '../../types';

export function useMultiIndexAlpha(pollMs = 4000) {
  const [multiIndexData, setMultiIndexData] = useState<MultiIndexAlphaItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    let inFlight = false;
    let activeController: AbortController | null = null;

    const fetchMultiIndex = async () => {
      if (inFlight) return;
      inFlight = true;
      const ctrl = new AbortController();
      activeController = ctrl;
      const timer = setTimeout(() => ctrl.abort(), 5000);
      try {
        const res = await fetch('/api/bot/multi-index-alpha', { signal: ctrl.signal });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data) && data.length > 0) {
            setMultiIndexData(data);
          }
        }
      } catch {
        // ignored: next poll retries
      } finally {
        clearTimeout(timer);
        if (activeController === ctrl) activeController = null;
        inFlight = false;
      }
    };

    fetchMultiIndex();
    const interval = setInterval(fetchMultiIndex, pollMs);
    return () => {
      isMounted = false;
      activeController?.abort();
      clearInterval(interval);
    };
  }, [pollMs]);

  return { multiIndexData };
}
