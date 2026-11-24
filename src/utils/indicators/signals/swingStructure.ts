// Historical chart structure: 60-candle swing highs/lows, HH-HL / LH-LL trend
// classification and double top/bottom detection for the confluence engine.

export interface SwingStructureParams {
  candles: any[];
  currentLtp: number;
  atr14: number;
  ema21: number;
}

export interface SwingStructureResult {
  swingHighs: number[];
  swingLows: number[];
  chartStructureEn: string;
  chartStructureMl: string;
  bullishPointsDelta: number;
  bearishPointsDelta: number;
}

export function analyzeSwingStructure({
  candles,
  currentLtp,
  atr14,
  ema21,
}: SwingStructureParams): SwingStructureResult {
  let bullishPointsDelta = 0;
  let bearishPointsDelta = 0;

  // C. Historical Chart Structure (60-Candle Major Swing Highs/Lows, HH-HL / LH-LL, Double Bottom/Top & S/R Runway)
  const historySlice = candles.slice(-Math.min(60, candles.length));
  const priorHistory = historySlice.slice(0, Math.max(5, historySlice.length - 3));
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  for (let i = 4; i < priorHistory.length - 4; i++) {
    const c = priorHistory[i];
    if (
      c.high >= priorHistory[i - 1].high &&
      c.high >= priorHistory[i - 2].high &&
      c.high >= priorHistory[i - 3].high &&
      c.high >= priorHistory[i + 1].high &&
      c.high >= priorHistory[i + 2].high &&
      c.high >= priorHistory[i + 3].high
    ) {
      swingHighs.push(c.high);
    }
    if (
      c.low <= priorHistory[i - 1].low &&
      c.low <= priorHistory[i - 2].low &&
      c.low <= priorHistory[i - 3].low &&
      c.low <= priorHistory[i + 1].low &&
      c.low <= priorHistory[i + 2].low &&
      c.low <= priorHistory[i + 3].low
    ) {
      swingLows.push(c.low);
    }
  }

  let chartStructureEn = 'Institutional Trend Continuation';
  let chartStructureMl = 'ഇൻസ്റ്റിറ്റ്യൂഷണൽ ട്രെൻഡ് തുടർച്ച';

  if (swingLows.length >= 2) {
    const lastLow = swingLows[swingLows.length - 1];
    const prevLow = swingLows[swingLows.length - 2];
    if (Math.abs(lastLow - prevLow) <= atr14 * 0.8 && currentLtp > lastLow + atr14) {
      chartStructureEn = 'Double Bottom (W-Pattern) Support Breakout';
      chartStructureMl = 'ഡബിൾ ബോട്ടം (W-Pattern) സപ്പോർട്ട് ബ്രേക്ക്ഔട്ട്';
      bullishPointsDelta += 12;
    } else if (lastLow > prevLow && currentLtp > ema21) {
      chartStructureEn = 'Higher-High / Higher-Low (HH-HL) Uptrend Structure';
      chartStructureMl = 'ഹയർ-ഹൈ / ഹയർ-ലോ (HH-HL) അപ്‌ട്രെൻഡ് സ്ട്രക്ചർ';
      bullishPointsDelta += 10;
    }
  }
  if (swingHighs.length >= 2) {
    const lastHigh = swingHighs[swingHighs.length - 1];
    const prevHigh = swingHighs[swingHighs.length - 2];
    if (Math.abs(lastHigh - prevHigh) <= atr14 * 0.8 && currentLtp < lastHigh - atr14) {
      chartStructureEn = 'Double Top (M-Pattern) Supply Breakdown';
      chartStructureMl = 'ഡബിൾ ടോപ്പ് (M-Pattern) റെസിസ്റ്റൻസ് ബ്രേക്ക്ഡൗൺ';
      bearishPointsDelta += 12;
    } else if (lastHigh < prevHigh && currentLtp < ema21) {
      chartStructureEn = 'Lower-High / Lower-Low (LH-LL) Downtrend Structure';
      chartStructureMl = 'ലോവർ-ഹൈ / ലോവർ-ലോ (LH-LL) ഡൗൺട്രെൻഡ് സ്ട്രക്ചർ';
      bearishPointsDelta += 10;
    }
  }
  return {
    swingHighs,
    swingLows,
    chartStructureEn,
    chartStructureMl,
    bullishPointsDelta,
    bearishPointsDelta,
  };
}
