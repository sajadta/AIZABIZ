import { useEffect } from 'react';
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

      if (triggered && soundEnabled) {
        soundEngine.play('ALERT');
      }
      return updated;
    });
  }, [quotes, soundEnabled, setPriceAlerts]);

  const handleAddAlert = (
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
  };

  const handleRemoveAlert = (id: string) => {
    setPriceAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return { handleAddAlert, handleRemoveAlert, priceAlerts };
};
