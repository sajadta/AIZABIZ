// Corporate quant alpha score for one option candidate: expected net profit scaled
// by confidence, MTF confluence and RVOL, plus a capital-efficiency (profit yield) bonus.

export interface AlphaScoreInput {
  expectedNetProfit?: number;
  effectiveTarget1: number;
  optionPrice: number;
  targetQuantity: number;
  totalTradeBrokerage: number;
  totalRequiredCash: number;
  hasMtfConfirmation: boolean;
  rvol?: number;
  confidenceScore?: number;
}

export interface AlphaScoreResult {
  expectedNetProfit: number;
  profitYield: number;
  alphaOpportunityScore: number;
}

export const computeAlphaScore = ({
  expectedNetProfit,
  effectiveTarget1,
  optionPrice,
  targetQuantity,
  totalTradeBrokerage,
  totalRequiredCash,
  hasMtfConfirmation,
  rvol,
  confidenceScore,
}: AlphaScoreInput): AlphaScoreResult => {
  const expNetProfit = Number(
    expectedNetProfit ||
      Math.max(350, (effectiveTarget1 - optionPrice) * targetQuantity - totalTradeBrokerage),
  );
  const profitYield = expNetProfit / Math.max(100, totalRequiredCash);
  const mtfStatusBonus = hasMtfConfirmation ? 1.35 : 1.0;
  const rvolMultiplier = Math.min(2.0, Math.max(0.8, Number(rvol || 1.15)));
  const confidence = Number(confidenceScore || 85);

  return {
    expectedNetProfit: expNetProfit,
    profitYield,
    alphaOpportunityScore: Number(
      (expNetProfit * (confidence / 100) * mtfStatusBonus * rvolMultiplier + profitYield * 120).toFixed(
        2,
      ),
    ),
  };
};
