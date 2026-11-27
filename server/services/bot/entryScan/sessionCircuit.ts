// Session trade bookkeeping and circuit-breaker metrics for the entry scan.
import { botConfig, paperTradeHistory, getCachedUpstoxLiveMargin } from '../../../state';
import { calculateTradeCharges } from '../../../../src/utils/indicators';
import { pairLiveDayOrders, getCachedLiveDayOrders } from '../../../lib/upstoxHistory';
import { getPaperInitialCapital } from '../../persistence';

export interface LiveDayClosedTrades {
  timestamp: number;
  token: string;
  trades: any[];
}

export function getTradeNetPnL(trade: any): number {
  if (typeof trade.netRealizedPnL === 'number' && Number.isFinite(trade.netRealizedPnL)) {
    return trade.netRealizedPnL;
  }
  const gross = Number(trade.realizedPnL || 0);
  const qty = Math.max(1, Number(trade.quantity || 1));
  const charges =
    Number(trade.brokerageCharges || 0) > 0
      ? Number(trade.brokerageCharges)
      : calculateTradeCharges(
          Number(trade.buyPrice || 0),
          qty,
          trade.isOption !== false,
          Number(trade.sellPrice || trade.buyPrice || 0),
        ).roundTripCharges;
  return Number((gross - charges).toFixed(2));
}

// Refreshes the LIVE day-orders cache (8s TTL) so the circuit breaker survives restarts.
export async function refreshLiveDayClosedTrades(
  cache: LiveDayClosedTrades,
  token: string,
): Promise<LiveDayClosedTrades> {
  if (
    botConfig.mode === 'UPSTOX_LIVE' &&
    token &&
    (cache.token !== token || Date.now() - cache.timestamp > 8000)
  ) {
    try {
      const dayOrdersData = await getCachedLiveDayOrders(token, 4000);
      if (Array.isArray(dayOrdersData) && dayOrdersData.length > 0) {
        const pairedLive = pairLiveDayOrders(dayOrdersData).filter((t) => t.isOption !== false);
        return { timestamp: Date.now(), token, trades: pairedLive };
      }
    } catch {
      // Retain last cached day trades on transient fetch hiccup
    }
  }
  return cache;
}

export interface SessionCircuitMetrics {
  resetCutoff: number;
  activeSessionTrades: any[];
  todayOptionLossCount: number;
  maxAllowedOptionLosses: number;
  todayRealizedPnL: number;
  liveOrPaperCapForCircuit: number;
  isSmallCapForCircuit: boolean;
  dynamicDailyLossLimit: number;
}

export function computeSessionCircuitMetrics(cache: LiveDayClosedTrades): SessionCircuitMetrics {
  const todayMidnightIst = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
  );
  todayMidnightIst.setHours(0, 0, 0, 0);
  const todayStartMs = todayMidnightIst.getTime();
  const resetCutoff = Math.max(Number((botConfig as any).circuitBreakerResetAt || 0), todayStartMs);

  const localSessionTrades = paperTradeHistory.filter((trade) => {
    const closeTs = trade.closeTime ? new Date(trade.closeTime).getTime() : 0;
    const modeMatches = !trade.mode || trade.mode === botConfig.mode;
    return closeTs >= resetCutoff && modeMatches;
  });

  const liveSyncedTrades =
    botConfig.mode === 'UPSTOX_LIVE'
      ? cache.trades.filter((trade) => {
          const closeTs = trade.closeTime ? new Date(trade.closeTime).getTime() : 0;
          return closeTs >= resetCutoff;
        })
      : [];

  // Prefer Upstox Exchange closed trades in LIVE mode, merging any local trades not yet matched
  const activeSessionTrades =
    botConfig.mode === 'UPSTOX_LIVE' && liveSyncedTrades.length > 0
      ? [
          ...liveSyncedTrades,
          ...localSessionTrades.filter((lt) => {
            const ltTs = lt.closeTime ? new Date(lt.closeTime).getTime() : 0;
            const ltSym = String(lt.symbol || '')
              .replace(/\s+/g, '')
              .toUpperCase();
            return !liveSyncedTrades.some((st) => {
              const stTs = st.closeTime ? new Date(st.closeTime).getTime() : 0;
              const stSym = String(st.symbol || '')
                .replace(/\s+/g, '')
                .toUpperCase();
              return stSym === ltSym && Math.abs(stTs - ltTs) <= 90000;
            });
          }),
        ]
      : localSessionTrades;

  // Count ALL net losses (including ₹72 Upstox brokerage) so small-gross losses aren't disguised as wins!
  const todayOptionLossCount = activeSessionTrades.filter(
    (trade) => getTradeNetPnL(trade) < 0,
  ).length;
  const maxAllowedOptionLosses = Math.min(
    10,
    Math.max(2, Number(botConfig.maxOptionLossCount || 3)),
  );
  const todayRealizedPnL = Number(
    activeSessionTrades.reduce((acc, trade) => acc + getTradeNetPnL(trade), 0).toFixed(2),
  );
  const paperCapitalBase = getPaperInitialCapital();
  const paperSessionPnL = paperTradeHistory
    .filter((t: any) => !t.mode || t.mode === 'PAPER_TRADING')
    .reduce((sum: number, t: any) => sum + getTradeNetPnL(t), 0);
  const liveMarginInfo = getCachedUpstoxLiveMargin();
  const liveTotalAccountEquity =
    Number(liveMarginInfo.margin || 0) + Math.max(0, Number(liveMarginInfo.utilizedMargin || 0));
  const liveOrPaperCapForCircuit =
    botConfig.mode === 'UPSTOX_LIVE'
      ? liveTotalAccountEquity > 0
        ? liveTotalAccountEquity
        : paperCapitalBase
      : Math.max(500, paperCapitalBase + paperSessionPnL);
  const isSmallCapForCircuit = liveOrPaperCapForCircuit <= 4000;
  const dynamicDailyLossLimit = isSmallCapForCircuit
    ? Math.min(
        Number(botConfig.dailyMaxLossLimit || 800),
        Math.max(350, Math.round(liveOrPaperCapForCircuit * 0.45)),
      )
    : Number(botConfig.dailyMaxLossLimit || 1500);

  // Circuit Breaker locks permanently disabled per user instruction ("Sercute lock ozhivakkuka")
  botConfig.dailyLossLocked = false;

  return {
    resetCutoff,
    activeSessionTrades,
    todayOptionLossCount,
    maxAllowedOptionLosses,
    todayRealizedPnL,
    liveOrPaperCapForCircuit,
    isSmallCapForCircuit,
    dynamicDailyLossLimit,
  };
}
