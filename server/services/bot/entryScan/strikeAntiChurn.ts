// Per-strike re-entry guard: blocks a strike that was already traded today or
// exited too recently, so the bot cannot churn the same contract.
import { paperTradeHistory, recentClosedStrikes } from '../../../state';
import { getTradeNetPnL } from './sessionCircuit';
import {
  strikeDailyEntryCount,
  STRIKE_LOCKOUT_MS,
  STRIKE_LOSS_LOCKOUT_MS,
  MAX_STRIKE_ENTRIES_DEFAULT,
  MAX_STRIKE_ENTRIES_TRENDING,
} from '../antiChurn';

export interface StrikeChurnCheckParams {
  optionSymbol: string;
  optInstrumentKey: string;
  activeSessionTrades: any[];
}

/** True when the strike must be skipped for the rest of the cooldown window. */
export function isStrikeChurnBlocked({
  optionSymbol,
  optInstrumentKey,
  activeSessionTrades,
}: StrikeChurnCheckParams): boolean {
  const sameStrikeLiveTrades = activeSessionTrades.filter(
    (h: any) =>
      h &&
      (h.symbol === optionSymbol || (optInstrumentKey && h.instrumentKey === optInstrumentKey)),
  );
  const allTradeHist = Array.isArray(paperTradeHistory) ? paperTradeHistory : [];
  const sameStrikeLocalClosed = allTradeHist.find(
    (h: any) =>
      h &&
      (h.symbol === optionSymbol || (optInstrumentKey && h.instrumentKey === optInstrumentKey)),
  );
  const sameStrikeRecent = optInstrumentKey ? recentClosedStrikes[optInstrumentKey] : null;
  const latestSameStrikeTs = Math.max(
    sameStrikeRecent?.exitTime || 0,
    sameStrikeLiveTrades[0]?.closeTime ? new Date(sameStrikeLiveTrades[0].closeTime).getTime() : 0,
    sameStrikeLocalClosed
      ? new Date(sameStrikeLocalClosed.closeTime || sameStrikeLocalClosed.timestamp || 0).getTime()
      : 0,
  );
  const sameStrikeLostLast = sameStrikeRecent
    ? typeof sameStrikeRecent.netRealizedPnL === 'number'
      ? sameStrikeRecent.netRealizedPnL < 0
      : sameStrikeRecent.sellPrice < (sameStrikeRecent.buyPrice || 0)
    : sameStrikeLiveTrades[0]
      ? getTradeNetPnL(sameStrikeLiveTrades[0]) < 0
      : sameStrikeLocalClosed
        ? getTradeNetPnL(sameStrikeLocalClosed) < 0
        : false;
  const totalEntriesForStrike = Math.max(
    optInstrumentKey ? strikeDailyEntryCount[optInstrumentKey] || 0 : 0,
    sameStrikeLiveTrades.length,
  );
  if (
    totalEntriesForStrike >=
    (sameStrikeLostLast ? MAX_STRIKE_ENTRIES_DEFAULT : MAX_STRIKE_ENTRIES_TRENDING)
  ) {
    return true;
  }
  if (latestSameStrikeTs > 0) {
    const timeSinceExit = Date.now() - latestSameStrikeTs;
    const requiredStrikeCooldown = sameStrikeLostLast ? STRIKE_LOSS_LOCKOUT_MS : STRIKE_LOCKOUT_MS;
    if (timeSinceExit < requiredStrikeCooldown) return true;
  }
  return false;
}
