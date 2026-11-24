import { useCallback } from 'react';
import type { BotConfig, ExecutionMode } from '../types';
import { safeStorage } from '../utils/storage';

const INDEX_PRIORITY_MAP: Record<string, string> = {
  'NIFTY 50': 'NIFTY_50_ONLY',
  BANKNIFTY: 'BANKNIFTY_ONLY',
  SENSEX: 'SENSEX_ONLY',
  FINNIFTY: 'FINNIFTY_ONLY',
  MIDCPNIFTY: 'MIDCPNIFTY_ONLY',
  BANKEX: 'BANKEX_ONLY',
};

const persistBotConfig = (updated: BotConfig) => {
  fetch('/api/bot/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  }).catch(() => {
    /* ignore */
  });
};

interface ShellActionsParams {
  setMode: (mode: ExecutionMode) => void;
  setBotConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
}

/** Shell-level handlers that mirror UI changes into the backend bot config. */
export function useAppShellActions({ setMode, setBotConfig }: ShellActionsParams) {
  const handleModeChange = useCallback(
    (newMode: ExecutionMode) => {
      safeStorage.setItem('aizabiz_preferred_trading_mode', newMode);
      setMode(newMode);
      setBotConfig((prev) => {
        const updated = { ...prev, mode: newMode };
        persistBotConfig(updated);
        return updated;
      });
    },
    [setMode, setBotConfig],
  );

  const handleToggleBot = useCallback(() => {
    setBotConfig((prev) => {
      const updated = { ...prev, enabled: !prev.enabled, dailyLossLocked: false };
      persistBotConfig(updated);
      return updated;
    });
  }, [setBotConfig]);

  const handleIndexFocus = useCallback(
    (symbol: string) => {
      const priority = INDEX_PRIORITY_MAP[symbol];
      if (!priority) return;
      setBotConfig((prev) => {
        const updated = {
          ...prev,
          selectedIndexPriority: priority as BotConfig['selectedIndexPriority'],
        };
        persistBotConfig(updated);
        return updated;
      });
    },
    [setBotConfig],
  );

  return { handleModeChange, handleToggleBot, handleIndexFocus };
}
