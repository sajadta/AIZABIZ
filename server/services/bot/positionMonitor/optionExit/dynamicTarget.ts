// Expands the profit target when price keeps climbing through resistance.

export interface DynamicTargetParams {
  pos: any;
  latestUnderlyingSig: any;
  forecastedMaxPrice: number;
  ltp: number;
  isUnderlyingParametersReversing: boolean;
}

export function resolveDynamicTargetPrice({
  pos,
  latestUnderlyingSig,
  forecastedMaxPrice,
  ltp,
  isUnderlyingParametersReversing,
}: DynamicTargetParams): number {
  const sameContractSignal =
    latestUnderlyingSig &&
    ((latestUnderlyingSig.instrumentKey &&
      pos.instrumentKey &&
      latestUnderlyingSig.instrumentKey === pos.instrumentKey) ||
      (Number(latestUnderlyingSig.price || 0) > 0 &&
        Math.abs(Number(latestUnderlyingSig.price) - pos.buyPrice) <= pos.buyPrice * 0.45));
  const liveUnderlyingForecastPrice = sameContractSignal
    ? Number(latestUnderlyingSig?.institutionalQuantAnalysis?.estimatedMaxOptionPrice || 0)
    : 0;
  let dynamicTargetPrice = Math.max(forecastedMaxPrice, liveUnderlyingForecastPrice);
  if (ltp >= dynamicTargetPrice * 0.98 && !isUnderlyingParametersReversing) {
    // Resistance-Shattering Target Expansion: Automatically move target higher as price climbs!
    dynamicTargetPrice = Number(Math.max(dynamicTargetPrice * 1.08, ltp * 1.1).toFixed(2));
  }
  pos.target = dynamicTargetPrice;
  pos.estimatedMaxOptionPrice = dynamicTargetPrice;

  return dynamicTargetPrice;
}
