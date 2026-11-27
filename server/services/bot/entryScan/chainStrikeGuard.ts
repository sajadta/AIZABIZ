// Smart anti-churn guard for chain scanning: caps entries per strike per day and
// cools down a strike that was just closed at a net loss (brokerage included).
import { recentClosedStrikes } from '../../../state';
import { getTradeNetPnL } from './sessionCircuit';
import {
  strikeDailyEntryCount,
  STRIKE_LOCKOUT_MS,
  STRIKE_LOSS_LOCKOUT_MS,
  MAX_STRIKE_ENTRIES_DEFAULT,
  MAX_STRIKE_ENTRIES_TRENDING,
} from '../antiChurn';

export interface ChainStrikeGuardParams {
  instrumentKey?: string;
  activeSessionTrades: any[];
}

/** True when the strike is still inside its entry cap or cooldown window. */
export function isChainStrikeCoolingDown(params: ChainStrikeGuardParams): boolean {
  const { instrumentKey: optKeyCandidate, activeSessionTrades } = params;

  const liveStrikeClosedTrades = optKeyCandidate
    ? activeSessionTrades.filter((t: any) => t.instrumentKey === optKeyCandidate)
    : [];
  const strikeTradesToday = optKeyCandidate
    ? Math.max(strikeDailyEntryCount[optKeyCandidate] || 0, liveStrikeClosedTrades.length)
    : 0;
  const recentClosed = optKeyCandidate ? recentClosedStrikes[optKeyCandidate] : null;
  const latestLiveStrikeClosed = liveStrikeClosedTrades[0] || null;
  const latestStrikeExitTs = Math.max(
    recentClosed?.exitTime || 0,
    latestLiveStrikeClosed?.closeTime ? new Date(latestLiveStrikeClosed.closeTime).getTime() : 0,
  );
  const lastStrikeWasNetLoss = recentClosed
    ? typeof recentClosed.netRealizedPnL === 'number'
      ? recentClosed.netRealizedPnL < 0
      : recentClosed.sellPrice < (recentClosed.buyPrice || 0)
    : latestLiveStrikeClosed
      ? getTradeNetPnL(latestLiveStrikeClosed) < 0
      : false;
  const maxAllowedForStrike = !lastStrikeWasNetLoss
    ? MAX_STRIKE_ENTRIES_TRENDING
    : MAX_STRIKE_ENTRIES_DEFAULT;

  if (strikeTradesToday >= maxAllowedForStrike) {
    return true;
  }
  if (latestStrikeExitTs > 0) {
    const elapsedSinceExit = Date.now() - latestStrikeExitTs;
    const strikeCooldownNeeded = lastStrikeWasNetLoss ? STRIKE_LOSS_LOCKOUT_MS : STRIKE_LOCKOUT_MS;
    if (elapsedSinceExit < strikeCooldownNeeded) {
      return true;
    }
  }

  return false;
}
