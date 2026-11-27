// Option premium level planning: delta-mapped stop-loss and reward targets,
// one-lot capital/brokerage notes for the rationale text.
import type { RealOptionMetrics } from '../optionTypes';
import { calculateTradeCharges } from '../tradeMath';

export interface OptionPremiumPlanParams {
  optSymbol: string;
  indexPrefix: string;
  isBullish: boolean;
  atr14: number;
  currentLtp: number;
  nearestSupport: number;
  nearestResistance: number;
  realOptionPrice?: number;
  optionMetrics?: RealOptionMetrics;
  stopLoss: number;
  target1: number;
  target2: number;
  target3: number;
  rationale: string;
  rationaleMalayalam: string;
}

export interface OptionPremiumPlan {
  optEntry: number;
  optSL: number;
  optT1: number;
  optT2: number;
  optT3: number;
  rationale: string;
  rationaleMalayalam: string;
}

export function buildOptionPremiumPlan(params: OptionPremiumPlanParams): OptionPremiumPlan {
  const {
    optSymbol,
    indexPrefix,
    isBullish,
    atr14,
    currentLtp,
    nearestSupport,
    nearestResistance,
    realOptionPrice,
    optionMetrics,
  } = params;
  let { rationale, rationaleMalayalam } = params;

  const { stopLoss, target1, target2, target3 } = params;
  let optEntry = currentLtp;
  let optSL = stopLoss;
  let optT1 = target1;
  let optT2 = target2;
  let optT3 = target3;

  if (optSymbol) {
    let basePremium = 100;
    if (indexPrefix === 'BANKNIFTY' || indexPrefix === 'BANKEX') basePremium = 280;
    else if (indexPrefix === 'SENSEX') basePremium = 320;
    else if (indexPrefix === 'MIDCPNIFTY') basePremium = 65;

    optEntry = Number((optionMetrics?.ltp || realOptionPrice || basePremium).toFixed(2));

    // Intelligent Volatility & Market-Structure Adaptive Option Levels:
    // Replaces rigid static 17% stop and arbitrary multipliers with dynamic ATR, Delta, and S/R runway
    const minAllowedDelta = optionMetrics?.delta !== undefined ? 0.02 : 0.32;
    const optDelta = Math.max(
      minAllowedDelta,
      Math.min(0.85, Math.abs(Number(optionMetrics?.delta ?? 0.5))),
    );
    const underlyingRiskToFloor = isBullish
      ? Math.max(atr14 * 0.75, Math.min(atr14 * 2.2, currentLtp - nearestSupport))
      : Math.max(atr14 * 0.75, Math.min(atr14 * 2.2, nearestResistance - currentLtp));

    // Project underlying structural risk into option points via real-time delta
    const deltaMappedOptionRisk = underlyingRiskToFloor * optDelta;
    // Bounded dynamically: between 1.2 pts and 15% of premium to adapt to volatility regimes
    const dynamicOptionRiskPts = Math.max(
      1.2,
      Math.min(optEntry * 0.15, Math.max(optEntry * 0.07, deltaMappedOptionRisk)),
    );
    optSL = Number((optEntry - dynamicOptionRiskPts).toFixed(2));

    // Dynamic Reward Runway mapped to underlying key Resistance/Support
    const underlyingRunwayToTarget = isBullish
      ? Math.max(
          atr14 * 2.2,
          nearestResistance > currentLtp + 5 ? nearestResistance - currentLtp : atr14 * 2.5,
        )
      : Math.max(
          atr14 * 2.2,
          currentLtp - nearestSupport > 5 ? currentLtp - nearestSupport : atr14 * 2.5,
        );
    const deltaMappedRunway = underlyingRunwayToTarget * optDelta;
    const dynamicRewardPts = Math.max(dynamicOptionRiskPts * 1.85, deltaMappedRunway);

    optT1 = Number((optEntry + dynamicRewardPts).toFixed(2));
    optT2 = Number((optEntry + dynamicRewardPts * 1.65).toFixed(2));
    optT3 = Number((optEntry + dynamicRewardPts * 2.45).toFixed(2));

    const defaultLotForIndex =
      indexPrefix === 'BANKNIFTY' || indexPrefix === 'BANKEX'
        ? 30
        : indexPrefix === 'SENSEX'
          ? 20
          : indexPrefix === 'MIDCPNIFTY'
            ? 120
            : indexPrefix === 'FINNIFTY'
              ? 60
              : 65;
    const lotSzForCalc =
      optionMetrics?.lotSize && optionMetrics.lotSize > 1
        ? optionMetrics.lotSize
        : defaultLotForIndex;
    const oneLotCharges = calculateTradeCharges(optEntry, lotSzForCalc, true, optT1);
    const estBrokerage = optionMetrics?.estimatedBrokerage ?? oneLotCharges.roundTripCharges;
    const totalReqWithBrok =
      optionMetrics?.totalRequiredWithBrokerage ?? oneLotCharges.totalRequiredWithBrokerage;
    const grossProfit1Lot = (optT1 - optEntry) * lotSzForCalc;
    const netProfit1Lot =
      optionMetrics?.expectedNetProfit ?? Number((grossProfit1Lot - estBrokerage).toFixed(2));

    if (optionMetrics) {
      const capNoteEn = ` | 1 Lot (${lotSzForCalc} Qty): Premium ₹${oneLotCharges.tradeValue.toLocaleString('en-IN')} + Brokerage & Taxes ₹${estBrokerage.toFixed(0)} = Total ₹${totalReqWithBrok.toLocaleString('en-IN')} (Est. Net Profit: +₹${netProfit1Lot.toFixed(0)})${optionMetrics.affordableLots ? ` [${optionMetrics.affordableLots} Lot Fit Balance]` : ''}`;
      const capNoteMl = ` | 1 ലോട്ട് (${lotSzForCalc} Qty): പ്രീമിയം ₹${oneLotCharges.tradeValue.toLocaleString('en-IN')} + ബ്രോക്കറേജ് & ടാക്സ് ₹${estBrokerage.toFixed(0)} = ആകെ ₹${totalReqWithBrok.toLocaleString('en-IN')} (അറ്റ ലാഭം: +₹${netProfit1Lot.toFixed(0)})${optionMetrics.affordableLots ? ` [ബാലൻസിൽ വാങ്ങാവുന്നത്: ${optionMetrics.affordableLots} Lot]` : ''}`;
      rationale += ` Selected high-momentum ${optSymbol} @ ₹${optEntry} (Δ ${Number(optionMetrics.delta ?? 0.52).toFixed(2)}, IV ${Number(optionMetrics.iv ?? 14).toFixed(1)}%)${capNoteEn}.`;
      rationaleMalayalam += ` തിരഞ്ഞെടുത്ത ലാഭകരമായ ഓപ്ഷൻ: ${optSymbol} @ ₹${optEntry} (Δ ${Number(optionMetrics.delta ?? 0.52).toFixed(2)}, IV ${Number(optionMetrics.iv ?? 14).toFixed(1)}%)${capNoteMl}.`;
    }
  }
  return { optEntry, optSL, optT1, optT2, optT3, rationale, rationaleMalayalam };
}
