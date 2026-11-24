import { useCallback, useEffect } from 'react';
import type { PriceAlert, StockQuote } from '../types';
import { soundEngine } from '../utils/audioAlerts';

interface UsePriceAlertsParams {
  quotes: StockQuote[];
  priceAlerts: PriceAlert[];
  soundEnabled: boolean;
  setPriceAlerts: React.Dispatch<React.SetStateAction<PriceAlert[]>>;
}

export const usePriceAlerts = ({
  quotes,
  priceAlerts,
  soundEnabled,
  setPriceAlerts,
}: UsePriceAlertsParams) => {
  useEffect(() => {
    if (quotes.length === 0) return;
    setPriceAlerts((prev) => {
      if (prev.length === 0) return prev;
      let triggered = false;
      const updated = prev.map((alert) => {
        if (!alert.isActive) return alert;
        const q = quotes.find((item) => item.symbol === alert.symbol);
        if (!q) return alert;
        const isHit =
          (alert.condition === 'GREATER_THAN' && q.ltp >= alert.targetPrice) ||
          (alert.condition === 'LESS_THAN' && q.ltp <= alert.targetPrice);
        if (isHit) {
          triggered = true;
          return { ...alert, isActive: false };
        }
        return alert;
      });

      if (!triggered) return prev;
      if (soundEnabled) {
        queueMicrotask(() => soundEngine.play('ALERT'));
      }
      return updated;
    });
  }, [quotes, soundEnabled, setPriceAlerts]);

  const handleAddAlert = useCallback(
    (
      symbol: string,
      instrumentKey: string,
      targetPrice: number,
      condition: 'GREATER_THAN' | 'LESS_THAN',
    ) => {
      const newAlert: PriceAlert = {
        id: `alert_${Date.now()}`,
        symbol,
        instrumentKey,
        targetPrice,
        condition,
        isActive: true,
      };
      setPriceAlerts((prev) => [...prev, newAlert]);
    },
    [setPriceAlerts],
  );

  const handleRemoveAlert = useCallback(
    (id: string) => {
      setPriceAlerts((prev) => prev.filter((a) => a.id !== id));
    },
    [setPriceAlerts],
  );

  return { handleAddAlert, handleRemoveAlert, priceAlerts };
};
