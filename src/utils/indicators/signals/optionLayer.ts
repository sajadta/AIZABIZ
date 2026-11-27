// Layer 2 of the signal engine: validates the setup against live option premium,
// Greeks, OI change, volume and order-book depth.
import type { RealOptionMetrics } from '../optionTypes';

export interface OptionLayerInput {
  optionMetrics?: RealOptionMetrics;
  bullishPoints: number;
  bearishPoints: number;
  corpScore: number;
  rvol: number;
}

export interface OptionLayerResult {
  bullishPoints: number;
  bearishPoints: number;
  oiBuildupDesc: string;
  effectiveOptDir: 'CE' | 'PE';
}

export const applyOptionLayer = ({
  optionMetrics,
  bullishPoints: bullIn,
  bearishPoints: bearIn,
  corpScore,
  rvol,
}: OptionLayerInput): OptionLayerResult => {
  let bullishPoints = bullIn;
  let bearishPoints = bearIn;
  let oiBuildupDesc = 'Balanced Institutional OI';
  const effectiveOptDir: 'CE' | 'PE' =
    optionMetrics && Number(optionMetrics.ltp) > 0 && optionMetrics.optionType
      ? optionMetrics.optionType
      : bullishPoints > bearishPoints && corpScore >= -15
        ? 'CE'
        : 'PE';

  if (optionMetrics) {
    const absDelta = Math.abs(optionMetrics.delta ?? 0.5);
    const optGamma = Math.abs(optionMetrics.gamma ?? 0.0012);
    const optTheta = Math.abs(optionMetrics.theta ?? 8);
    const optLtpRef = Math.max(1, optionMetrics.ltp || 100);
    const thetaDecayRatio = optTheta / optLtpRef;

    const availCapOpt = Number(optionMetrics.availableCapital || 0);
    const isSmallOrMicroCapOpt = availCapOpt > 0 && availCapOpt <= 3500;

    // 1. Delta (Δ): Directional speed sweet spot (0.45 to 0.75); compact/micro capital tiers allow liquid 0.02–0.44 strikes verified for net profit
    if (absDelta >= 0.45 && absDelta <= 0.75) {
      if (effectiveOptDir === 'CE') bullishPoints += 8;
      else bearishPoints += 8;
    } else if (isSmallOrMicroCapOpt && absDelta >= 0.02) {
      if (absDelta >= 0.2) {
        if (effectiveOptDir === 'CE') bullishPoints += 6;
        else bearishPoints += 6;
      } else if (absDelta >= 0.1) {
        if (effectiveOptDir === 'CE') bullishPoints += 3;
        else bearishPoints += 3;
      }
    } else if (absDelta < 0.25) {
      bullishPoints -= 15;
      bearishPoints -= 15;
    }

    // 2. Gamma (Γ): Non-linear premium acceleration on breakout
    if (optGamma >= 0.0008) {
      if (effectiveOptDir === 'CE') bullishPoints += 6;
      else bearishPoints += 6;
    }

    // 3. Theta (Θ): Protect against rapid time-decay traps when volume/velocity is low
    if (
      thetaDecayRatio > 0.22 &&
      rvol < (isSmallOrMicroCapOpt ? 0.75 : 1.2) &&
      !(isSmallOrMicroCapOpt && optLtpRef < 15)
    ) {
      const thetaPenalty = isSmallOrMicroCapOpt ? 4 : 15;
      bullishPoints -= thetaPenalty;
      bearishPoints -= thetaPenalty;
    }

    // 4. Implied Volatility (IV): Avoid IV Crush (> 45%) and reward healthy IV (10% - 35%)
    if (optionMetrics.iv && optionMetrics.iv > 45) {
      bullishPoints -= 12;
      bearishPoints -= 12;
    } else if (optionMetrics.iv && optionMetrics.iv >= 10 && optionMetrics.iv <= 35) {
      if (effectiveOptDir === 'CE') bullishPoints += 4;
      else bearishPoints += 4;
    }

    // 5. Put-Call Ratio (PCR) & Option Volume
    if (optionMetrics.pcr) {
      if (effectiveOptDir === 'CE' && optionMetrics.pcr >= 0.95) bullishPoints += 5;
      if (effectiveOptDir === 'PE' && optionMetrics.pcr <= 1.05) bearishPoints += 5;
    }

    // 6. OI Change & Order Book Bid/Ask Imbalance Analysis
    const oiChg = Number(optionMetrics.oiChange ?? 0);
    const bidAskRatio = Number(optionMetrics.bidAskRatio ?? 1.0);
    if (effectiveOptDir === 'CE') {
      oiBuildupDesc =
        oiChg < 0
          ? `Call Short Covering + RVOL ${rvol}x Surge`
          : `Long Buildup + Put Writing Floor (RVOL ${rvol}x)`;
      if (bidAskRatio >= 1.05) bullishPoints += 5;
    } else {
      oiBuildupDesc =
        oiChg < 0
          ? `Put Short Covering + RVOL ${rvol}x Surge`
          : `Bearish Put Buildup + Call Writing Wall (RVOL ${rvol}x)`;
      if (bidAskRatio >= 1.05) bearishPoints += 5;
    }
  }

  return { bullishPoints, bearishPoints, oiBuildupDesc, effectiveOptDir };
};
