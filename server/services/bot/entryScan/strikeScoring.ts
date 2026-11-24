// Scores an option strike on capital fit, delta sweet spot, ROI potential and
// liquidity, and reports when the strike must be skipped for lack of capital.

export interface CapitalTierConfig {
  tier: string;
  minLtp: number;
  minDelta: number;
  maxBrokerageDragPct: number;
  getMinReqNetProfit: (estimatedBrokerage: number, configuredMinProfit: number) => number;
}

export interface StrikeScoringInput {
  mode: string;
  tierCfg: CapitalTierConfig;
  effectiveCapital: number;
  entryRequiredCashForStrike: number;
  totalRequiredWithBrokerage: number;
  fitsCapital: boolean;
  ltp: number;
  absDelta: number;
  strikeBrokerageDragPct: number;
  roiPotentialPct: number;
  estimatedBrokerage: number;
  expectedNetProfit: number;
  configuredMinProfit: number;
  bidAskSpreadPct: number;
  iv: number;
  volume: number;
  oi: number;
  closePrice: number;
  distRatio: number;
  isSmallCapitalAccount: boolean;
  strike: any;
  cheapestSkippedStrikeForCap: any;
}

export interface StrikeScoringResult {
  score: number;
  skip: boolean;
  cheapestSkippedStrikeForCap: any;
}

export const scoreStrikeCandidate = (input: StrikeScoringInput): StrikeScoringResult => {
  const {
    mode,
    tierCfg,
    effectiveCapital,
    entryRequiredCashForStrike,
    totalRequiredWithBrokerage,
    fitsCapital,
    ltp,
    absDelta,
    strikeBrokerageDragPct,
    roiPotentialPct,
    estimatedBrokerage,
    expectedNetProfit,
    configuredMinProfit,
    bidAskSpreadPct,
    iv,
    volume,
    oi,
    closePrice,
    distRatio,
    isSmallCapitalAccount,
    strike,
  } = input;

  let score = 0;
  let skip = false;
  let cheapestSkippedStrikeForCap = input.cheapestSkippedStrikeForCap;

  if (fitsCapital) {
    score += 350;
    if (absDelta >= 0.46 && absDelta <= 0.65) {
      score += 220;
    } else if (absDelta >= 0.42) {
      score += 130;
    } else if (tierCfg.tier !== 'STANDARD' && absDelta >= tierCfg.minDelta) {
      score += Math.round(absDelta * 400);
    } else {
      score -= 250;
    }
    if (
      tierCfg.tier === 'STANDARD' &&
      totalRequiredWithBrokerage >= 2500 &&
      totalRequiredWithBrokerage <= 8500
    ) {
      score += 150;
    } else if (tierCfg.tier !== 'STANDARD') {
      score += 120;
    }
  } else if (mode === 'UPSTOX_LIVE' && effectiveCapital <= 0) {
    if (
      totalRequiredWithBrokerage >= 1800 &&
      totalRequiredWithBrokerage <= 8500 &&
      absDelta >= 0.42
    ) {
      score += 120;
    }
  } else {
    if (
      effectiveCapital > 0 &&
      entryRequiredCashForStrike > effectiveCapital &&
      ltp >= tierCfg.minLtp &&
      absDelta >= tierCfg.minDelta &&
      strikeBrokerageDragPct <= tierCfg.maxBrokerageDragPct &&
      (!cheapestSkippedStrikeForCap ||
        totalRequiredWithBrokerage < cheapestSkippedStrikeForCap.totalRequiredWithBrokerage)
    ) {
      cheapestSkippedStrikeForCap = {
        strikePrice: strike.strikePrice,
        optType: strike.optType,
        ltp,
        lotSize: strike.lotSize,
        delta: strike.delta,
        gamma: strike.gamma,
        theta: strike.theta,
        oneLotCost: strike.oneLotCost,
        estimatedBrokerage,
        totalRequiredWithBrokerage,
        expectedNetProfit,
        roiPotentialPct,
      };
    }
    const skipNeeded =
      mode === 'UPSTOX_LIVE' ? entryRequiredCashForStrike : totalRequiredWithBrokerage;
    if (effectiveCapital > 0 && skipNeeded > effectiveCapital) {
      skip = true;
    }
    score -= 500;
  }

  if (skip) return { score, skip, cheapestSkippedStrikeForCap };

  if (roiPotentialPct >= 25) {
    score += 170;
  } else if (roiPotentialPct >= 18) {
    score += 110;
  } else if (roiPotentialPct >= 12) {
    score += 60;
  } else if (roiPotentialPct < 7) {
    score -= 100;
  }

  const tierMinProfitForScore = tierCfg.getMinReqNetProfit(estimatedBrokerage, configuredMinProfit);
  if (expectedNetProfit >= 1200) {
    score += 110;
  } else if (expectedNetProfit >= 700) {
    score += 75;
  } else if (expectedNetProfit >= tierMinProfitForScore) {
    score += 45;
  } else {
    score -= 150;
  }

  // Block deep-OTM contracts where flat brokerage eats the premium.
  if (
    ltp < tierCfg.minLtp ||
    absDelta < tierCfg.minDelta ||
    strikeBrokerageDragPct > tierCfg.maxBrokerageDragPct
  ) {
    return { score, skip: true, cheapestSkippedStrikeForCap };
  }

  if (absDelta >= 0.46 && absDelta <= 0.65) {
    score += 150;
  } else if (absDelta >= 0.42) {
    score += 60;
  }

  if (bidAskSpreadPct <= 0.8) score += 40;
  else if (bidAskSpreadPct <= 1.5) score += 20;
  if (iv > 8 && iv <= 32) score += 20;
  else if (iv > 42) score -= 30;

  if (volume > 15000 || oi > 60000) score += 25;
  if (closePrice > 0 && ltp > closePrice) score += 30;

  // Keep the pick close to spot so genuine ATM / 1-step ITM strikes win.
  score -= distRatio * (isSmallCapitalAccount ? 150 : 1600);

  return { score, skip: false, cheapestSkippedStrikeForCap };
};
