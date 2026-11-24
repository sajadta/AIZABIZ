import { useEffect } from 'react';
import type { BotLog, TradingSignal } from '../types';
import { safeStorage } from '../utils/storage';

interface UseBackendBotSyncParams {
  accessToken: string;
  selectedSymbol: string;
  lastLivePositionsAtRef: React.MutableRefObject<number>;
  fetchLivePositions: () => void | Promise<void>;
  setBotLogs: React.Dispatch<React.SetStateAction<BotLog[]>>;
  setSignals: React.Dispatch<React.SetStateAction<TradingSignal[]>>;
  setActiveSignal: React.Dispatch<React.SetStateAction<TradingSignal | null>>;
}

// Polls the 200ms server engine for authoritative bot logs and signals.
// All automated entries/exits happen server-side, so the UI only mirrors state.
export const useBackendBotSync = ({
  accessToken,
  selectedSymbol,
  lastLivePositionsAtRef,
  fetchLivePositions,
  setBotLogs,
  setSignals,
  setActiveSignal,
}: UseBackendBotSyncParams) => {
  useEffect(() => {
    let isMounted = true;
    let inFlightSync = false;
    let activeCtrl: AbortController | null = null;

    const syncBackendBotState = async () => {
      if (!isMounted || inFlightSync) return;
      inFlightSync = true;
      const ctrl = new AbortController();
      activeCtrl = ctrl;
      const timeoutId = setTimeout(() => ctrl.abort(), 5000);
      try {
        const token = accessToken || safeStorage.getItem('upstox_daily_token') || '';
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const [logsRes, sigsRes] = await Promise.allSettled([
          fetch('/api/bot/logs', { headers, signal: ctrl.signal }).then((r) =>
            r.ok ? r.json() : null,
          ),
          fetch('/api/bot/signals', { headers, signal: ctrl.signal }).then((r) =>
            r.ok ? r.json() : null,
          ),
        ]);

        if (!isMounted || ctrl.signal.aborted) return;

        if (logsRes.status === 'fulfilled' && Array.isArray(logsRes.value)) {
          const nextLogs = logsRes.value.map((l: any) => ({
            id: l.id || String(Date.now()),
            timestamp: l.timestamp || l.time || new Date().toLocaleTimeString(),
            message: l.message || '',
            type: l.type || 'INFO',
          }));
          setBotLogs((prev) => {
            if (prev.length === 0 && nextLogs.length === 0) return prev;
            if (prev.length === nextLogs.length && prev[0]?.id === nextLogs[0]?.id) return prev;
            return nextLogs;
          });
        }
        if (
          sigsRes.status === 'fulfilled' &&
          Array.isArray(sigsRes.value) &&
          sigsRes.value.length > 0
        ) {
          setSignals(sigsRes.value);
          // Match the signal for the currently selected symbol (e.g. NIFTY 50), instead of taking index 0
          const matchingSig = sigsRes.value.find(
            (s: any) =>
              s.symbol?.includes(selectedSymbol) ||
              s.name?.includes(selectedSymbol) ||
              (selectedSymbol.includes('NIFTY 50') &&
                s.symbol?.includes('NIFTY') &&
                !s.symbol?.includes('BANK') &&
                !s.symbol?.includes('FIN')) ||
              (selectedSymbol.includes('BANK') && s.symbol?.includes('BANK')) ||
              (selectedSymbol.includes('SENSEX') && s.symbol?.includes('SENSEX')),
          );
          setActiveSignal(matchingSig || sigsRes.value[0]);
        }
      } catch {
        // Ignored
      } finally {
        clearTimeout(timeoutId);
        if (activeCtrl === ctrl) activeCtrl = null;
        inFlightSync = false;
      }

      if (isMounted && Date.now() - lastLivePositionsAtRef.current > 1800) {
        fetchLivePositions();
      }
    };

    syncBackendBotState();
    const botSyncInterval = setInterval(syncBackendBotState, 2500);
    return () => {
      isMounted = false;
      activeCtrl?.abort();
      clearInterval(botSyncInterval);
    };
  }, [
    accessToken,
    fetchLivePositions,
    selectedSymbol,
    lastLivePositionsAtRef,
    setBotLogs,
    setSignals,
    setActiveSignal,
  ]);
};
