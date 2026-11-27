// Effective per-trade capital: live Upstox margin or paper balance, minus capital
// already deployed, optionally capped by a manual override.

export interface EffectiveCapitalInput {
  mode: string;
  configuredCap: number;
  liveAvailableMargin: number;
  initialCapital: number;
  openPaperPositions: Array<{ mode?: string; buyPrice: number; quantity: number }>;
  paperTradeHistory: Array<{
    mode?: string;
    netRealizedPnL?: number;
    realizedPnL?: number;
  }>;
}

const isPaperRow = (row: { mode?: string }) => !row.mode || row.mode === 'PAPER_TRADING';

export const computePaperBalance = ({
  initialCapital,
  openPaperPositions,
  paperTradeHistory,
}: Pick<
  EffectiveCapitalInput,
  'initialCapital' | 'openPaperPositions' | 'paperTradeHistory'
>): number => {
  const activeExposure = openPaperPositions
    .filter(isPaperRow)
    .reduce((sum, p) => sum + p.buyPrice * p.quantity, 0);
  const paperPnL = paperTradeHistory
    .filter(isPaperRow)
    .reduce((sum, t) => sum + (t.netRealizedPnL || t.realizedPnL || 0), 0);
  return Math.max(0, initialCapital + paperPnL - activeExposure);
};

export const computeEffectiveCapital = (input: EffectiveCapitalInput): number => {
  const { mode, configuredCap, liveAvailableMargin } = input;
  const paperBalance = computePaperBalance(input);
  const base = mode === 'UPSTOX_LIVE' ? liveAvailableMargin : paperBalance;
  return configuredCap > 0 ? Math.min(base, configuredCap) : base;
};
