// PASS 2 of the entry scan: rank every verified candidate by institutional alpha
// and execute the single most profitable setup in paper or live mode.
import { botConfig, botLogs } from '../../../state';
import { isBlockedByCapitalGuard } from './entryCapitalGuard';
import { executePaperEntry } from './executePaperEntry';
import { executeLiveEntry } from './executeLiveEntry';

export interface ExecuteCandidatesContext {
  token: string;
  marketAlphaCandidates: any[];
  activePositions: any[];
  maxAllowedConcurrent: number;
  isDailyTradeLimitReached: boolean;
  isInPostExitCooldown: boolean;
  isTradingDay: boolean;
  isTradingHours: boolean;
  liveAvailableMargin: number;
}

export async function executeTopCandidates({
  token,
  marketAlphaCandidates,
  activePositions,
  maxAllowedConcurrent,
  isDailyTradeLimitReached,
  isInPostExitCooldown,
  isTradingDay,
  isTradingHours,
  liveAvailableMargin,
}: ExecuteCandidatesContext): Promise<void> {
  // PASS 2: Multi-Index Alpha Comparison & Execution of the #1 Most Profitable Setup
  if (
    marketAlphaCandidates.length > 0 &&
    activePositions.length < maxAllowedConcurrent &&
    !botConfig.dailyLossLocked &&
    !isDailyTradeLimitReached &&
    !isInPostExitCooldown &&
    isTradingDay &&
    isTradingHours
  ) {
    // If OPTIONS_ONLY mode is active, strictly filter out any equity trade candidates
    if (botConfig.tradeMode === 'OPTIONS_ONLY') {
      for (let i = marketAlphaCandidates.length - 1; i >= 0; i--) {
        if (marketAlphaCandidates[i].isEquityTrade) {
          marketAlphaCandidates.splice(i, 1);
        }
      }
    }

    // Sort all index candidates by alphaOpportunityScore descending!
    marketAlphaCandidates.sort((a, b) => b.alphaOpportunityScore - a.alphaOpportunityScore);

    const topPick = marketAlphaCandidates[0];
    const summaryIndices = marketAlphaCandidates
      .map(
        (c) =>
          `${c.idx.symbol}: Score ${c.alphaOpportunityScore} (+₹${c.expectedNetProfit.toFixed(0)})`,
      )
      .join(' | ');

    botLogs.unshift({
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString(),
      message: `[MULTI-INDEX OPPORTUNITY SCANNER] Scanned 6 Major Indices: ${summaryIndices}. Top Pick: ${topPick.idx.symbol} (${topPick.optionSymbol}) chosen as #1 MOST PROFITABLE opportunity!`,
      type: 'SIGNAL',
    });
    if (botLogs.length > 200) botLogs.length = 200;

    for (const cand of marketAlphaCandidates) {
      if (activePositions.length >= maxAllowedConcurrent) break;

      const isUnderlyingAlreadyOpen = activePositions.some(
        (p: any) =>
          p.underlyingInstrumentKey === cand.idx.key ||
          (p.symbol && p.symbol.startsWith(cand.idx.symbol.split(' ')[0])),
      );
      if (isUnderlyingAlreadyOpen) continue;

      if (isBlockedByCapitalGuard(cand, liveAvailableMargin)) continue;

      if (botConfig.mode === 'PAPER_TRADING') {
        executePaperEntry(cand);
      } else if (botConfig.mode === 'UPSTOX_LIVE' && token) {
        await executeLiveEntry({ token, cand, liveAvailableMargin, activePositions });
      }
    }
  }
}
