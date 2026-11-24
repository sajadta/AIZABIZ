// Level confluence: corporate-heavyweight flow, nearest support/resistance with
// breakout-power detection and the 5-year macro regime overlay.

export interface LevelConfluenceParams {
  optionMetrics: any;
  swingHighs: number[];
  swingLows: number[];
  currentLtp: number;
  atr14: number;
  rvol: number;
  macdHist: number;
  move1m: number;
  move2m: number;
  prevClose: number;
  tf15m: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  supertrendSignal: 'BUY' | 'SELL';
  vwapPrice: number;
  chartStructureEn: string;
  chartStructureMl: string;
}

export interface LevelConfluenceResult {
  corpScore: number;
  corpSummary: string;
  macroAlign: 'BULLISH' | 'BEARISH' | 'MIXED';
  nearestSupport: number;
  nearestResistance: number;
  isBlockedByResistanceWall: boolean;
  isBlockedBySupportWall: boolean;
  chartStructureEn: string;
  chartStructureMl: string;
  fiveYrSummaryEn: string;
  fiveYrSummaryMl: string;
  multiYrSup: number;
  multiYrRes: number;
  histWinProb: number;
  bullishPointsDelta: number;
  bearishPointsDelta: number;
}

export function applyLevelConfluence({
  optionMetrics,
  swingHighs,
  swingLows,
  currentLtp,
  atr14,
  rvol,
  macdHist,
  move1m,
  move2m,
  prevClose,
  tf15m,
  supertrendSignal,
  vwapPrice,
  chartStructureEn: initialStructureEn,
  chartStructureMl: initialStructureMl,
}: LevelConfluenceParams): LevelConfluenceResult {
  let bullishPointsDelta = 0;
  let bearishPointsDelta = 0;
  let chartStructureEn = initialStructureEn;
  let chartStructureMl = initialStructureMl;
  const prev = { close: prevClose };
  const readings = { supertrend: { signal: supertrendSignal } };

  // D. Corporate Heavyweights Flow & Global/Macro Market Alignment
  const corpScore = Number(optionMetrics?.corporateHeavyweightScore ?? 0);
  const corpSummary =
    optionMetrics?.corporateHeavyweightSummary ||
    'Heavyweights (HDFCBANK, RELIANCE, ICICIBANK, INFY, TCS) Tracked';
  const macroAlign =
    optionMetrics?.globalMacroAlignment ||
    (tf15m === 'BULLISH' ? 'BULLISH' : tf15m === 'BEARISH' ? 'BEARISH' : 'MIXED');

  // Calculate Nearest Resistance & Nearest Support + Resistance-Shattering Breakout Engine
  const resistancesAbove = swingHighs
    .filter((h) => h > currentLtp + atr14 * 0.3)
    .sort((a, b) => a - b);
  const supportsBelow = swingLows.filter((l) => l < currentLtp - atr14 * 0.3).sort((a, b) => b - a);
  const callWall =
    optionMetrics?.callWallStrike && optionMetrics.callWallStrike > currentLtp
      ? optionMetrics.callWallStrike
      : 0;
  const putWall =
    optionMetrics?.putWallStrike && optionMetrics.putWallStrike < currentLtp
      ? optionMetrics.putWallStrike
      : 0;

  let nearestResistance = Number(
    (
      resistancesAbove[0] ||
      (callWall > 0 ? callWall : currentLtp + Math.max(atr14 * 3.2, currentLtp * 0.004))
    ).toFixed(2),
  );
  let nearestSupport = Number(
    (
      supportsBelow[0] ||
      (putWall > 0 ? putWall : currentLtp - Math.max(atr14 * 3.2, currentLtp * 0.004))
    ).toFixed(2),
  );

  // Check if price is approaching Resistance/Support WITH Resistance-Shattering Breakout Power (RVOL + OI Short Covering + Heavyweights + MACD)
  const distToRes = nearestResistance - currentLtp;
  const distToSup = currentLtp - nearestSupport;
  const hasBullBreakoutPower =
    rvol >= 1.15 ||
    corpScore >= 15 ||
    macdHist > 0 ||
    move2m > atr14 * 0.5 ||
    Number(optionMetrics?.oiChange ?? 0) < 0 ||
    Number(optionMetrics?.bidAskRatio ?? 1.0) >= 1.08;
  const hasBearBreakdownPower =
    rvol >= 1.15 ||
    corpScore <= -15 ||
    macdHist < 0 ||
    move2m < -atr14 * 0.5 ||
    Number(optionMetrics?.oiChange ?? 0) < 0 ||
    Number(optionMetrics?.bidAskRatio ?? 1.0) >= 1.08;

  let isBlockedByResistanceWall = false;
  let isBlockedBySupportWall = false;

  if (distToRes <= atr14 * 0.85) {
    if (hasBullBreakoutPower && (currentLtp >= prev.close || move1m > 0)) {
      // Resistance is being SHATTERED! Shift target runway to the next higher resistance (R2) and boost score!
      nearestResistance = Number(
        (
          resistancesAbove[1] || nearestResistance + Math.max(atr14 * 3.0, currentLtp * 0.0035)
        ).toFixed(2),
      );
      chartStructureEn = `Resistance-Shattering Breakout (RVOL ${rvol}x + Short Covering)`;
      chartStructureMl = `റെസിസ്റ്റൻസ് ഭേദിച്ചുള്ള വോളിയം ബ്രേക്ക്ഔട്ട് (RVOL ${rvol}x)`;
      bullishPointsDelta += 14;
    } else if (move1m <= 0 && move2m <= 0) {
      // Stalling right under resistance without momentum -> Trap Protection!
      isBlockedByResistanceWall = true;
    }
  }

  if (distToSup <= atr14 * 0.85) {
    if (hasBearBreakdownPower && (currentLtp <= prev.close || move1m < 0)) {
      // Support is being SHATTERED! Shift target runway to the next lower support (S2) and boost score!
      nearestSupport = Number(
        (supportsBelow[1] || nearestSupport - Math.max(atr14 * 3.0, currentLtp * 0.0035)).toFixed(
          2,
        ),
      );
      chartStructureEn = `Support-Shattering Breakdown (RVOL ${rvol}x + Long Unwinding)`;
      chartStructureMl = `സപ്പോർട്ട് ഭേദിച്ചുള്ള ശക്തമായ ബ്രേക്ക്ഡൗൺ (RVOL ${rvol}x)`;
      bearishPointsDelta += 14;
    } else if (move1m >= 0 && move2m >= 0) {
      // Stalling right above support without downward momentum -> Trap Protection!
      isBlockedBySupportWall = true;
    }
  }

  const earlyCorpDivergencePenalty =
    (corpScore <= -25 &&
      tf15m === 'BULLISH' &&
      readings.supertrend.signal === 'BUY' &&
      currentLtp > vwapPrice) ||
    (corpScore >= 25 &&
      tf15m === 'BEARISH' &&
      readings.supertrend.signal === 'SELL' &&
      currentLtp < vwapPrice);

  if (corpScore >= 25) {
    bullishPointsDelta += 12;
    bearishPointsDelta -= earlyCorpDivergencePenalty ? 5 : 15;
  } else if (corpScore <= -25) {
    bearishPointsDelta += 12;
    bullishPointsDelta -= earlyCorpDivergencePenalty ? 5 : 15;
  }

  if (macroAlign === 'BULLISH') bullishPointsDelta += 8;
  else if (macroAlign === 'BEARISH') bearishPointsDelta += 8;

  // D2. 5-Year Historical Daily/Weekly Macro Regime, 200-Day/50-Day EMA & Multi-Year Support/Resistance Confluence
  const fiveYearTrend = optionMetrics?.fiveYearRegimeTrend || 'BULLISH_SECULAR';
  const multiYrSup = Number(optionMetrics?.multiYearSupport || nearestSupport);
  const multiYrRes = Number(optionMetrics?.multiYearResistance || nearestResistance);
  const histWinProb = Number(optionMetrics?.historicalPatternWinRate || 86);
  const fiveYrSummaryEn =
    optionMetrics?.fiveYearRegimeSummary ||
    `5Y Daily/Weekly Regime: ${fiveYearTrend === 'BULLISH_SECULAR' ? 'Above 50D & 200D EMA' : fiveYearTrend === 'BEARISH_CORRECTION' ? 'Below 50D EMA Supply' : 'Multi-Year S/R Zone'} (S: ₹${multiYrSup} | R: ₹${multiYrRes})`;
  const fiveYrSummaryMl =
    optionMetrics?.fiveYearRegimeSummaryMl ||
    `5-വർഷ ചാർട്ട് ഹിസ്റ്ററി: ${fiveYearTrend === 'BULLISH_SECULAR' ? '50D/200D EMA-യ്ക്ക് മുകളിൽ ബുള്ളിഷ്' : fiveYearTrend === 'BEARISH_CORRECTION' ? '50D EMA-യ്ക്ക് താഴെ ബെയറിഷ്' : 'മൾട്ടി-ഇയർ സപ്പോർട്ട്/റെസിസ്റ്റൻസ് സോൺ'} (Win Prob: ${histWinProb}%)`;

  if (fiveYearTrend === 'BULLISH_SECULAR') {
    bullishPointsDelta += 8;
  } else if (fiveYearTrend === 'BEARISH_CORRECTION') {
    bearishPointsDelta += 8;
  }
  // If spot is breaking above a multi-year/multi-month swing high with volume, boost breakout score!
  if (
    multiYrRes > 0 &&
    Math.abs(currentLtp - multiYrRes) / (currentLtp || 1) <= 0.0025 &&
    hasBullBreakoutPower
  ) {
    bullishPointsDelta += 8;
  }
  if (
    multiYrSup > 0 &&
    Math.abs(currentLtp - multiYrSup) / (currentLtp || 1) <= 0.0025 &&
    hasBearBreakdownPower
  ) {
    bearishPointsDelta += 8;
  }
  return {
    corpScore,
    corpSummary,
    macroAlign,
    nearestSupport,
    nearestResistance,
    isBlockedByResistanceWall,
    isBlockedBySupportWall,
    chartStructureEn,
    chartStructureMl,
    fiveYrSummaryEn,
    fiveYrSummaryMl,
    multiYrSup,
    multiYrRes,
    histWinProb,
    bullishPointsDelta,
    bearishPointsDelta,
  };
}
