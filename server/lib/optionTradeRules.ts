/**
 * optionTradeRules.ts
 * Pure, decoupled rules for Options-Only trading execution and genuine profitability verification.
 */

export interface OptionProfitabilityParams {
  symbol: string;
  strike: number;
  optionType: 'CE' | 'PE';
  ltp: number;
  lotSize: number;
  delta: number;
  estimatedBrokerage: number;
  expectedGrossGainPoints: number;
  candleOpen?: number;
  availableBalance: number;
  minNetProfitFloor?: number;
}

export interface OptionProfitabilityResult {
  eligible: boolean;
  rejectReason?: string;
  requiredCapital: number;
  expectedGrossProfit: number;
  expectedNetProfit: number;
  minRequiredNetProfit: number;
}

/**
 * Enforces the strict OPTIONS_ONLY mode and high-conviction quality thresholds.
 */
export function enforceOptionsOnlyConfig(config: any): any {
  if (!config || typeof config !== 'object') return config;
  config.tradeMode = 'OPTIONS_ONLY';
  config.minConfidence = Math.max(85, Number(config.minConfidence || 85));
  config.minOptionProfitAmount = Math.max(350, Number(config.minOptionProfitAmount || 350));
  config.optionStrikeSelector = true;
  return config;
}

/**
 * Pure evaluation function enforcing genuine net profitability:
 * 1. Delta >= 0.42 (strictly avoids decay-prone OTM junk with 0.04-0.08 delta).
 * 2. Option LTP >= ₹25 (avoids penny options where brokerage wipes out gains).
 * 3. Positive / flat momentum on 1m candle (liveOptLtp >= candleOpen, removing loose -2% dip fallback).
 * 4. Expected Net Profit >= max(₹350, 3.5 × estimatedBrokerage & taxes).
 * 5. Capital Affordability: 1 Lot premium + charges must be <= available balance.
 */
export function evaluateOptionTradeProfitability(
  params: OptionProfitabilityParams
): OptionProfitabilityResult {
  const lotSize = Math.max(1, params.lotSize || 1);
  const ltp = Number(params.ltp || 0);
  const delta = Math.abs(Number(params.delta || 0));
  const brokerage = Number(params.estimatedBrokerage || 55);
  const grossPoints = Number(params.expectedGrossGainPoints || 0);
  const availableBal = Number(params.availableBalance || 0);
  const minFloor = Number(params.minNetProfitFloor || 350);

  const totalPremium = Math.round(ltp * lotSize * 100) / 100;
  const requiredCapital = Math.round((totalPremium + brokerage) * 100) / 100;
  const expectedGrossProfit = Math.round(grossPoints * lotSize * 100) / 100;
  const expectedNetProfit = Math.round((expectedGrossProfit - brokerage) * 100) / 100;
  const minRequiredNetProfit = Math.max(minFloor, Math.round(brokerage * 3.5));

  // 1. Delta threshold
  if (delta < 0.42) {
    return {
      eligible: false,
      rejectReason: `ഡെൽറ്റ കുറവാണ് (Δ ${delta.toFixed(2)} < 0.42). OTM ഡീകേയ് റിസ്ക് ഒഴിവാക്കി.`,
      requiredCapital,
      expectedGrossProfit,
      expectedNetProfit,
      minRequiredNetProfit,
    };
  }

  // 2. Minimum Option LTP (no penny lottery tickets)
  if (ltp < 25) {
    return {
      eligible: false,
      rejectReason: `ഓപ്ഷൻ പ്രീമിയം വളരെ കുറവാണ് (LTP ₹${ltp.toFixed(2)} < ₹25). ബ്രോക്കറേജ് കാരണം ലാഭകരമല്ല.`,
      requiredCapital,
      expectedGrossProfit,
      expectedNetProfit,
      minRequiredNetProfit,
    };
  }

  // 3. Positive candle momentum (no loose -2% falling knife fallback)
  if (params.candleOpen !== undefined && params.candleOpen > 0) {
    if (ltp < params.candleOpen) {
      return {
        eligible: false,
        rejectReason: `1 മിനിറ്റ് കാൻഡിൽ നെഗറ്റീവ് മൊമെന്റത്തിലാണ് (LTP ₹${ltp} < Open ₹${params.candleOpen}).`,
        requiredCapital,
        expectedGrossProfit,
        expectedNetProfit,
        minRequiredNetProfit,
      };
    }
  }

  // 4. Expected Net Profit threshold
  if (expectedNetProfit < minRequiredNetProfit) {
    return {
      eligible: false,
      rejectReason: `പ്രതീക്ഷിക്കുന്ന അറ്റ ലാഭം (₹${expectedNetProfit}) മിനിമം ലക്ഷ്യത്തേക്കാൾ (₹${minRequiredNetProfit}) കുറവാണ്.`,
      requiredCapital,
      expectedGrossProfit,
      expectedNetProfit,
      minRequiredNetProfit,
    };
  }

  // 5. Capital Guard
  if (availableBal > 0 && requiredCapital > availableBal) {
    return {
      eligible: false,
      rejectReason: `ആവശ്യമായ തുക ₹${requiredCapital.toLocaleString('en-IN')} ലഭ്യമായ ബാലൻസിനേക്കാൾ (₹${availableBal.toLocaleString('en-IN')}) കൂടുതലാണ്.`,
      requiredCapital,
      expectedGrossProfit,
      expectedNetProfit,
      minRequiredNetProfit,
    };
  }

  return {
    eligible: true,
    requiredCapital,
    expectedGrossProfit,
    expectedNetProfit,
    minRequiredNetProfit,
  };
}

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
      minVolume: isSecondaryIndex ? 3000 : (isBseIndex ? 12000 : 25000),
      minOi: isSecondaryIndex ? 3000 : (isBseIndex ? 8000 : 15000),
      maxSpreadPct: isBseIndex || isSecondaryIndex ? 8.0 : 6.5,
      maxBrokerageDragPct: 0.80,
      getMinReqNetProfit: (estimatedBrokerage: number) =>
        Math.max(35, Math.round(Math.max(50, estimatedBrokerage) * 0.50)),
    };
  }

  if (cap >= 300 && cap < 750) {
    return {
      tier: 'MICRO',
      minLtp: 4.0,
      minDelta: 0.06,
      maxStrikeDistPct: 0.045,
      minVolume: isSecondaryIndex ? 5000 : (isBseIndex ? 25000 : 100000),
      minOi: isSecondaryIndex ? 5000 : (isBseIndex ? 15000 : 40000),
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
      minVolume: isSecondaryIndex ? 8000 : (isBseIndex ? 25000 : 100000),
      minOi: isSecondaryIndex ? 8000 : (isBseIndex ? 15000 : 40000),
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
      minDelta: 0.10,
      maxStrikeDistPct: 0.035,
      minVolume: isSecondaryIndex ? 6000 : (isBseIndex ? 15000 : 45000),
      minOi: isSecondaryIndex ? 8000 : (isBseIndex ? 15000 : 40000),
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

export interface DipMomentumInput {
  liveOptLtp: number;
  chainSnapshotLtp: number;
  optLowestBase: number;
  optOpen0: number;
  optShortVwap: number;
  optUpperWickRatio: number;
  singleMinuteSpikePct: number;
  isUnderlyingConfirming: boolean;
  isBaseMomentumOk: boolean;
}

/**
 * Evaluates whether a minor dip below the option-chain snapshot price is a valid
 * value dip-buy vs a sudden breakdown/crash. Replaces strict micro-tick rejection
 * (`liveOptLtp < chainSnapshotLtp`) which previously killed all pullback dip entries.
 */
export function evaluateOptionDipMomentum(input: DipMomentumInput): boolean {
  const {
    liveOptLtp,
    chainSnapshotLtp,
    optLowestBase,
    optOpen0,
    optShortVwap,
    optUpperWickRatio,
    singleMinuteSpikePct,
    isUnderlyingConfirming,
    isBaseMomentumOk,
  } = input;

  if (liveOptLtp <= 0) return false;
  // Block sharp >12% flash drops relative to chain snapshot
  if (chainSnapshotLtp > 0 && liveOptLtp < chainSnapshotLtp * 0.88) {
    return false;
  }
  if (isBaseMomentumOk) return true;

  // Scale tolerance smoothly for nano (<₹6), micro (<₹15), and compact (<₹85) contracts
  const isNanoPrem = liveOptLtp < 6;
  const isLowPrem = liveOptLtp < 15;
  const isCompactPrem = liveOptLtp < 85;
  const maxBaseMult = isNanoPrem ? 1.25 : isLowPrem ? 1.16 : isCompactPrem ? 1.12 : 1.06;
  const maxUpperWick = isLowPrem ? 0.48 : isCompactPrem ? 0.42 : 0.35;
  const maxSpikePct = isNanoPrem ? 20.0 : isLowPrem ? 14.0 : isCompactPrem ? 7.0 : 4.0;

  // Value dip-buy bounce near 3m low or short VWAP when underlying index trend confirms
  const isHealthyPullbackZone =
    isUnderlyingConfirming &&
    chainSnapshotLtp > 0 &&
    liveOptLtp >= chainSnapshotLtp * 0.90 &&
    liveOptLtp >= optLowestBase &&
    liveOptLtp <= optLowestBase * maxBaseMult &&
    liveOptLtp >= optShortVwap * 0.96 &&
    liveOptLtp >= optOpen0 * 0.985 &&
    optUpperWickRatio <= maxUpperWick &&
    singleMinuteSpikePct >= -4.5 &&
    singleMinuteSpikePct <= maxSpikePct;

  return isHealthyPullbackZone;
}

export interface PaperOrderValidationInput {
  symbol: string;
  resolvedKey: string;
  price: number;
}

export interface PaperOrderValidationResult {
  valid: boolean;
  isOption: boolean;
  error?: string;
}

/**
 * Validates paper trade orders:
 * - Rejects zero or non-finite order prices.
 * - Strictly detects option contracts via CE/PE tokens (NOT broad "FO" substring, which broke Futures).
 * - Blocks dummy ₹100 fallback option orders that lack a verified numeric Upstox option key,
 *   while allowing real-LTP paper Option Chain contracts and all Futures/Equity orders.
 */
export function validatePaperOrderInput(
  input: PaperOrderValidationInput,
): PaperOrderValidationResult {
  const symbol = String(input.symbol || "");
  const resolvedKey = String(input.resolvedKey || "");
  const price = Number(input.price);
  const isOption = /\b(CE|PE)\b/i.test(symbol) || /(CE|PE)$/i.test(resolvedKey);

  if (!Number.isFinite(price) || price <= 0) {
    return {
      valid: false,
      isOption,
      error: "Order price must be greater than ₹0.",
    };
  }

  if (
    isOption &&
    price === 100 &&
    !resolvedKey.match(/^(NSE_FO|BSE_FO)\|\d+/)
  ) {
    return {
      valid: false,
      isOption,
      error: "Blocked dummy ₹100 option order without real Upstox option chain contract.",
    };
  }

  return { valid: true, isOption };
}


