import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ExecutionMode, Holding, OptionChainData, Order, Position } from '../types';
import { safeStorage } from '../utils/storage';

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
    [selectedSymbol, accessToken],
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
          setHoldings(
            data.map((h: any) => ({
              symbol: h.symbol,
              companyName: h.companyName || h.symbol,
              instrumentKey: h.instrumentKey,
              isin: h.isin,
              quantity: h.quantity,
              avgPrice: h.buyPrice ?? h.avgPrice,
              buyPrice: h.buyPrice ?? h.avgPrice,
              currentLTP: h.currentLTP,
              closePrice: h.closePrice,
              isBuyPriceLocked: h.isBuyPriceLocked,
              isUpstoxZeroPrice: h.isUpstoxZeroPrice,
              investedValue: h.investedValue || (h.quantity || 0) * (h.buyPrice || 0),
              currentValue: h.currentValue || (h.quantity || 0) * (h.currentLTP || 0),
              pnl: h.pnl || (h.currentLTP - (h.buyPrice || h.avgPrice)) * h.quantity,
              pnlPercent:
                h.pnlPercent ||
                (h.buyPrice > 0 ? ((h.currentLTP - h.buyPrice) / h.buyPrice) * 100 : 0),
              fiftyPercentTarget: h.fiftyPercentTarget,
              algoForecast: h.algoForecast,
            })),
          );
        }
      }
    } catch (e) {
      console.warn('Holdings fetch notice:', e);
    }
  }, [accessToken, mode]);

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
  }, []);

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
              paperPosList = pData.map((p: any) => ({
                ...p,
                mode: 'PAPER_TRADING',
                productType: p.productType || 'INTRADAY',
                pnl: Number((p.pnl || 0).toFixed(2)),
                pnlPercent:
                  p.buyPrice > 0
                    ? Number((((p.currentLTP - p.buyPrice) / p.buyPrice) * 100).toFixed(2))
                    : 0,
                openedAt: p.openedAt || new Date().toLocaleTimeString(),
              }));
            }
          }

          setPositions((prev) =>
            prev.length === 0 && paperPosList.length === 0 ? prev : paperPosList,
          );

          if (paperOrdRes.status === 'fulfilled' && paperOrdRes.value && paperOrdRes.value.ok) {
            const oData = await paperOrdRes.value.json();
            if (Array.isArray(oData)) {
              const parsedOrders: Order[] = oData.map((o: any) => ({
                id: o.id || o.orderId,
                orderId: o.orderId || o.id,
                positionId: o.positionId,
                symbol: o.symbol,
                instrumentKey: o.instrumentKey || `NSE_FO|${o.symbol}`,
                transactionType: o.transactionType || o.type || 'BUY',
                orderType: o.orderType || 'MARKET',
                productType: o.productType || 'INTRADAY',
                quantity: o.quantity,
                price: o.price,
                executedPrice: o.executedPrice || o.price,
                buyPrice: o.buyPrice,
                sellPrice: o.sellPrice,
                realizedPnL: o.realizedPnL,
                brokerageCharges: o.brokerageCharges,
                netRealizedPnL: o.netRealizedPnL,
                status: o.status || 'COMPLETE',
                timestamp: o.timestamp || new Date(o.time || Date.now()).toLocaleTimeString(),
                mode: 'PAPER_TRADING',
              }));
              setOrders((prev) => {
                if (prev.length === 0 && parsedOrders.length === 0) return prev;
                if (
                  prev.length === parsedOrders.length &&
                  prev[0]?.id === parsedOrders[0]?.id &&
                  prev[prev.length - 1]?.id === parsedOrders[parsedOrders.length - 1]?.id
                ) {
                  return prev;
                }
                return parsedOrders;
              });
              if (parsedOrders.length === 0) {
                safeStorage.removeItem('aizabiz_persisted_orders_v2');
                safeStorage.removeItem('aizabiz_persisted_orders_v3');
              }
            }
          }
          if (paperHistRes.status === 'fulfilled' && paperHistRes.value && paperHistRes.value.ok) {
            const hData = await paperHistRes.value.json();
            if (Array.isArray(hData)) {
              const parsedHistory = hData
                .map((t: any) => ({ ...t, mode: 'PAPER_TRADING' }))
                .sort((a: any, b: any) => {
                  const tA = new Date(a.closeTime || a.openedAt || 0).getTime();
                  const tB = new Date(b.closeTime || b.openedAt || 0).getTime();
                  return tB - tA;
                });
              setTradeHistory((prev) => {
                if (prev.length === 0 && parsedHistory.length === 0) return prev;
                if (
                  prev.length === parsedHistory.length &&
                  prev[0]?.id === parsedHistory[0]?.id &&
                  prev[0]?.closeTime === parsedHistory[0]?.closeTime
                ) {
                  return prev;
                }
                return parsedHistory;
              });
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
              livePosList = data.filter(
                (p: any) =>
                  p &&
                  Number(p.quantity || 0) > 0 &&
                  !(
                    p.productType === 'DELIVERY' &&
                    p.type === 'SELL' &&
                    !p.isOption &&
                    !String(p.symbol || '').includes('CE') &&
                    !String(p.symbol || '').includes('PE')
                  ),
              );
            }
          }
          setPositions((prev) =>
            prev.length === 0 && livePosList.length === 0 ? prev : livePosList,
          );

          if (liveOrdRes.status === 'fulfilled' && liveOrdRes.value && liveOrdRes.value.ok) {
            const liveOrdData = await liveOrdRes.value.json();
            if (Array.isArray(liveOrdData)) {
              setOrders((prev) => {
                const nonLive = prev.filter((o) => (o.mode || 'PAPER_TRADING') !== 'UPSTOX_LIVE');
                if (liveOrdData.length === 0 && nonLive.length === prev.length) return prev;
                const liveMapped = liveOrdData.map((o: any) => ({
                  ...o,
                  mode: 'UPSTOX_LIVE' as const,
                }));
                return [...liveMapped, ...nonLive];
              });
            }
          }
          if (liveHistRes.status === 'fulfilled' && liveHistRes.value && liveHistRes.value.ok) {
            const liveHistData = await liveHistRes.value.json();
            if (Array.isArray(liveHistData)) {
              setTradeHistory((prev) => {
                const nonLive = prev.filter((t) => (t.mode || 'PAPER_TRADING') !== 'UPSTOX_LIVE');
                if (liveHistData.length === 0 && nonLive.length === prev.length) return prev;
                const liveMapped = liveHistData.map((t: any) => ({
                  ...t,
                  mode: 'UPSTOX_LIVE' as const,
                }));
                return [...liveMapped, ...nonLive].sort((a, b) => {
                  const tA = new Date(a.closeTime || a.openedAt || 0).getTime();
                  const tB = new Date(b.closeTime || b.openedAt || 0).getTime();
                  return tB - tA;
                });
              });
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
  }, [accessToken, isConnected, mode]);
  return { fetchOptionChain, fetchHoldings, fetchHistory, fetchLivePositions };
};
