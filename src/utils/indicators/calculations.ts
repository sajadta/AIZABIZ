export function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const emaArray: number[] = [];
  if (data.length === 0) return emaArray;

  let ema = data[0];
  emaArray.push(ema);

  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    emaArray.push(Number(ema.toFixed(2)));
  }
  return emaArray;
}

export function calculateSMA(data: number[], period: number): number[] {
  const smaArray: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      smaArray.push(data[i]);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const sum = slice.reduce((acc, val) => acc + val, 0);
      smaArray.push(Number((sum / period).toFixed(2)));
    }
  }
  return smaArray;
}

export function calculateRSI(closes: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  if (closes.length <= period) {
    return closes.map(() => 50);
  }

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi.push(Number((100 - 100 / (1 + rs)).toFixed(2)));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const currentGain = diff >= 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(Number((100 - 100 / (1 + rs)).toFixed(2)));
  }

  // Pad the beginning
  const padding = new Array(period).fill(50);
  return [...padding, ...rsi];
}

export function calculateMACD(closes: number[]): {
  macd: number[];
  signal: number[];
  hist: number[];
} {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    macdLine.push(Number((ema12[i] - ema26[i]).toFixed(2)));
  }

  const signalLine = calculateEMA(macdLine, 9);
  const hist: number[] = [];

  for (let i = 0; i < macdLine.length; i++) {
    hist.push(Number((macdLine[i] - signalLine[i]).toFixed(2)));
  }

  return { macd: macdLine, signal: signalLine, hist };
}

export function calculateATR(
  candles: { high: number; low: number; close: number }[],
  period: number = 10,
): number[] {
  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low);
    } else {
      const hl = candles[i].high - candles[i].low;
      const hc = Math.abs(candles[i].high - candles[i - 1].close);
      const lc = Math.abs(candles[i].low - candles[i - 1].close);
      tr.push(Math.max(hl, hc, lc));
    }
  }

  return calculateSMA(tr, period);
}

export function calculateSupertrend(
  candles: { high: number; low: number; close: number }[],
  period: number = 10,
  multiplier: number = 3,
): { supertrend: number[]; direction: ("BUY" | "SELL")[] } {
  const atr = calculateATR(candles, period);
  const supertrend: number[] = [];
  const direction: ("BUY" | "SELL")[] = [];

  let prevUpper = 0;
  let prevLower = 0;
  let prevTrend: "BUY" | "SELL" = "BUY";

  for (let i = 0; i < candles.length; i++) {
    const hl2 = (candles[i].high + candles[i].low) / 2;
    let basicUpper = hl2 + multiplier * atr[i];
    let basicLower = hl2 - multiplier * atr[i];

    let finalUpper = basicUpper;
    let finalLower = basicLower;

    if (i > 0) {
      if (basicUpper < prevUpper || candles[i - 1].close > prevUpper) {
        finalUpper = basicUpper;
      } else {
        finalUpper = prevUpper;
      }

      if (basicLower > prevLower || candles[i - 1].close < prevLower) {
        finalLower = basicLower;
      } else {
        finalLower = prevLower;
      }
    }

    let currentTrend: "BUY" | "SELL" = prevTrend;
    if (i > 0) {
      if (prevTrend === "BUY" && candles[i].close < finalLower) {
        currentTrend = "SELL";
      } else if (prevTrend === "SELL" && candles[i].close > finalUpper) {
        currentTrend = "BUY";
      }
    }

    const stValue = currentTrend === "BUY" ? finalLower : finalUpper;
    supertrend.push(Number(stValue.toFixed(2)));
    direction.push(currentTrend);

    prevUpper = finalUpper;
    prevLower = finalLower;
    prevTrend = currentTrend;
  }

  return { supertrend, direction };
}

export function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  stdDevMultiplier: number = 2,
): { upper: number[]; lower: number[]; middle: number[] } {
  const middle = calculateSMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(closes[i]);
      lower.push(closes[i]);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const avg = middle[i];
      const variance =
        slice.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      upper.push(Number((avg + stdDevMultiplier * stdDev).toFixed(2)));
      lower.push(Number((avg - stdDevMultiplier * stdDev).toFixed(2)));
    }
  }

  return { upper, lower, middle };
}

export function calculateADX(
  candles: { high: number; low: number; close: number }[],
  period: number = 14,
): number[] {
  if (!candles || candles.length === 0) return [];
  if (candles.length <= period) {
    return candles.map(() => 20);
  }

  const tr: number[] = [0];
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    tr.push(Math.max(hl, hc, lc));
  }

  const dxList: number[] = new Array(candles.length).fill(20);
  let smoothTR = 0;
  let smoothPlusDM = 0;
  let smoothMinusDM = 0;

  for (let i = 1; i <= period; i++) {
    smoothTR += tr[i];
    smoothPlusDM += plusDM[i];
    smoothMinusDM += minusDM[i];
  }

  for (let i = period; i < candles.length; i++) {
    if (i > period) {
      smoothTR = smoothTR - smoothTR / period + tr[i];
      smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i];
      smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i];
    }
    const plusDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const minusDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
    dxList[i] = Number(dx.toFixed(2));
  }

  const adxSeries = calculateEMA(dxList, period);
  return adxSeries.map((v) => Number(Math.max(5, Math.min(85, v || 20)).toFixed(2)));
}

