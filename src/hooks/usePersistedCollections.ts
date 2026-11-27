import { useEffect } from 'react';
import type { Order, Position } from '../types';
import { safeStorage } from '../utils/storage';

const ORDERS_KEY = 'aizabiz_persisted_orders_v3';
const TRADE_HISTORY_KEY = 'aizabiz_persisted_trade_history_v3';

const persist = <T>(key: string, value: T[]) => {
  if (value.length > 0) {
    safeStorage.setJson(key, value);
  } else {
    safeStorage.removeItem(key);
  }
};

// Mirrors orders and trade history into localStorage so a refresh keeps them.
export const usePersistedCollections = (orders: Order[], tradeHistory: Position[]) => {
  useEffect(() => {
    persist(ORDERS_KEY, orders);
  }, [orders]);

  useEffect(() => {
    persist(TRADE_HISTORY_KEY, tradeHistory);
  }, [tradeHistory]);
};
