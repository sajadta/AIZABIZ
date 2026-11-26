import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ExecutionMode, Holding, OptionChainData, Order, Position } from '../types';
import { safeStorage } from '../utils/storage';
import {
  filterLivePositions,
  isSameList,
  mapHoldingRow,
  mapPaperHistory,
  mapPaperOrder,
  mapPaperPosition,
  mergeLiveRows,
} from '../utils/tradingDataMappers';

interface UseTradingDataFetchersParams {
  accessToken?: string;
  isConnected?: boolean;
  mode: ExecutionMode;
  selectedSymbol: string;
  livePositionsInFlightRef: MutableRefObject<Promise<void> | null>;
  lastLivePositionsAtRef: MutableRefObject<number>;
  setOptionChainLoading: Dispatch<SetStateAction<boolean>>;
  setOptionChainData: Dispatch<SetStateAction<OptionChainData | null>>;
  setHoldings: Dispatch<SetStateAction<Holding[]>>;
  setPositions: Dispatch<SetStateAction<Position[]>>;
  setOrders: Dispatch<SetStateAction<Order[]>>;
  setTradeHistory: Dispatch<SetStateAction<Position[]>>;
}

export const useTradingDataFetchers = ({
  accessToken,
  isConnected,
  mode,
  selectedSymbol,
  livePositionsInFlightRef,
  lastLivePositionsAtRef,
  setOptionChainLoading,
  setOptionChainData,
  setHoldings,
  setPositions,
  setOrders,
  setTradeHistory,
}: UseTradingDataFetchersParams) => {
  const fetchOptionChain = useCallback(
    async (expiryOverride?: string, symbolOverride?: string) => {
      setOptionChainLoading(true);
      const token = accessToken || safeStorage.getItem('upstox_daily_token') || '';
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const targetSymbol = symbolOverride || selectedSymbol;
      try {
        const qs = new URLSearchParams({ symbol: targetSymbol });
        if (expiryOverride && typeof expiryOverride === 'string') {
          qs.set('expiry', expiryOverride);
        }
        const res = await fetch(`/api/market/optionchain?${qs.toString()}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data && data.strikes && data.strikes.length > 0) {
            setOptionChainData(data);
            return;
          }
        }
      } catch (e) {
        console.warn('Real option chain fetch notice:', e);
      } finally {
        setOptionChainLoading(false);
      }
    },
    [selectedSymbol, accessToken, setOptionChainLoading, setOptionChainData],
  );

  // Fetch real Upstox long-term holdings
  const fetchHoldings = useCallback(async () => {
    const token = accessToken || safeStorage.getItem('upstox_daily_token') || '';
    if (!token && mode !== 'UPSTOX_LIVE') {
      return;
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch('/api/market/holdings', { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setHoldings(data.map(mapHoldingRow));
        }
      }
    } catch (e) {
      console.warn('Holdings fetch notice:', e);
    }
  }, [accessToken, mode, setHoldings]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const parsed = data.map((t: any) => ({ ...t, mode: t.mode || 'PAPER_TRADING' }));
          setTradeHistory(parsed);
          if (parsed.length === 0) {
            safeStorage.removeItem('aizabiz_persisted_trade_history_v2');
            safeStorage.removeItem('aizabiz_persisted_trade_history_v3');
          }
        }
      }
    } catch {
      // Ignored
    }
  }, [setTradeHistory]);

  // Fetch real Upstox live positions AND Paper Trading positions/orders from backend (coalesced to prevent duplicate bursts)
  const fetchLivePositions = useCallback(async () => {
    if (livePositionsInFlightRef.current) {
      return livePositionsInFlightRef.current;
    }

    const work = (async () => {
      const token = accessToken || safeStorage.getItem('upstox_daily_token') || '';
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        if (mode === 'PAPER_TRADING') {
          const [paperPosRes, paperOrdRes, paperHistRes] = await Promise.allSettled([
            fetch('/api/trading/positions?mode=PAPER_TRADING'),
            fetch('/api/trading/orders?mode=PAPER_TRADING'),
            fetch('/api/trading/history?mode=PAPER_TRADING'),
          ]);

          let paperPosList: Position[] = [];
          if (paperPosRes.status === 'fulfilled' && paperPosRes.value && paperPosRes.value.ok) {
            const pData = await paperPosRes.value.json();
            if (Array.isArray(pData)) {
              paperPosList = pData.map(mapPaperPosition);
            }
          }

          setPositions((prev) =>
            prev.length === 0 && paperPosList.length === 0 ? prev : paperPosList,
          );

          if (paperOrdRes.status === 'fulfilled' && paperOrdRes.value && paperOrdRes.value.ok) {
            const oData = await paperOrdRes.value.json();
            if (Array.isArray(oData)) {
              const parsedOrders: Order[] = oData.map(mapPaperOrder);
              setOrders((prev) =>
                prev.length === 0 && parsedOrders.length === 0
                  ? prev
                  : isSameList(prev, parsedOrders)
                    ? prev
                    : parsedOrders,
              );
              if (parsedOrders.length === 0) {
                safeStorage.removeItem('aizabiz_persisted_orders_v2');
                safeStorage.removeItem('aizabiz_persisted_orders_v3');
              }
            }
          }
          if (paperHistRes.status === 'fulfilled' && paperHistRes.value && paperHistRes.value.ok) {
            const hData = await paperHistRes.value.json();
            if (Array.isArray(hData)) {
              const parsedHistory = mapPaperHistory(hData);
              setTradeHistory((prev) =>
                prev.length === 0 && parsedHistory.length === 0
                  ? prev
                  : isSameList(prev, parsedHistory, 'closeTime')
                    ? prev
                    : parsedHistory,
              );
              if (parsedHistory.length === 0) {
                safeStorage.removeItem('aizabiz_persisted_trade_history_v2');
                safeStorage.removeItem('aizabiz_persisted_trade_history_v3');
              }
            }
          }
        } else if (mode === 'UPSTOX_LIVE' || Boolean(isConnected || token)) {
          // In UPSTOX_LIVE mode, fetch real Upstox positions, order book and trade history
          const [livePosRes, liveOrdRes, liveHistRes] = await Promise.allSettled([
            fetch('/api/market/positions', { headers }),
            fetch('/api/market/orders', { headers }),
            fetch('/api/trading/history?mode=UPSTOX_LIVE', { headers }),
          ]);

          let livePosList: Position[] = [];
          if (livePosRes.status === 'fulfilled' && livePosRes.value && livePosRes.value.ok) {
            const data = await livePosRes.value.json();
            if (Array.isArray(data)) {
              livePosList = filterLivePositions(data);
            }
          }
          setPositions((prev) =>
            prev.length === 0 && livePosList.length === 0 ? prev : livePosList,
          );

          if (liveOrdRes.status === 'fulfilled' && liveOrdRes.value && liveOrdRes.value.ok) {
            const liveOrdData = await liveOrdRes.value.json();
            if (Array.isArray(liveOrdData)) {
              setOrders((prev) => mergeLiveRows(prev, liveOrdData, false));
            }
          }
          if (liveHistRes.status === 'fulfilled' && liveHistRes.value && liveHistRes.value.ok) {
            const liveHistData = await liveHistRes.value.json();
            if (Array.isArray(liveHistData)) {
              setTradeHistory((prev) => mergeLiveRows(prev, liveHistData));
            }
          }
        }
      } catch (e) {
        console.warn('Positions fetch notice:', e);
      } finally {
        lastLivePositionsAtRef.current = Date.now();
        livePositionsInFlightRef.current = null;
      }
    })();

    livePositionsInFlightRef.current = work;
    return work;
  }, [
    accessToken,
    isConnected,
    mode,
    livePositionsInFlightRef,
    lastLivePositionsAtRef,
    setPositions,
    setOrders,
    setTradeHistory,
  ]);
  return { fetchOptionChain, fetchHoldings, fetchHistory, fetchLivePositions };
};
