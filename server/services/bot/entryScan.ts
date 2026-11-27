// Bot entry-scan phase: circuit-breaker gating, market-hours checks, signal
// generation and live/paper order placement for new trades.
import {
  botConfig,
  botSignals,
  paperPositions,
  paperTradeHistory,
  recentClosedStrikes,
  getLastFullEntryScanAtMs,
  setLastFullEntryScanAtMs,
  getLastTradeExitTime,
  getCachedUpstoxLiveMargin,
  setCachedUpstoxLiveMargin,
  setLatestMultiIndexAlphaMatrix,
} from '../../state';
import { resilientFetchJson } from '../../lib/http';
import { parseUpstoxFundsData } from '.././upstoxTransport';
import { getPaperInitialCapital } from '.././persistence';

import {
  refreshLiveDayClosedTrades,
  computeSessionCircuitMetrics,
  getTradeNetPnL,
} from './entryScan/sessionCircuit';
import { computeEffectiveCapital } from './entryScan/capitalSizing';
import { resolveScanIndices } from './entryScan/scanIndices';
import { rankAlphaCandidates } from './entryScan/alphaMatrix';
import { executeTopCandidates } from './entryScan/executeCandidates';
import { scanIndexCandidates } from './entryScan/scanIndexCandidates';

let cachedLiveDayClosedTrades: { timestamp: number; token: string; trades: any[] } = {
  timestamp: 0,
  token: '',
  trades: [],
};

export async function runEntryScan(ctx: {
  token: string;
  activePositions: any[];
  liveQuotesMap: any;
  nowIst: Date;
}): Promise<void> {
  const { token, activePositions, liveQuotesMap, nowIst } = ctx;
  cachedLiveDayClosedTrades = await refreshLiveDayClosedTrades(cachedLiveDayClosedTrades, token);

  const {
    resetCutoff,
    activeSessionTrades,
    todayOptionLossCount,
    maxAllowedOptionLosses,
    todayRealizedPnL,
    liveOrPaperCapForCircuit,
    isSmallCapForCircuit,
    dynamicDailyLossLimit,
  } = computeSessionCircuitMetrics(cachedLiveDayClosedTrades);

  // Ultra-fast 30s exchange settlement buffer ONLY (no 10-minute cooldown block!)
  // Quality gates (chop filter, VWAP/MTF alignment, anti-chase) prevent bad entries directly while letting profitable setups run immediately.
  const nowCooldownCheckMs = Date.now();
  const latestLiveExitTrade = activeSessionTrades
    .map((t: any) => ({
      ts: t.closeTime ? new Date(t.closeTime).getTime() : 0,
      net: getTradeNetPnL(t),
    }))
    .sort((a: any, b: any) => b.ts - a.ts)[0];
  const latestClosedMeta = Object.values(recentClosedStrikes).sort(
    (a: any, b: any) => (b?.exitTime || 0) - (a?.exitTime || 0),
  )[0] as any;
  const effectiveLastExitMs = Math.max(
    getLastTradeExitTime(),
    latestLiveExitTrade?.ts || 0,
    latestClosedMeta?.exitTime || 0,
  );
  const requiredCooldownMs = 30000;
  const isInPostExitCooldown =
    effectiveLastExitMs > 0 && nowCooldownCheckMs - effectiveLastExitMs < requiredCooldownMs;

  // Check Market Open Time Window (09:15 AM to 15:15 PM IST for NEW NSE/BSE Options entries on Trading Days Monday-Friday)
  const currentHour = nowIst.getHours();
  const currentMinute = nowIst.getMinutes();
  const currentDay = nowIst.getDay(); // 0: Sun, 6: Sat
  const isTradingDay = currentDay >= 1 && currentDay <= 5;
  const isNseTradingHours =
    (currentHour > 9 || (currentHour === 9 && currentMinute >= 15)) &&
    (currentHour < 15 || (currentHour === 15 && currentMinute <= 15));
  const isTradingHours = isNseTradingHours;

  const scanIntervalMs = token ? 600 : 5000;
  const elapsedSinceLastScan = Date.now() - getLastFullEntryScanAtMs();
  const shouldRunEntryScanThisTick =
    elapsedSinceLastScan >= scanIntervalMs ||
    (botSignals.length === 0 && elapsedSinceLastScan >= 2500);
  if ((token || botConfig.mode === 'PAPER_TRADING') && shouldRunEntryScanThisTick) {
    setLastFullEntryScanAtMs(Date.now());
    // Fetch live Upstox available margin (cached 5s to avoid 429 on 200ms loop)
    let liveAvailableMargin = getCachedUpstoxLiveMargin().margin;
    if (token && Date.now() - getCachedUpstoxLiveMargin().timestamp > 5000) {
      try {
        const fundsData: any = await resilientFetchJson(
          'https://api.upstox.com/v2/user/get-funds-and-margin?segment=SEC',
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
              'Api-Version': '2.0',
            },
          },
          1,
          4000,
        );
        if (fundsData?.status === 'success' && fundsData?.data) {
          const parsedFunds = parseUpstoxFundsData(fundsData);
          liveAvailableMargin = parsedFunds.usableCash;
          setCachedUpstoxLiveMargin({
            timestamp: Date.now(),
            margin: liveAvailableMargin,
            utilizedMargin: parsedFunds.utilizedMargin,
            payin: parsedFunds.payin,
            payout: parsedFunds.payout,
          });
        }
      } catch {
        // Ignored
      }
    }

    // Strict capital separation: UPSTOX_LIVE uses only real Upstox cash, PAPER uses virtual funds.
    // A manual override (> 0) caps either source.
    const configuredCap = Number((botConfig as any).maxCapitalPerTrade || 0);
    const effectiveCapital = computeEffectiveCapital({
      mode: botConfig.mode,
      configuredCap,
      liveAvailableMargin,
      initialCapital: getPaperInitialCapital(),
      openPaperPositions: paperPositions,
      paperTradeHistory,
    });

    const scanIndices = resolveScanIndices(botConfig);

    // PASS 1: Collect verified real option candidates across all scanned indices to compare institutional alpha
    const marketAlphaCandidates: any[] = [];
    const currentTickMultiIndexComparison: any[] = [];
    const todayTrades = paperTradeHistory.filter(
      (t: any) => t.closeTime && t.closeTime.startsWith(new Date().toISOString().slice(0, 10)),
    );
    const todayCompletedCount = todayTrades.length;
    const todayNetPnL = todayTrades.reduce(
      (acc: number, t: any) => acc + (t.netRealizedPnL ?? t.realizedPnL ?? 0),
      0,
    );
    const todayWins = todayTrades.filter(
      (t: any) => (t.netRealizedPnL ?? t.realizedPnL ?? 0) > 0,
    ).length;

    // Continuous Trading Engine: No artificial daily trade limit cap
    const isDailyTradeLimitReached = false;
    const userConfiguredMax = Number((botConfig as any).maxConcurrentTrades ?? 0);
    const balanceBasedMax = Math.max(
      1,
      Math.min(5, Math.floor(effectiveCapital / (botConfig.mode === 'UPSTOX_LIVE' ? 5000 : 3500))),
    );
    const maxAllowedConcurrent = userConfiguredMax === 0 ? balanceBasedMax : userConfiguredMax;
    // console.log("[ENTRY SCAN] Starting scan for", scanIndices.map(s => s.symbol));

    await scanIndexCandidates({
      token,
      scanIndices,
      activePositions,
      activeSessionTrades,
      liveQuotesMap,
      effectiveCapital,
      isDailyTradeLimitReached,
      isInPostExitCooldown,
      isTradingDay,
      isTradingHours,
      marketAlphaCandidates,
      currentTickMultiIndexComparison,
    });

    // Update global multi-index comparative alpha matrix & rank indices
    if (currentTickMultiIndexComparison.length > 0) {
      setLatestMultiIndexAlphaMatrix(rankAlphaCandidates(currentTickMultiIndexComparison));
    }

    // PASS 2: Multi-Index Alpha Comparison & Execution of the #1 Most Profitable Setup
    await executeTopCandidates({
      token,
      marketAlphaCandidates,
      activePositions,
      maxAllowedConcurrent,
      isDailyTradeLimitReached,
      isInPostExitCooldown,
      isTradingDay,
      isTradingHours,
      liveAvailableMargin,
    });
  }
}
