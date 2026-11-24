// Realistic target-price and time-to-target forecast for a generated signal.
export interface TargetForecastInput {
  isBullish: boolean;
  atr14: number;
  nearestResistance: number;
  nearestSupport: number;
  optEntry: number;
  currentLtp: number;
  optT1: number;
  delta: number;
  gamma: number;
  affordableLots?: number;
  estimatedBrokerage?: number;
  roundTripCharges?: number;
  lotSize: number;
}

export interface TargetForecast {
  clearRunwayPoints: number;
  estimatedMaxOptionPrice: number;
  estimatedMinutesToTarget: string;
  estimatedNetProfitRange: string;
}

export function buildTargetForecast(input: TargetForecastInput): TargetForecast {
  const {
    isBullish,
    atr14,
    nearestResistance,
    nearestSupport,
    optEntry,
    optT1,
    currentLtp,
    lotSize: fallbackLotSz,
  } = input;
  const fallbackCharges = { roundTripCharges: input.roundTripCharges ?? 60 };
  const optionMetrics = {
    delta: input.delta,
    gamma: input.gamma,
    affordableLots: input.affordableLots,
    estimatedBrokerage: input.estimatedBrokerage,
  };

  // Calculate Realistic Target Price & Time-to-Target Forecast ("എപ്പോൾ, എത്ര രൂപ വരെ ലാഭത്തിലാകും?")
  const clearRunwayPoints = Number(
    (isBullish
      ? Math.max(atr14 * 1.8, nearestResistance - currentLtp)
      : Math.max(atr14 * 1.8, currentLtp - nearestSupport)
    ).toFixed(2),
  );
  const absDeltaForForecast = Math.abs(optionMetrics?.delta ?? 0.52);
  const gammaForForecast = Math.abs(optionMetrics?.gamma ?? 0.0015);
  const estOptionGainPts = Number(
    Math.max(
      optT1 - optEntry,
      clearRunwayPoints * absDeltaForForecast +
        0.5 * gammaForForecast * Math.pow(Math.min(clearRunwayPoints, atr14 * 3), 2),
    ).toFixed(2),
  );
  const estimatedMaxOptionPrice = Number((optEntry + estOptionGainPts).toFixed(2));
  const estMinsLow = Math.max(2, Math.round(clearRunwayPoints / Math.max(1, atr14 * 1.1)));
  const estMinsHigh = Math.min(
    25,
    Math.max(estMinsLow + 3, Math.round(clearRunwayPoints / Math.max(1, atr14 * 0.55))),
  );
  const estimatedMinutesToTarget = `${estMinsLow}–${estMinsHigh} mins`;
  const effectiveLotsForEst = Math.max(1, optionMetrics?.affordableLots || 1);
  const effectiveQtyForEst = effectiveLotsForEst * fallbackLotSz;
  const estBrokTotal =
    (optionMetrics?.estimatedBrokerage || fallbackCharges?.roundTripCharges || 60) *
    effectiveLotsForEst;
  const minNetProfitEst = Math.max(
    optEntry < 10 ? 45 : 180,
    Math.round((optT1 - optEntry) * effectiveQtyForEst - estBrokTotal),
  );
  const maxNetProfitEst = Math.max(
    minNetProfitEst + 150,
    Math.round(estOptionGainPts * effectiveQtyForEst - estBrokTotal),
  );
  const estimatedNetProfitRange = `+₹${minNetProfitEst.toLocaleString('en-IN')} to +₹${maxNetProfitEst.toLocaleString('en-IN')} Net`;

  return {
    clearRunwayPoints,
    estimatedMaxOptionPrice,
    estimatedMinutesToTarget,
    estimatedNetProfitRange,
  };
}
