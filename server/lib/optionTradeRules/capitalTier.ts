// Capital-tier dependent option constraint thresholds.
export type CapitalTierName = 'MICRO' | 'COMPACT' | 'STANDARD';

export interface CapitalTierOptionConstraints {
  tier: CapitalTierName;
  minLtp: number;
  minDelta: number;
  maxStrikeDistPct: number;
  minVolume: number;
  minOi: number;
  maxSpreadPct: number;
  /** Maximum allowed roundTripCharges / tradeValue ratio (prevents paying ₹72 brokerage on ₹430 trades) */
  maxBrokerageDragPct: number;
  getMinReqNetProfit: (estimatedBrokerage: number, configuredMinProfit?: number) => number;
}

/**
 * Capital-adaptive option quality constraints:
 * - STANDARD (> ₹3,500 or <= 0): Institutional ATM/1-step ITM (Δ >= 0.42, LTP >= ₹25, <= 6% brokerage drag).
 * - COMPACT (₹1,250 – ₹3,500, e.g. ₹2,000 Paper): Liquid near-ATM (Δ >= 0.24, LTP >= ₹16, <= 7.5% brokerage drag).
 * - MICRO (< ₹1,250): Protects capital against 15%+ brokerage bleed on deep-OTM ₹5–₹10 lottery contracts
 *   by enforcing Δ >= 0.20, LTP >= ₹14, and round-trip brokerage <= 8% of trade value.
 */
export function getCapitalTierOptionConstraints(
  availableCapital: number,
  isBseIndex: boolean = false,
  symbolOrKey?: string,
): CapitalTierOptionConstraints {
  const cap = Number(availableCapital || 0);
  const symUp = String(symbolOrKey || '').toUpperCase();
  const isSecondaryIndex =
    symUp.includes('BANK') ||
    symUp.includes('FIN') ||
    symUp.includes('MID') ||
    symUp.includes('BANKEX');

  if (cap > 0 && cap < 300) {
    return {
      tier: 'MICRO',
      minLtp: 1.5,
      minDelta: 0.02,
      maxStrikeDistPct: 0.06,
      minVolume: isSecondaryIndex ? 3000 : isBseIndex ? 12000 : 25000,
      minOi: isSecondaryIndex ? 3000 : isBseIndex ? 8000 : 15000,
      maxSpreadPct: isBseIndex || isSecondaryIndex ? 8.0 : 6.5,
      maxBrokerageDragPct: 0.8,
      getMinReqNetProfit: (estimatedBrokerage: number) =>
        Math.max(35, Math.round(Math.max(50, estimatedBrokerage) * 0.5)),
    };
  }

  if (cap >= 300 && cap < 750) {
    return {
      tier: 'MICRO',
      minLtp: 4.0,
      minDelta: 0.06,
      maxStrikeDistPct: 0.045,
      minVolume: isSecondaryIndex ? 5000 : isBseIndex ? 25000 : 100000,
      minOi: isSecondaryIndex ? 5000 : isBseIndex ? 15000 : 40000,
      maxSpreadPct: isBseIndex || isSecondaryIndex ? 5.0 : 3.5,
      maxBrokerageDragPct: 0.25,
      getMinReqNetProfit: (estimatedBrokerage: number) =>
        Math.max(100, Math.round(Math.max(50, estimatedBrokerage) * 1.4)),
    };
  }

  if (cap >= 750 && cap < 1250) {
    return {
      tier: 'MICRO',
      minLtp: 8.0,
      minDelta: 0.09,
      maxStrikeDistPct: 0.04,
      minVolume: isSecondaryIndex ? 8000 : isBseIndex ? 25000 : 100000,
      minOi: isSecondaryIndex ? 8000 : isBseIndex ? 15000 : 40000,
      maxSpreadPct: isBseIndex || isSecondaryIndex ? 3.5 : 2.5,
      maxBrokerageDragPct: 0.14,
      getMinReqNetProfit: (estimatedBrokerage: number) =>
        Math.max(110, Math.round(Math.max(50, estimatedBrokerage) * 1.55)),
    };
  }

  if (cap >= 1250 && cap <= 3500) {
    return {
      tier: 'COMPACT',
      minLtp: 10.0,
      minDelta: 0.1,
      maxStrikeDistPct: 0.035,
      minVolume: isSecondaryIndex ? 6000 : isBseIndex ? 15000 : 45000,
      minOi: isSecondaryIndex ? 8000 : isBseIndex ? 15000 : 40000,
      maxSpreadPct: isBseIndex || isSecondaryIndex ? 3.5 : 2.5,
      maxBrokerageDragPct: 0.08,
      getMinReqNetProfit: (estimatedBrokerage: number) =>
        Math.max(140, Math.round(Math.max(50, estimatedBrokerage) * 2.0)),
    };
  }

  return {
    tier: 'STANDARD',
    minLtp: 25.0,
    minDelta: 0.42,
    maxStrikeDistPct: 0.008,
    minVolume: isBseIndex ? 1200 : 1500,
    minOi: isBseIndex ? 4000 : 8000,
    maxSpreadPct: isBseIndex ? 4.5 : 3.5,
    maxBrokerageDragPct: 0.06,
    getMinReqNetProfit: (estimatedBrokerage: number, configuredMinProfit?: number) =>
      Math.max(
        250,
        Math.round(Math.max(50, estimatedBrokerage) * 2.5),
        Number(configuredMinProfit || 250),
      ),
  };
}
