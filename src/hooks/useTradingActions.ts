import { useCallback } from 'react';
import type { BotLog, ExecutionMode, Language, Order, Position } from '../types';
import { safeStorage } from '../utils/storage';
import { soundEngine } from '../utils/audioAlerts';
import type { LightingAlertBannerState } from '../utils/soundAlerts';

interface UseTradingActionsParams {
  positions: Position[];
  mode: ExecutionMode;
  language: Language;
  soundEnabled: boolean;
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setTradeHistory: React.Dispatch<React.SetStateAction<Position[]>>;
  setBotLogs: React.Dispatch<React.SetStateAction<BotLog[]>>;
  setLightingBanner: React.Dispatch<React.SetStateAction<LightingAlertBannerState | null>>;
  setIsResetConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEquityExitConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fetchHistory: () => void | Promise<void>;
}

const authHeaders = (withJsonBody = false): Record<string, string> => {
  const headers: Record<string, string> = withJsonBody
    ? { 'Content-Type': 'application/json' }
    : {};
  const savedTok = safeStorage.getItem('upstox_daily_token');
  if (savedTok && savedTok.length > 30) {
    headers['Authorization'] = `Bearer ${savedTok}`;
  }
  return headers;
};

const pushLog = (
  setBotLogs: UseTradingActionsParams['setBotLogs'],
  message: string,
  type: 'SUCCESS' | 'ERROR',
) =>
  setBotLogs((prev) => [
    { id: Date.now().toString(), timestamp: new Date().toLocaleTimeString(), message, type },
    ...prev.slice(0, 199),
  ]);

export const useTradingActions = ({
  positions,
  mode,
  language,
  soundEnabled,
  setPositions,
  setOrders,
  setTradeHistory,
  setBotLogs,
  setLightingBanner,
  setIsResetConfirmOpen,
  setIsEquityExitConfirmOpen,
  fetchHistory,
}: UseTradingActionsParams) => {
  // Square off a single position (paper and Upstox live alike).
  const handleSquareOffPosition = useCallback(
    async (id: string) => {
      const pos = positions.find((p) => p.id === id);
      if (!pos) return;

      const sellPrice = pos.currentLTP;
      const grossPnL = (sellPrice - pos.buyPrice) * pos.quantity;
      const posMode = pos.mode || mode;

      try {
        const res = await fetch(`/api/trading/squareoff/${encodeURIComponent(pos.id)}`, {
          method: 'POST',
          headers: authHeaders(true),
          body: JSON.stringify({
            mode: posMode,
            symbol: pos.symbol,
            instrumentKey: pos.instrumentKey,
            quantity: pos.quantity,
            productType: pos.productType,
            type: pos.type,
            sellPrice,
          }),
        });
        const data = await res.json();
        if (posMode === 'UPSTOX_LIVE' && !data.success) {
          pushLog(
            setBotLogs,
            `[SQUARE-OFF ERROR] ${data.error || 'Could not square off live position on Upstox'}`,
            'ERROR',
          );
          return;
        }
      } catch {
        // Ignored: still close the local position below
      }

      const closedPos: Position = {
        ...pos,
        sellPrice,
        realizedPnL: grossPnL,
        closeTime: new Date().toISOString(),
      };

      setPositions((prev) => prev.filter((p) => p.id !== id));
      setTradeHistory((prev) => [closedPos, ...prev]);

      const exitOrder: Order = {
        id: `ord_${Date.now()}`,
        orderId: `UP_${Date.now().toString().slice(-6)}`,
        symbol: pos.symbol,
        instrumentKey: pos.instrumentKey,
        transactionType: 'SELL',
        orderType: 'MARKET',
        productType: pos.productType,
        quantity: pos.quantity,
        price: sellPrice,
        executedPrice: sellPrice,
        status: 'COMPLETE',
        timestamp: new Date().toLocaleTimeString(),
        mode,
        notes: 'Manual Square-Off',
      };
      setOrders((prev) => [exitOrder, ...prev]);

      if (soundEnabled) {
        soundEngine.play(grossPnL >= 0 ? 'SUCCESS' : 'ALERT');
        if (grossPnL >= 0) {
          soundEngine.speak(
            language === 'ml'
              ? `ലാഭം ₹${grossPnL.toFixed(0)} ബുക്ക് ചെയ്തു!`
              : `Profit of ${grossPnL.toFixed(0)} rupees locked!`,
            language,
          );
        } else {
          soundEngine.speak(
            language === 'ml' ? `സ്റ്റോപ്പ് ലോസ് എക്സിറ്റ് ആയി!` : `Stop loss exit triggered!`,
            language,
          );
        }
      }
    },
    [positions, mode, language, soundEnabled, setPositions, setOrders, setTradeHistory, setBotLogs],
  );

  const handleSquareOffAll = useCallback(() => {
    positions.forEach((p) => handleSquareOffPosition(p.id));
  }, [positions, handleSquareOffPosition]);

  const handleSquareOffEquityOnly = useCallback(() => {
    setIsEquityExitConfirmOpen(true);
  }, [setIsEquityExitConfirmOpen]);

  const confirmSquareOffEquityOnly = useCallback(async () => {
    setIsEquityExitConfirmOpen(false);
    try {
      const res = await fetch('/api/trading/squareoff-equity-only', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return;

      setPositions((prev) =>
        prev.filter((p) => p.isOption || p.symbol.includes('CE') || p.symbol.includes('PE')),
      );
      pushLog(
        setBotLogs,
        language === 'ml'
          ? `✅ ഇന്നത്തെ എല്ലാ ഇക്വിറ്റി ട്രേഡുകളും എക്സിറ്റ് ചെയ്തു. (ഹോൾഡിംഗുകൾ സുരക്ഷിതം)`
          : `✅ Exited all equity trades. (Holdings untouched)`,
        'SUCCESS',
      );
      if (soundEnabled) {
        soundEngine.play('SUCCESS');
        soundEngine.speak(
          language === 'ml' ? 'ഇക്വിറ്റി ട്രേഡുകൾ എക്സിറ്റ് ചെയ്തു' : 'Equity trades exited',
          language,
        );
      }
    } catch (e) {
      console.error('Failed to square off equity only:', e);
    }
  }, [mode, language, soundEnabled, setPositions, setBotLogs, setIsEquityExitConfirmOpen]);

  const handleSyncHistoryBrokerage = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/sync-history-brokerage', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchHistory();
      }
    } catch (err) {
      console.error('Failed to sync history brokerage:', err);
    }
  }, [fetchHistory]);

  const handleResetPaperAccount = useCallback(() => {
    setIsResetConfirmOpen(true);
  }, [setIsResetConfirmOpen]);

  const confirmResetPaperAccount = useCallback(async () => {
    setIsResetConfirmOpen(false);
    try {
      const res = await fetch('/api/paper/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialCapital: 10000 }),
      });
      if (!res.ok) return;

      setOrders([]);
      setPositions([]);
      setTradeHistory([]);
      setBotLogs([]);
      safeStorage.removeItem('aizabiz_persisted_orders_v2');
      safeStorage.removeItem('aizabiz_persisted_trade_history_v2');
      safeStorage.removeItem('aizabiz_persisted_orders_v3');
      safeStorage.removeItem('aizabiz_persisted_trade_history_v3');
      setLightingBanner({
        id: `reset-${Date.now()}`,
        active: true,
        type: 'SUCCESS',
        symbol: 'PAPER',
        titleMl: language === 'ml' ? 'പേപ്പർ അക്കൗണ്ട് റീസെറ്റ് ചെയ്തു' : 'Paper Account Reset',
        subtitleMl:
          language === 'ml'
            ? 'ട്രേഡിംഗ് ഹിസ്റ്ററി ക്ലിയർ ചെയ്ത് ബാലൻസ് ₹10,000 ആയി സെറ്റ് ചെയ്തു.'
            : 'Trade history cleared and balance reset to ₹10,000.',
        colorTheme: 'EMERALD_HIGH',
      });
    } catch (e) {
      console.error('Failed to reset account', e);
    }
  }, [
    language,
    setOrders,
    setPositions,
    setTradeHistory,
    setBotLogs,
    setLightingBanner,
    setIsResetConfirmOpen,
  ]);

  return {
    handleSquareOffPosition,
    handleSquareOffAll,
    handleSquareOffEquityOnly,
    confirmSquareOffEquityOnly,
    handleSyncHistoryBrokerage,
    handleResetPaperAccount,
    confirmResetPaperAccount,
  };
};
