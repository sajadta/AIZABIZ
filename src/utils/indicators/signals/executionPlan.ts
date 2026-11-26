import type { RealOptionMetrics } from '../optionTypes';
import { calculateTradeCharges } from '../tradeMath';

export interface MultiLegInput {
  adxValue: number;
  chosenStrike: number;
  strikeStep: number;
  optEntry: number;
  optionMetrics?: RealOptionMetrics;
  lotSize: number;
}

/** Builds the option-selling multi-leg footprint used for range-bound regimes. */
export function buildMultiLegDetails({
  adxValue,
  chosenStrike,
  strikeStep,
  optEntry,
  optionMetrics,
  lotSize,
}: MultiLegInput) {
  return {
    strategyType: (adxValue < 16 ? 'SHORT_STRANGLE' : 'SHORT_STRADDLE') as
      'SHORT_STRANGLE' | 'SHORT_STRADDLE',
    callStrike: chosenStrike + (adxValue < 16 ? strikeStep * 2 : 0),
    callLtp: Number((optEntry * 0.85).toFixed(2)),
    putStrike: chosenStrike - (adxValue < 16 ? strikeStep * 2 : 0),
    putLtp: Number((optEntry * 0.82).toFixed(2)),
    combinedPremiumCollected: Number((optEntry * 1.67).toFixed(2)),
    thetaDecayPerDayRupees: Math.round(Math.abs(optionMetrics?.theta ?? 8) * 1.8 * lotSize),
    upperBreakeven: Math.round(chosenStrike + strikeStep * 2 + optEntry * 1.67),
    lowerBreakeven: Math.round(chosenStrike - strikeStep * 2 - optEntry * 1.67),
  };
}

export interface RecommendedStrikeInput {
  optSymbol: string;
  chosenStrike: number;
  optType: 'CE' | 'PE';
  optEntry: number;
  optT1: number;
  isBullish: boolean;
  fallbackLotSz: number;
  fallbackCharges?: ReturnType<typeof calculateTradeCharges>;
  optionMetrics?: RealOptionMetrics;
  currentLtp: number;
}

/** Describes the recommended option contract with capital and P&L estimates. */
export function buildRecommendedOptionStrike({
  optSymbol,
  chosenStrike,
  optType,
  optEntry,
  optT1,
  isBullish,
  fallbackLotSz,
  fallbackCharges,
  optionMetrics,
  currentLtp,
}: RecommendedStrikeInput) {
  if (!optSymbol) return undefined;
  return {
    strikePrice: chosenStrike,
    optionType: optType,
    ltp: optEntry,
    expiry: optionMetrics?.expiry || 'Current Weekly',
    delta: Number((optionMetrics?.delta ?? (isBullish ? 0.54 : -0.54)).toFixed(2)),
    lotSize: optionMetrics?.lotSize || fallbackLotSz,
    iv: optionMetrics?.iv,
    oi: optionMetrics?.oi,
    volume: optionMetrics?.volume,
    instrumentKey: optionMetrics?.instrumentKey,
    requiredCapital: optionMetrics?.requiredCapital ?? fallbackCharges?.tradeValue,
    estimatedBrokerage: optionMetrics?.estimatedBrokerage ?? fallbackCharges?.roundTripCharges,
    totalRequiredWithBrokerage:
      optionMetrics?.totalRequiredWithBrokerage ?? fallbackCharges?.totalRequiredWithBrokerage,
    expectedNetProfit:
      optionMetrics?.expectedNetProfit ??
      (fallbackCharges
        ? Number(((optT1 - optEntry) * fallbackLotSz - fallbackCharges.roundTripCharges).toFixed(2))
        : undefined),
    affordableLots: optionMetrics?.affordableLots,
    availableCapital: optionMetrics?.availableCapital,
    underlyingSpot: currentLtp,
  };
}

export interface FallbackLotInput {
  indexPrefix: string;
  optionMetrics?: RealOptionMetrics;
  optEntry: number;
  optT1: number;
  optSymbol: string;
}

export interface FallbackLotResult {
  fallbackLotSz: number;
  fallbackCharges?: ReturnType<typeof calculateTradeCharges>;
}

/** Resolves the lot size and round-trip charges available without real contract data. */
export function resolveFallbackLot({
  indexPrefix,
  optionMetrics,
  optEntry,
  optT1,
  optSymbol,
}: FallbackLotInput): FallbackLotResult {
  const defaultLotForFallback =
    indexPrefix === 'BANKNIFTY' || indexPrefix === 'BANKEX'
      ? 30
      : indexPrefix === 'SENSEX'
        ? 20
        : indexPrefix === 'MIDCPNIFTY'
          ? 120
          : indexPrefix === 'FINNIFTY'
            ? 60
            : 65;
  const fallbackLotSz =
    optionMetrics?.lotSize && optionMetrics.lotSize > 1
      ? optionMetrics.lotSize
      : defaultLotForFallback;
  const fallbackCharges = optSymbol
    ? calculateTradeCharges(optEntry, fallbackLotSz, true, optT1)
    : undefined;
  return { fallbackLotSz, fallbackCharges };
}
