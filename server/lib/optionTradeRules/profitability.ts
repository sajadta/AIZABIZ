// Genuine net-profitability and capital-affordability gate for option entries.
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
/**
 * Pure evaluation function enforcing genuine net profitability:
 * 1. Delta >= 0.42 (strictly avoids decay-prone OTM junk with 0.04-0.08 delta).
 * 2. Option LTP >= ₹25 (avoids penny options where brokerage wipes out gains).
 * 3. Positive / flat momentum on 1m candle (liveOptLtp >= candleOpen, removing loose -2% dip fallback).
 * 4. Expected Net Profit >= max(₹350, 3.5 × estimatedBrokerage & taxes).
 * 5. Capital Affordability: 1 Lot premium + charges must be <= available balance.
 */
export function evaluateOptionTradeProfitability(
  params: OptionProfitabilityParams,
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
