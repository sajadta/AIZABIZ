import { useEffect } from 'react';

const WAKEUP_INTERVAL_MS = 4 * 60 * 1000;

// Pings the backend periodically so a cold-started server stays awake.
export const useServerWakeup = () => {
  useEffect(() => {
    const ctrl = new AbortController();
    const triggerWakeup = () => {
      fetch(`/api/wakeup?t=${Date.now()}`, { cache: 'no-store', signal: ctrl.signal }).catch(() => {
        /* ignore */
      });
    };
    triggerWakeup();
    const wakeupInterval = setInterval(triggerWakeup, WAKEUP_INTERVAL_MS);
    return () => {
      ctrl.abort();
      clearInterval(wakeupInterval);
    };
  }, []);
};
