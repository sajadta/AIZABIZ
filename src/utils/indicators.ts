import {
  CandleData,
  IndicatorReadings,
  TradingSignal,
  StrategyKey,
} from "../types";

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

export function enrichCandlesWithIndicators(
  rawCandles: {
    timestamp: number;
    timeStr: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[],
): CandleData[] {
  if (!rawCandles || rawCandles.length === 0) return [];

  const closes = rawCandles.map((c) => c.close);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);
  const rsi = calculateRSI(closes, 14);
  const macdObj = calculateMACD(closes);
  const supertrendObj = calculateSupertrend(rawCandles, 10, 3);
  const adxSeries = calculateADX(rawCandles, 14);
  const bb = calculateBollingerBands(closes, 20, 2);

  return rawCandles.map((c, i) => ({
    ...c,
    ema9: ema9[i],
    ema21: ema21[i],
    ema50: ema50[i],
    supertrend: supertrendObj.supertrend[i],
    supertrendDir: supertrendObj.direction[i],
    rsi: rsi[i],
    macd: macdObj.macd[i],
    macdSignal: macdObj.signal[i],
    macdHist: macdObj.hist[i],
    adx: adxSeries[i],
    upperBand: bb.upper[i],
    lowerBand: bb.lower[i],
    middleBand: bb.middle[i],
  }));
}

export interface RealOptionMetrics {
  optionSymbol?: string;
  strikePrice: number;
  optionType: "CE" | "PE";
  ltp: number;
  expiry: string;
  lotSize: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  iv?: number;
  oi?: number;
  oiChange?: number;
  volume?: number;
  pcr?: number;
  bidAskRatio?: number;
  callWallStrike?: number;
  putWallStrike?: number;
  corporateHeavyweightScore?: number; // -100 to +100
  corporateHeavyweightSummary?: string;
  globalMacroAlignment?: "BULLISH" | "BEARISH" | "MIXED";
  fiveYearRegimeTrend?: "BULLISH_SECULAR" | "BEARISH_CORRECTION" | "RANGE_CONSOLIDATION";
  fiveYearRegimeSummary?: string;
  fiveYearRegimeSummaryMl?: string;
  multiYearSupport?: number;
  multiYearResistance?: number;
  historicalPatternWinRate?: number;
  ema200Daily?: number;
  ema50Daily?: number;
  indiaVix?: number;
  instrumentKey?: string;
  affordableLots?: number;
  requiredCapital?: number;
  estimatedBrokerage?: number;
  totalRequiredWithBrokerage?: number;
  expectedNetProfit?: number;
  availableCapital?: number;
}

export interface TradeChargesBreakdown {
  tradeValue: number;
  buyBrokerage: number;
  sellBrokerage: number;
  stt: number;
  exchangeTxnCharge: number;
  sebiCharge: number;
  stampDuty: number;
  gst: number;
  buyCharges: number;
  sellCharges: number;
  roundTripCharges: number;
  totalRequiredWithBrokerage: number;
}

/**
 * Calculates exact Upstox Brokerage + Statutory Taxes (STT, NSE/BSE Exchange Txn, GST 18%, Stamp Duty, SEBI)
 * for both BUY entry and SELL exit (Round-Trip) so account cash checks always include full brokerage!
 */
export function calculateTradeCharges(
  entryPrice: number,
  quantity: number,
  isOption: boolean = true,
  exitPriceOverride?: number,
): TradeChargesBreakdown {
  const qty = Math.max(1, Number(quantity) || 1);
  const buyPrice = Math.max(0, Number(entryPrice) || 0);
  const sellPrice =
    exitPriceOverride !== undefined && exitPriceOverride > 0
      ? Number(exitPriceOverride)
      : Number((buyPrice * 1.25).toFixed(2));

  const buyValue = buyPrice * qty;
  const sellValue = sellPrice * qty;

  if (isOption) {
    // Upstox F&O Options: ₹20 flat per executed order (₹20 Buy + ₹20 Sell = ₹40 base brokerage)
    const buyBrokerage = 20;
    const buyTxn = buyValue * 0.0005; // 0.05% exchange txn charge
    const buySebi = buyValue * 0.000001;
    const buyStamp = buyValue * 0.00003; // 0.003% stamp duty on BUY
    const buyGst = (buyBrokerage + buyTxn + buySebi) * 0.18;
    const buyCharges = buyBrokerage + buyTxn + buySebi + buyStamp + buyGst;

    const sellBrokerage = 20;
    const sellStt = sellValue * 0.001; // 0.1% STT on Option SELL
    const sellTxn = sellValue * 0.0005;
    const sellSebi = sellValue * 0.000001;
    const sellGst = (sellBrokerage + sellTxn + sellSebi) * 0.18;
    const sellCharges = sellBrokerage + sellStt + sellTxn + sellSebi + sellGst;

    const roundTripCharges = Number((buyCharges + sellCharges).toFixed(2));
    return {
      tradeValue: Number(buyValue.toFixed(2)),
      buyBrokerage,
      sellBrokerage,
      stt: Number(sellStt.toFixed(2)),
      exchangeTxnCharge: Number((buyTxn + sellTxn).toFixed(2)),
      sebiCharge: Number((buySebi + sellSebi).toFixed(2)),
      stampDuty: Number(buyStamp.toFixed(2)),
      gst: Number((buyGst + sellGst).toFixed(2)),
      buyCharges: Number(buyCharges.toFixed(2)),
      sellCharges: Number(sellCharges.toFixed(2)),
      roundTripCharges,
      totalRequiredWithBrokerage: Number((buyValue + roundTripCharges).toFixed(2)),
    };
  } else {
    // Equity Intraday/Delivery: min(₹20, 0.05% of turnover)
    const buyBrokerage = Math.min(20, buyValue * 0.0005);
    const buyTxn = buyValue * 0.0000345;
    const buySebi = buyValue * 0.000001;
    const buyStamp = buyValue * 0.00003;
    const buyGst = (buyBrokerage + buyTxn + buySebi) * 0.18;
    const buyCharges = buyBrokerage + buyTxn + buySebi + buyStamp + buyGst;

    const sellBrokerage = Math.min(20, sellValue * 0.0005);
    const sellStt = sellValue * 0.00025;
    const sellTxn = sellValue * 0.0000345;
    const sellSebi = sellValue * 0.000001;
    const sellGst = (sellBrokerage + sellTxn + sellSebi) * 0.18;
    const sellCharges = sellBrokerage + sellStt + sellTxn + sellSebi + sellGst;

    const roundTripCharges = Number((buyCharges + sellCharges).toFixed(2));
    return {
      tradeValue: Number(buyValue.toFixed(2)),
      buyBrokerage: Number(buyBrokerage.toFixed(2)),
      sellBrokerage: Number(sellBrokerage.toFixed(2)),
      stt: Number(sellStt.toFixed(2)),
      exchangeTxnCharge: Number((buyTxn + sellTxn).toFixed(2)),
      sebiCharge: Number((buySebi + sellSebi).toFixed(2)),
      stampDuty: Number(buyStamp.toFixed(2)),
      gst: Number((buyGst + sellGst).toFixed(2)),
      buyCharges: Number(buyCharges.toFixed(2)),
      sellCharges: Number(sellCharges.toFixed(2)),
      roundTripCharges,
      totalRequiredWithBrokerage: Number((buyValue + roundTripCharges).toFixed(2)),
    };
  }
}

/**
 * Calculates how many lots (1 to maxLots) can be bought within availableCapital
 * AFTER including full Round-Trip Brokerage + Statutory Taxes.
 */
export function calculateAffordableLotsWithBrokerage(
  ltp: number,
  lotSize: number,
  availableCapital: number,
  isOption: boolean = true,
  maxLots: number = 5,
): {
  affordableLots: number;
  oneLotPremium: number;
  oneLotBrokerage: number;
  oneLotTotalRequired: number;
} {
  const lotSz = Math.max(1, Number(lotSize) || 1);
  const price = Math.max(0, Number(ltp) || 0);
  const oneLotCharges = calculateTradeCharges(price, lotSz, isOption);

  if (availableCapital <= 0 || price <= 0) {
    return {
      affordableLots: 0,
      oneLotPremium: oneLotCharges.tradeValue,
      oneLotBrokerage: oneLotCharges.roundTripCharges,
      oneLotTotalRequired: oneLotCharges.totalRequiredWithBrokerage,
    };
  }

  let bestLots = 0;
  for (let lots = 1; lots <= maxLots; lots++) {
    const qty = lots * lotSz;
    const charges = calculateTradeCharges(price, qty, isOption);
    if (charges.totalRequiredWithBrokerage <= availableCapital) {
      bestLots = lots;
    } else {
      break;
    }
  }

  return {
    affordableLots: bestLots,
    oneLotPremium: oneLotCharges.tradeValue,
    oneLotBrokerage: oneLotCharges.roundTripCharges,
    oneLotTotalRequired: oneLotCharges.totalRequiredWithBrokerage,
  };
}

export function analyzeTradingSignals(
  symbol: string,
  name: string,
  instrumentKey: string,
  candles: CandleData[],
  currentLtp: number,
  strategy: StrategyKey = "PROFIT_MAX_100_PERCENT_MATRIX",
  realOptionPrice?: number,
  optionMetrics?: RealOptionMetrics,
): TradingSignal | null {
  if (!candles || candles.length < 20) return null;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const ema9 = last.ema9 ?? currentLtp;
  const ema21 = last.ema21 ?? currentLtp;
  const ema50 = last.ema50 ?? currentLtp;
  const rsi = last.rsi ?? 50;
  const supertrendDir = last.supertrendDir ?? "BUY";
  const supertrendVal = last.supertrend ?? currentLtp * 0.98;
  const macdHist = last.macdHist ?? 0;
  const prevMacdHist = prev.macdHist ?? 0;
  const adxValue = Number(last.adx ?? 20);
  const atrSeries = calculateATR(candles, 14);
  const atr14 = atrSeries.length > 0 ? atrSeries[atrSeries.length - 1] : Math.max(1, last.high - last.low);

  // Identify today's intraday session candles (matching the IST date of the latest candle)
  // so yesterday's warmup candles never corrupt today's Session Open or Intraday VWAP!
  const getIstDateKey = (ts: number) =>
    ts > 0
      ? new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
      : "";
  const latestDateKey = getIstDateKey(Number(last.timestamp || 0));
  const todaySessionCandles =
    latestDateKey
      ? candles.filter((c) => getIstDateKey(Number(c.timestamp || 0)) === latestDateKey)
      : [];
  const sessionCandles =
    todaySessionCandles.length >= 3
      ? todaySessionCandles
      : candles.slice(-Math.min(75, candles.length));

  // Compute Intraday VWAP: For Index spot candles where Upstox volume is 0, use Range-Weighted Typical Price VWAP across today's session candles!
  const totalSessionVol = sessionCandles.reduce((acc, c) => acc + Number(c.volume || 0), 0);
  const computedVwap =
    totalSessionVol > 0
      ? sessionCandles.reduce(
          (acc, c) => acc + ((c.high + c.low + c.close) / 3) * Number(c.volume || 0),
          0,
        ) / totalSessionVol
      : sessionCandles.reduce((acc, c) => {
          const tp = (c.high + c.low + c.close) / 3;
          const weight = Math.max(0.05, c.high - c.low);
          return acc + tp * weight;
        }, 0) /
        Math.max(
          0.05,
          sessionCandles.reduce((acc, c) => acc + Math.max(0.05, c.high - c.low), 0),
        );
  const vwapPrice = Number((computedVwap > 0 ? computedVwap : currentLtp).toFixed(2));

  // Evaluate individual indicator signals
  const readings: IndicatorReadings = {
    supertrend: {
      signal: supertrendDir,
      value: supertrendVal,
    },
    emaCross: {
      signal:
        ema9 > ema21 && ema21 >= ema50 * 0.999
          ? "BULLISH"
          : ema9 < ema21 && ema21 <= ema50 * 1.001
            ? "BEARISH"
            : ema9 > ema21
              ? "BULLISH"
              : ema9 < ema21
                ? "BEARISH"
                : "NEUTRAL",
      ema9,
      ema21,
      ema50,
    },
    rsi: {
      value: rsi,
      condition:
        rsi > 70
          ? "OVERBOUGHT"
          : rsi < 30
            ? "OVERSOLD"
            : rsi > 53
              ? "BULLISH"
              : rsi < 47
                ? "BEARISH"
                : "NEUTRAL",
    },
    macd: {
      macd: last.macd ?? 0,
      signal: last.macdSignal ?? 0,
      hist: macdHist,
      cross:
        macdHist > 0 && prevMacdHist <= 0
          ? "BULLISH"
          : macdHist < 0 && prevMacdHist >= 0
            ? "BEARISH"
            : macdHist > 0
              ? "BULLISH"
              : "BEARISH",
    },
    vwap: {
      value: vwapPrice,
      position: currentLtp >= vwapPrice ? "ABOVE" : "BELOW",
    },
    adx: {
      value: adxValue,
      condition:
        adxValue >= 24
          ? "STRONG_TREND"
          : adxValue >= 16
            ? "TRENDING"
            : "SIDEWAYS_CHOP",
    },
  };

  let bullishPoints = 0;
  let bearishPoints = 0;

  // 1. Supertrend (Institutional Trend Direction) - 30 Points
  if (readings.supertrend.signal === "BUY") bullishPoints += 30;
  else bearishPoints += 30;

  // 2. EMA Cross (Momentum) - 25 Points
  if (readings.emaCross.signal === "BULLISH" && ema9 >= ema21)
    bullishPoints += 25;
  else if (readings.emaCross.signal === "BEARISH" && ema9 <= ema21)
    bearishPoints += 25;

  // 3. RSI (Strength) - 20 Points
  if (readings.rsi.value >= 52 && readings.rsi.value <= 75) bullishPoints += 20;
  else if (readings.rsi.value <= 48 && readings.rsi.value >= 25)
    bearishPoints += 20;

  // 4. MACD (Acceleration) - 15 Points
  if (
    readings.macd.cross === "BULLISH" ||
    macdHist > 0 ||
    macdHist > prevMacdHist
  )
    bullishPoints += 15;
  if (
    readings.macd.cross === "BEARISH" ||
    macdHist < 0 ||
    macdHist < prevMacdHist
  )
    bearishPoints += 15;

  // 5. VWAP (Intraday Institutional Average) - 10 Points
  if (readings.vwap.position === "ABOVE") bullishPoints += 10;
  else bearishPoints += 10;

  // 6. Institutional Smart Money Concepts (SMC) & Liquidity Hunt Detection
  const recentCandles = candles.slice(-5);
  let smcBullishImbalance = false;
  let smcBearishImbalance = false;
  if (recentCandles.length >= 3) {
    const c1 = recentCandles[recentCandles.length - 3];
    const c3 = recentCandles[recentCandles.length - 1];
    if (c3.low > c1.high) smcBullishImbalance = true;
    if (c3.high < c1.low) smcBearishImbalance = true;
  }
  if (smcBullishImbalance) bullishPoints += 15;
  if (smcBearishImbalance) bearishPoints += 15;

  // 7. Liquidity Sweep & Retail Trap Filter
  const lastUpperWick = last.high - Math.max(last.open, last.close);
  const lastLowerWick = Math.min(last.open, last.close) - last.low;
  const candleRange = last.high - last.low || 1;
  const isBullTrapSweep = lastUpperWick / candleRange > 0.62;
  const isBearTrapSweep = lastLowerWick / candleRange > 0.62;

  if (isBullTrapSweep) {
    bullishPoints -= 20;
    bearishPoints += 8;
  }
  if (isBearTrapSweep) {
    bearishPoints -= 20;
    bullishPoints += 8;
  }

  // 8. Theta Decay Shield & Opening Whipsaw Protection (Time-of-day Option Protection)
  const nowIst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hoursIst = nowIst.getHours();
  const minsIst = nowIst.getMinutes();
  const isOpening3mWhipsaw = hoursIst === 9 && minsIst >= 15 && minsIst < 18;
  const isThetaChopZone = (hoursIst === 12 && minsIst >= 15 && minsIst <= 45);
  if (isThetaChopZone && Math.abs(macdHist) < 0.35 && adxValue < 16) {
    bullishPoints -= 10;
    bearishPoints -= 10;
  }

  // Calculate Relative Volume (RVOL) over last 20 candles; for Index spot candles (volume=0), use Relative Range/Velocity Expansion!
  const volSlice = candles.slice(-Math.min(20, candles.length));
  const avgVol20 =
    volSlice.reduce((acc, c) => acc + Number(c.volume || 0), 0) /
    Math.max(1, volSlice.length);
  const avgRange20 =
    volSlice.reduce((acc, c) => acc + Math.max(0.05, c.high - c.low), 0) /
    Math.max(1, volSlice.length);
  const recent2MaxRange = Math.max(
    last.high - last.low,
    prev.high - prev.low,
    Math.abs(currentLtp - prev.close),
  );
  const rvol =
    avgVol20 > 0
      ? Number((Number(last.volume || 0) / avgVol20).toFixed(2))
      : avgRange20 > 0
        ? Number(Math.max(0.8, Math.min(3.5, recent2MaxRange / avgRange20)).toFixed(2))
        : 1.15;

  // 8.5 ADX Trend Strength & Choppy/Sideways Market Veto (Prevents buying options in dead sideways markets where Theta eats premium!)
  const adxVal = Number((readings as any).adx?.value ?? 20);
  const isDeadSidewaysChop = adxVal < 14.5 && rvol < 1.1 && Math.abs(macdHist) < 0.4;
  if (adxVal >= 22) {
    if (readings.supertrend.signal === "BUY") bullishPoints += 6;
    else bearishPoints += 6;
  } else if (isDeadSidewaysChop) {
    bullishPoints -= 20;
    bearishPoints -= 20;
  }

  // 9. Volatility & Trap Filter (Penalty)
  if (readings.rsi.value > 82) bullishPoints -= 15;
  if (readings.rsi.value < 18) bearishPoints -= 15;

  // 10. Candlestick Anatomy
  const bodySize = Math.abs(last.close - last.open);
  const totalSize = last.high - last.low;
  const isDoji = totalSize > atr14 * 0.5 && bodySize / totalSize < 0.12;
  if (isDoji) {
    bullishPoints -= 6;
    bearishPoints -= 6;
  }

  // 10.5 MULTI-CANDLE PATTERN RECOGNITION, CHART HISTORY STRUCTURE (HH/HL, DOUBLE BOTTOM/TOP, S/R RUNWAY),
  // 5m/15m MTF CONFLUENCE, CORPORATE HEAVYWEIGHTS & GLOBAL MACRO ALIGNMENT ENGINE
  // A single unclosed green/red candle is NEVER trusted on its own (prevents 1-second green-to-red retail bull/bear traps!).
  const prev2 = candles[Math.max(0, candles.length - 3)];
  const prev3 = candles[Math.max(0, candles.length - 4)];
  const prev5 = candles[Math.max(0, candles.length - 6)];
  const move1m = currentLtp - prev.close;
  const move2m = currentLtp - prev2.close;
  const move3m = currentLtp - prev3.close;
  const move5m = currentLtp - prev5.close;

  // A. Multi-Candle Candlestick Pattern Recognition (Closed Candles prev2, prev + Live Breakout Confirmation on last)
  const prevBody = Math.abs(prev.close - prev.open);
  const prevRange = Math.max(0.01, prev.high - prev.low);
  const prevUpperWick = prev.high - Math.max(prev.open, prev.close);
  const prevLowerWick = Math.min(prev.open, prev.close) - prev.low;
  const prev2Body = Math.abs(prev2.close - prev2.open);

  const isClosedBullishEngulfing =
    prev2.close < prev2.open &&
    prev.close > prev.open &&
    prev.close >= prev2.open &&
    prev.open <= prev2.close &&
    currentLtp >= prev.close;
  const isClosedBearishEngulfing =
    prev2.close > prev2.open &&
    prev.close < prev.open &&
    prev.close <= prev2.open &&
    prev.open >= prev2.close &&
    currentLtp <= prev.close;

  const isClosedHammerSupport =
    prevLowerWick >= prevBody * 1.8 &&
    prevUpperWick <= prevRange * 0.25 &&
    currentLtp > prev.high;
  const isClosedShootingStarResistance =
    prevUpperWick >= prevBody * 1.8 &&
    prevLowerWick <= prevRange * 0.25 &&
    currentLtp < prev.low;

  const isMorningStarReversal =
    prev3.close < prev3.open &&
    prev2Body < Math.abs(prev3.close - prev3.open) * 0.45 &&
    prev.close > prev.open &&
    prev.close > (prev3.open + prev3.close) / 2 &&
    currentLtp >= prev.close;
  const isEveningStarReversal =
    prev3.close > prev3.open &&
    prev2Body < Math.abs(prev3.close - prev3.open) * 0.45 &&
    prev.close < prev.open &&
    prev.close < (prev3.open + prev3.close) / 2 &&
    currentLtp <= prev.close;

  const isInsideBarBullBreakout =
    prev.high <= prev2.high &&
    prev.low >= prev2.low &&
    currentLtp > prev2.high;
  const isInsideBarBearBreakdown =
    prev.high <= prev2.high &&
    prev.low >= prev2.low &&
    currentLtp < prev2.low;

  const isThreeSoldiersThrust =
    prev2.close > prev2.open &&
    prev.close > prev.open &&
    prev.close > prev2.close &&
    currentLtp >= prev.close;
  const isThreeCrowsThrust =
    prev2.close < prev2.open &&
    prev.close < prev.open &&
    prev.close < prev2.close &&
    currentLtp <= prev.close;

  let detectedPatternEn = "Multi-Candle Structure Follow-Through";
  let detectedPatternMl = "മൾട്ടി-കാൻഡിൽ സ്ട്രക്ചർ കൺഫർമേഷൻ";
  let patternDirection: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";

  if (isClosedBullishEngulfing) {
    detectedPatternEn = "Bullish Engulfing + Follow-Through Breakout";
    detectedPatternMl = "ബുള്ളിഷ് എൻഗൾഫിങ് + ബ്രേക്ക്ഔട്ട് കൺഫർമേഷൻ";
    patternDirection = "BULLISH";
    bullishPoints += 16;
  } else if (isMorningStarReversal) {
    detectedPatternEn = "Morning Star 3-Candle Institutional Reversal";
    detectedPatternMl = "മോണിംഗ് സ്റ്റാർ 3-കാൻഡിൽ റിവേഴ്സൽ";
    patternDirection = "BULLISH";
    bullishPoints += 18;
  } else if (isClosedHammerSupport) {
    detectedPatternEn = "Hammer Pin-Bar Liquidity Sweep & Breakout";
    detectedPatternMl = "ഹാമർ പിൻ-ബാർ സപ്പോർട്ട് ബൗൺസ്";
    patternDirection = "BULLISH";
    bullishPoints += 15;
  } else if (isInsideBarBullBreakout) {
    detectedPatternEn = "Inside-Bar Volatility Expansion Breakout";
    detectedPatternMl = "ഇൻസൈഡ്-ബാർ വോളിയം ബ്രേക്ക്ഔട്ട്";
    patternDirection = "BULLISH";
    bullishPoints += 15;
  } else if (isThreeSoldiersThrust) {
    detectedPatternEn = "3-Bar Institutional Momentum Thrust";
    detectedPatternMl = "3-ബാർ ഇൻസ്റ്റിറ്റ്യൂഷണൽ മൊമെന്റം ബ്രേക്ക്ഔട്ട്";
    patternDirection = "BULLISH";
    bullishPoints += 14;
  } else if (isClosedBearishEngulfing) {
    detectedPatternEn = "Bearish Engulfing + Breakdown Confirmation";
    detectedPatternMl = "ബെയറിഷ് എൻഗൾഫിങ് + ബ്രേക്ക്ഡൗൺ കൺഫർമേഷൻ";
    patternDirection = "BEARISH";
    bearishPoints += 16;
  } else if (isEveningStarReversal) {
    detectedPatternEn = "Evening Star 3-Candle Institutional Reversal";
    detectedPatternMl = "ഈവനിംഗ് സ്റ്റാർ 3-കാൻഡിൽ റിവേഴ്സൽ";
    patternDirection = "BEARISH";
    bearishPoints += 18;
  } else if (isClosedShootingStarResistance) {
    detectedPatternEn = "Shooting Star Supply Rejection Breakdown";
    detectedPatternMl = "ഷൂട്ടിംഗ് സ്റ്റാർ റെസിസ്റ്റൻസ് റിജക്ഷൻ";
    patternDirection = "BEARISH";
    bearishPoints += 15;
  } else if (isInsideBarBearBreakdown) {
    detectedPatternEn = "Inside-Bar Downside Expansion Breakdown";
    detectedPatternMl = "ഇൻസൈഡ്-ബാർ ഡൗൺസൈഡ് ബ്രേക്ക്ഡൗൺ";
    patternDirection = "BEARISH";
    bearishPoints += 15;
  } else if (isThreeCrowsThrust) {
    detectedPatternEn = "3-Bar Institutional Bearish Thrust";
    detectedPatternMl = "3-ബാർ ഇൻസ്റ്റിറ്റ്യൂഷണൽ ബെയറിഷ് ബ്രേക്ക്ഡൗൺ";
    patternDirection = "BEARISH";
    bearishPoints += 14;
  }

  // B. 5-Minute & 15-Minute Multi-Timeframe (MTF) Structure Aggregation
  const buildMtfTrend = (groupSize: number): "BULLISH" | "BEARISH" | "NEUTRAL" => {
    if (candles.length < groupSize * 3) return "NEUTRAL";
    const bars: number[] = [];
    for (let i = candles.length - groupSize * 4; i < candles.length; i += groupSize) {
      const slice = candles.slice(Math.max(0, i), Math.min(candles.length, i + groupSize));
      if (slice.length > 0) bars.push(slice[slice.length - 1].close);
    }
    if (bars.length < 2) return "NEUTRAL";
    const latestClose = currentLtp;
    const prevBarClose = bars[bars.length - 2];
    const avgClose = bars.reduce((a, b) => a + b, 0) / bars.length;
    if (latestClose > prevBarClose && latestClose >= avgClose) return "BULLISH";
    if (latestClose < prevBarClose && latestClose <= avgClose) return "BEARISH";
    return "NEUTRAL";
  };
  const tf5m = buildMtfTrend(5);
  const tf15m = buildMtfTrend(15);
  if (tf5m === "BULLISH" && tf15m === "BULLISH") bullishPoints += 12;
  else if (tf5m === "BEARISH" && tf15m === "BEARISH") bearishPoints += 12;
  else if (tf5m === "BULLISH") bullishPoints += 6;
  else if (tf5m === "BEARISH") bearishPoints += 6;

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

  let chartStructureEn = "Institutional Trend Continuation";
  let chartStructureMl = "ഇൻസ്റ്റിറ്റ്യൂഷണൽ ട്രെൻഡ് തുടർച്ച";

  if (swingLows.length >= 2) {
    const lastLow = swingLows[swingLows.length - 1];
    const prevLow = swingLows[swingLows.length - 2];
    if (Math.abs(lastLow - prevLow) <= atr14 * 0.8 && currentLtp > lastLow + atr14) {
      chartStructureEn = "Double Bottom (W-Pattern) Support Breakout";
      chartStructureMl = "ഡബിൾ ബോട്ടം (W-Pattern) സപ്പോർട്ട് ബ്രേക്ക്ഔട്ട്";
      bullishPoints += 12;
    } else if (lastLow > prevLow && currentLtp > ema21) {
      chartStructureEn = "Higher-High / Higher-Low (HH-HL) Uptrend Structure";
      chartStructureMl = "ഹയർ-ഹൈ / ഹയർ-ലോ (HH-HL) അപ്‌ട്രെൻഡ് സ്ട്രക്ചർ";
      bullishPoints += 10;
    }
  }
  if (swingHighs.length >= 2) {
    const lastHigh = swingHighs[swingHighs.length - 1];
    const prevHigh = swingHighs[swingHighs.length - 2];
    if (Math.abs(lastHigh - prevHigh) <= atr14 * 0.8 && currentLtp < lastHigh - atr14) {
      chartStructureEn = "Double Top (M-Pattern) Supply Breakdown";
      chartStructureMl = "ഡബിൾ ടോപ്പ് (M-Pattern) റെസിസ്റ്റൻസ് ബ്രേക്ക്ഡൗൺ";
      bearishPoints += 12;
    } else if (lastHigh < prevHigh && currentLtp < ema21) {
      chartStructureEn = "Lower-High / Lower-Low (LH-LL) Downtrend Structure";
      chartStructureMl = "ലോവർ-ഹൈ / ലോവർ-ലോ (LH-LL) ഡൗൺട്രെൻഡ് സ്ട്രക്ചർ";
      bearishPoints += 10;
    }
  }

  // D. Corporate Heavyweights Flow & Global/Macro Market Alignment
  const corpScore = Number(optionMetrics?.corporateHeavyweightScore ?? 0);
  const corpSummary =
    optionMetrics?.corporateHeavyweightSummary ||
    "Heavyweights (HDFCBANK, RELIANCE, ICICIBANK, INFY, TCS) Tracked";
  const macroAlign = optionMetrics?.globalMacroAlignment || (tf15m === "BULLISH" ? "BULLISH" : tf15m === "BEARISH" ? "BEARISH" : "MIXED");

  // Calculate Nearest Resistance & Nearest Support + Resistance-Shattering Breakout Engine
  const resistancesAbove = swingHighs.filter((h) => h > currentLtp + atr14 * 0.3).sort((a, b) => a - b);
  const supportsBelow = swingLows.filter((l) => l < currentLtp - atr14 * 0.3).sort((a, b) => b - a);
  const callWall = optionMetrics?.callWallStrike && optionMetrics.callWallStrike > currentLtp ? optionMetrics.callWallStrike : 0;
  const putWall = optionMetrics?.putWallStrike && optionMetrics.putWallStrike < currentLtp ? optionMetrics.putWallStrike : 0;

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
          resistancesAbove[1] ||
          nearestResistance + Math.max(atr14 * 3.0, currentLtp * 0.0035)
        ).toFixed(2),
      );
      chartStructureEn = `Resistance-Shattering Breakout (RVOL ${rvol}x + Short Covering)`;
      chartStructureMl = `റെസിസ്റ്റൻസ് ഭേദിച്ചുള്ള വോളിയം ബ്രേക്ക്ഔട്ട് (RVOL ${rvol}x)`;
      bullishPoints += 14;
    } else if (move1m <= 0 && move2m <= 0) {
      // Stalling right under resistance without momentum -> Trap Protection!
      isBlockedByResistanceWall = true;
    }
  }

  if (distToSup <= atr14 * 0.85) {
    if (hasBearBreakdownPower && (currentLtp <= prev.close || move1m < 0)) {
      // Support is being SHATTERED! Shift target runway to the next lower support (S2) and boost score!
      nearestSupport = Number(
        (
          supportsBelow[1] ||
          nearestSupport - Math.max(atr14 * 3.0, currentLtp * 0.0035)
        ).toFixed(2),
      );
      chartStructureEn = `Support-Shattering Breakdown (RVOL ${rvol}x + Long Unwinding)`;
      chartStructureMl = `സപ്പോർട്ട് ഭേദിച്ചുള്ള ശക്തമായ ബ്രേക്ക്ഡൗൺ (RVOL ${rvol}x)`;
      bearishPoints += 14;
    } else if (move1m >= 0 && move2m >= 0) {
      // Stalling right above support without downward momentum -> Trap Protection!
      isBlockedBySupportWall = true;
    }
  }

  if (corpScore >= 25) {
    bullishPoints += 12;
    bearishPoints -= 15;
  } else if (corpScore <= -25) {
    bearishPoints += 12;
    bullishPoints -= 15;
  }

  if (macroAlign === "BULLISH") bullishPoints += 8;
  else if (macroAlign === "BEARISH") bearishPoints += 8;

  // D2. 5-Year Historical Daily/Weekly Macro Regime, 200-Day/50-Day EMA & Multi-Year Support/Resistance Confluence
  const fiveYearTrend = optionMetrics?.fiveYearRegimeTrend || "BULLISH_SECULAR";
  const multiYrSup = Number(optionMetrics?.multiYearSupport || nearestSupport);
  const multiYrRes = Number(optionMetrics?.multiYearResistance || nearestResistance);
  const histWinProb = Number(optionMetrics?.historicalPatternWinRate || 86);
  const fiveYrSummaryEn =
    optionMetrics?.fiveYearRegimeSummary ||
    `5Y Daily/Weekly Regime: ${fiveYearTrend === "BULLISH_SECULAR" ? "Above 50D & 200D EMA" : fiveYearTrend === "BEARISH_CORRECTION" ? "Below 50D EMA Supply" : "Multi-Year S/R Zone"} (S: ₹${multiYrSup} | R: ₹${multiYrRes})`;
  const fiveYrSummaryMl =
    optionMetrics?.fiveYearRegimeSummaryMl ||
    `5-വർഷ ചാർട്ട് ഹിസ്റ്ററി: ${fiveYearTrend === "BULLISH_SECULAR" ? "50D/200D EMA-യ്ക്ക് മുകളിൽ ബുള്ളിഷ്" : fiveYearTrend === "BEARISH_CORRECTION" ? "50D EMA-യ്ക്ക് താഴെ ബെയറിഷ്" : "മൾട്ടി-ഇയർ സപ്പോർട്ട്/റെസിസ്റ്റൻസ് സോൺ"} (Win Prob: ${histWinProb}%)`;

  if (fiveYearTrend === "BULLISH_SECULAR") {
    bullishPoints += 8;
  } else if (fiveYearTrend === "BEARISH_CORRECTION") {
    bearishPoints += 8;
  }
  // If spot is breaking above a multi-year/multi-month swing high with volume, boost breakout score!
  if (multiYrRes > 0 && Math.abs(currentLtp - multiYrRes) / (currentLtp || 1) <= 0.0025 && hasBullBreakoutPower) {
    bullishPoints += 8;
  }
  if (multiYrSup > 0 && Math.abs(currentLtp - multiYrSup) / (currentLtp || 1) <= 0.0025 && hasBearBreakdownPower) {
    bearishPoints += 8;
  }

  // E. Anti-Fakeout, Session Macro Trend Veto & Multi-Candle Confirmation Gate
  // 1. Intraday Session Trend & VWAP Regime Filter using TODAY'S 9:15 AM IST Open (sessionCandles[0].open)
  const sessionOpen = Number(sessionCandles[0]?.open || currentLtp);
  const sessionChangePct =
    sessionOpen > 0 ? ((currentLtp - sessionOpen) / sessionOpen) * 100 : 0;
  const vwapVal = readings.vwap.value || currentLtp;
  // Only block counter-trend trades if the index is in a massive one-way runaway session AND SuperTrend has NOT flipped to confirm the reversal!
  const isStrongBullishSessionDay =
    sessionChangePct >= 0.65 &&
    currentLtp > vwapVal &&
    currentLtp > ema50 &&
    readings.supertrend.signal === "BUY";
  const isStrongBearishSessionDay =
    sessionChangePct <= -0.65 &&
    currentLtp < vwapVal &&
    currentLtp < ema50 &&
    readings.supertrend.signal === "SELL";

  const isMacroAndHeavyweightVetoBull =
    corpScore <= -45 &&
    macroAlign === "BEARISH" &&
    readings.supertrend.signal === "SELL";
  const isMacroAndHeavyweightVetoBear =
    corpScore >= 45 &&
    macroAlign === "BULLISH" &&
    readings.supertrend.signal === "BUY";

  const recent3High = Math.max(last.high, prev.high, prev2.high);
  const recent3Low = Math.min(last.low, prev.low, prev2.low);

  const currentRange = Math.max(0.01, last.high - last.low);
  const prevCandleRange = Math.max(0.01, prev.high - prev.low);
  const bullCloseStrength = (currentLtp - last.low) / currentRange;
  const bearCloseStrength = (last.high - currentLtp) / currentRange;
  const prevBullCloseStrength = (prev.close - prev.low) / prevCandleRange;
  const prevBearCloseStrength = (prev.high - prev.close) / prevCandleRange;
  const pullbackFrom3mHigh = recent3High - currentLtp;
  const bounceFrom3mLow = currentLtp - recent3Low;

  // Institutional Trend Alignment Gate: Never buy Calls against a Bearish SuperTrend below EMA21, or Puts against a Bullish SuperTrend above EMA21
  const isTrendAlignedBull =
    readings.supertrend.signal === "BUY" ||
    (currentLtp > ema21 && ema9 >= ema21 && currentLtp > vwapVal);
  const isTrendAlignedBear =
    readings.supertrend.signal === "SELL" ||
    (currentLtp < ema21 && ema9 <= ema21 && currentLtp < vwapVal);

  const isMultiCandleBullConfirmed =
    isTrendAlignedBull &&
    ((currentLtp >= last.open && move1m >= 0) ||
      (prev.close > prev.open && currentLtp >= prev.close * 0.9997) ||
      (move2m > 0 && move3m > 0 && currentLtp >= prev.close * 0.9995)) &&
    (move2m > 0 || move3m > 0 || move5m > 0) &&
    (currentLtp >= ema9 * 0.9995 || (currentLtp > prev.high && move1m > 0)) &&
    (ema9 >= ema21 * 0.999 || (readings.supertrend.signal === "BUY" && currentLtp >= ema21 * 0.9995)) &&
    (bullCloseStrength >= 0.35 || (prev.close > prev.open && prevBullCloseStrength >= 0.55 && currentLtp >= prev.close * 0.9996)) &&
    !isClosedShootingStarResistance &&
    !isClosedBearishEngulfing &&
    !isBlockedByResistanceWall &&
    !isStrongBearishSessionDay &&
    !isDeadSidewaysChop &&
    !isOpening3mWhipsaw &&
    !isMacroAndHeavyweightVetoBull &&
    pullbackFrom3mHigh <= Math.max(atr14 * 1.4, currentLtp * 0.002);

  const isMultiCandleBearConfirmed =
    isTrendAlignedBear &&
    ((currentLtp <= last.open && move1m <= 0) ||
      (prev.close < prev.open && currentLtp <= prev.close * 1.0003) ||
      (move2m < 0 && move3m < 0 && currentLtp <= prev.close * 1.0005)) &&
    (move2m < 0 || move3m < 0 || move5m < 0) &&
    (currentLtp <= ema9 * 1.0005 || (currentLtp < prev.low && move1m < 0)) &&
    (ema9 <= ema21 * 1.001 || (readings.supertrend.signal === "SELL" && currentLtp <= ema21 * 1.0005)) &&
    (bearCloseStrength >= 0.35 || (prev.close < prev.open && prevBearCloseStrength >= 0.55 && currentLtp <= prev.close * 1.0004)) &&
    !isClosedHammerSupport &&
    !isClosedBullishEngulfing &&
    !isBlockedBySupportWall &&
    !isStrongBullishSessionDay &&
    !isDeadSidewaysChop &&
    !isOpening3mWhipsaw &&
    !isMacroAndHeavyweightVetoBear &&
    bounceFrom3mLow <= Math.max(atr14 * 1.4, currentLtp * 0.002);

  // Anti-Climax / Over-Extension Guard: Block buying Calls at RSI > 73 or buying Puts at RSI < 27 (wait for EMA9 pullback before next impulse)
  const distFromEma9 = Math.abs(currentLtp - ema9);
  const isOverExtendedBull =
    readings.rsi.value > 73 ||
    (atr14 > 0 && distFromEma9 > atr14 * 2.8 && currentLtp > ema9) ||
    (atr14 > 0 && Math.abs(move3m) > atr14 * 4.2);
  const isOverExtendedBear =
    readings.rsi.value < 27 ||
    (atr14 > 0 && distFromEma9 > atr14 * 2.8 && currentLtp < ema9) ||
    (atr14 > 0 && Math.abs(move3m) > atr14 * 4.2);

  if (isMultiCandleBullConfirmed && !isOverExtendedBull) {
    bullishPoints += 18;
    bearishPoints = Math.min(bearishPoints, 25);
  } else {
    bullishPoints = Math.min(bullishPoints, corpScore <= -35 ? 48 : 64);
  }

  if (isMultiCandleBearConfirmed && !isOverExtendedBear) {
    bearishPoints += 18;
    bullishPoints = Math.min(bullishPoints, 25);
  } else {
    bearishPoints = Math.min(bearishPoints, corpScore >= 35 ? 48 : 64);
  }

  // India VIX & Market Regime Selection (Trending Option Buying vs High-VIX Breakout vs Low-VIX Range Guard)
  const indiaVixVal = Number(optionMetrics?.indiaVix || 13.8);
  const marketRegimeMode: "TRENDING_OPTION_BUYING" | "HIGH_VIX_BREAKOUT" | "LOW_VIX_RANGE_GUARD" =
    adxValue < 16 || (indiaVixVal > 0 && indiaVixVal < 11.5)
      ? "LOW_VIX_RANGE_GUARD"
      : indiaVixVal >= 18
        ? "HIGH_VIX_BREAKOUT"
        : "TRENDING_OPTION_BUYING";

  // 11. LAYER 2: Live Option Premium, Greeks (Delta, Gamma, Theta, IV), OI Change, Volume & Order Book Depth Validation
  let oiBuildupDesc = "Balanced Institutional OI";
  const effectiveOptDir: "CE" | "PE" =
    optionMetrics && Number(optionMetrics.ltp) > 0 && optionMetrics.optionType
      ? optionMetrics.optionType
      : bullishPoints > bearishPoints && corpScore >= -15
        ? "CE"
        : "PE";

  if (optionMetrics) {
    const absDelta = Math.abs(optionMetrics.delta ?? 0.5);
    const optGamma = Math.abs(optionMetrics.gamma ?? 0.0012);
    const optTheta = Math.abs(optionMetrics.theta ?? 8);
    const optLtpRef = Math.max(1, optionMetrics.ltp || 100);
    const thetaDecayRatio = optTheta / optLtpRef;

    // 1. Delta (Δ): Directional speed sweet spot (0.45 to 0.75)
    if (absDelta >= 0.45 && absDelta <= 0.75) {
      if (effectiveOptDir === "CE") bullishPoints += 8;
      else bearishPoints += 8;
    } else if (absDelta < 0.25) {
      bullishPoints -= 15;
      bearishPoints -= 15;
    }

    // 2. Gamma (Γ): Non-linear premium acceleration on breakout
    if (optGamma >= 0.0008) {
      if (effectiveOptDir === "CE") bullishPoints += 6;
      else bearishPoints += 6;
    }

    // 3. Theta (Θ): Protect against rapid time-decay traps when volume is low
    if (thetaDecayRatio > 0.22 && rvol < 1.2) {
      bullishPoints -= 15;
      bearishPoints -= 15;
    }

    // 4. Implied Volatility (IV): Avoid IV Crush (> 45%) and reward healthy IV (10% - 35%)
    if (optionMetrics.iv && optionMetrics.iv > 45) {
      bullishPoints -= 12;
      bearishPoints -= 12;
    } else if (optionMetrics.iv && optionMetrics.iv >= 10 && optionMetrics.iv <= 35) {
      if (effectiveOptDir === "CE") bullishPoints += 4;
      else bearishPoints += 4;
    }

    // 5. Put-Call Ratio (PCR) & Option Volume
    if (optionMetrics.pcr) {
      if (effectiveOptDir === "CE" && optionMetrics.pcr >= 0.95) bullishPoints += 5;
      if (effectiveOptDir === "PE" && optionMetrics.pcr <= 1.05) bearishPoints += 5;
    }

    // 6. OI Change & Order Book Bid/Ask Imbalance Analysis
    const oiChg = Number(optionMetrics.oiChange ?? 0);
    const bidAskRatio = Number(optionMetrics.bidAskRatio ?? 1.0);
    if (effectiveOptDir === "CE") {
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

  const totalBullishConfidence = Math.min(99, Math.max(10, bullishPoints));
  const totalBearishConfidence = Math.min(99, Math.max(10, bearishPoints));

  let signalType: "BUY" | "SELL" | "HOLD" = "HOLD";
  let confidence = 50;
  let stopLoss = currentLtp * 0.99;
  let target1 = currentLtp * 1.012;
  let target2 = currentLtp * 1.025;
  let target3 = currentLtp * 1.04;
  let rationale = "";
  let rationaleMalayalam = "";

  const symUpper = symbol.toUpperCase();
  let indexPrefix = symUpper;
  let strikeStep = 50;
  if (symUpper.includes("BANKEX")) {
    indexPrefix = "BANKEX";
    strikeStep = 100;
  } else if (symUpper.includes("SENSEX")) {
    indexPrefix = "SENSEX";
    strikeStep = 100;
  } else if (symUpper.includes("MID SELECT") || symUpper.includes("MIDCP")) {
    indexPrefix = "MIDCPNIFTY";
    strikeStep = 25;
  } else if (symUpper.includes("FIN")) {
    indexPrefix = "FINNIFTY";
    strikeStep = 50;
  } else if (symUpper.includes("BANK")) {
    indexPrefix = "BANKNIFTY";
    strikeStep = 100;
  } else if (symUpper.includes("NIFTY")) {
    indexPrefix = "NIFTY";
    strikeStep = 50;
  }

  if (totalBullishConfidence >= 60) {
    signalType = "BUY";
    confidence = totalBullishConfidence;
    stopLoss = Number(Math.min(supertrendVal, currentLtp * 0.985).toFixed(2));
    const risk = currentLtp - stopLoss;
    target1 = Number((currentLtp + risk * 1.5).toFixed(2));
    target2 = Number((currentLtp + risk * 2.5).toFixed(2));
    target3 = Number((currentLtp + risk * 4.0).toFixed(2));
    rationale = `[Layer-1 Index + Layer-2 Option Premium Confluence] ${symbol} Spot (₹${currentLtp}) is bullish: SuperTrend BUY, EMA9 (${ema9}) > EMA21 (${ema21}), RSI ${rsi}.`;
    rationaleMalayalam = `[ഇൻഡക്സ് + ഓപ്ഷൻ പ്രീമിയം അനാലിസിസ്] ${symbol} സ്പോട്ട് (₹${currentLtp}) ശക്തമായ ബുള്ളിഷ് ട്രെൻഡിൽ: സൂപ്പർട്രെൻഡ് ബൈ മോഡിൽ, EMA9 > EMA21, RSI ${rsi}.`;
  } else if (totalBearishConfidence >= 60) {
    signalType = "SELL";
    confidence = totalBearishConfidence;
    stopLoss = Number(Math.max(supertrendVal, currentLtp * 1.015).toFixed(2));
    const risk = stopLoss - currentLtp;
    target1 = Number((currentLtp - risk * 1.5).toFixed(2));
    target2 = Number((currentLtp - risk * 2.5).toFixed(2));
    target3 = Number((currentLtp - risk * 4.0).toFixed(2));
    rationale = `[Layer-1 Index + Layer-2 Option Premium Confluence] ${symbol} Spot (₹${currentLtp}) is bearish: SuperTrend SELL, EMA9 (${ema9}) < EMA21 (${ema21}), RSI ${rsi} -> Buying PUT (PE) Option.`;
    rationaleMalayalam = `[ഇൻഡക്സ് + ഓപ്ഷൻ പ്രീമിയം അനാലിസിസ്] ${symbol} സ്പോട്ട് (₹${currentLtp}) ബെയറിഷ് ട്രെൻഡിൽ: സൂപ്പർട്രെൻഡ് സെൽ, EMA താഴേക്ക് -> ലാഭകരമായ PUT (PE) ഓപ്ഷൻ വാങ്ങുന്നു.`;
  } else {
    signalType = "HOLD";
    confidence = 50;
    rationale = `Neutral / Consolidation: Market is hovering near key moving averages without definitive breakout confirmation.`;
    rationaleMalayalam = `വിപണി സന്തുലിത അവസ്ഥയിൽ (HOLD). കൃത്യമായ ബ്രേക്ക്ഔട്ട് വരുന്നതുവരെ കാത്തിരിക്കുക.`;
  }

  const riskDiff = Math.abs(currentLtp - stopLoss);
  const rewardDiff = Math.abs(target1 - currentLtp);
  const rrRatio = `1:${(rewardDiff / (riskDiff || 1)).toFixed(1)}`;

  const isBullish =
    signalType === "BUY" ||
    (signalType === "HOLD" && totalBullishConfidence > totalBearishConfidence && corpScore >= -15);
  const optType: "CE" | "PE" =
    optionMetrics && Number(optionMetrics.ltp) > 0 && optionMetrics.optionType
      ? optionMetrics.optionType
      : isBullish
        ? "CE"
        : "PE";
  const defaultStrike = Math.round(currentLtp / strikeStep) * strikeStep;
  const chosenStrike = optionMetrics?.strikePrice || defaultStrike;

  let optSymbol = optionMetrics?.optionSymbol || "";
  if (!optSymbol && (symUpper.includes("NIFTY") || symUpper.includes("SENSEX") || symUpper.includes("BANKEX") || symUpper.includes("MIDCP"))) {
    optSymbol = `${indexPrefix} ${chosenStrike} ${optType}`;
  }

  let optEntry = currentLtp;
  let optSL = stopLoss;
  let optT1 = target1;
  let optT2 = target2;
  let optT3 = target3;

  if (optSymbol) {
    let basePremium = 100;
    if (indexPrefix === "BANKNIFTY" || indexPrefix === "BANKEX") basePremium = 280;
    else if (indexPrefix === "SENSEX") basePremium = 320;
    else if (indexPrefix === "MIDCPNIFTY") basePremium = 65;

    optEntry = Number((optionMetrics?.ltp || realOptionPrice || basePremium).toFixed(2));

    // Option Stop Loss: 15% of option premium for tight risk control, Targets 1.6x, 2.8x, 4.2x
    optSL = Number((optEntry * 0.85).toFixed(2));
    const risk = Math.max(1, optEntry - optSL);

    optT1 = Number((optEntry + risk * 1.8).toFixed(2));
    optT2 = Number((optEntry + risk * 3.0).toFixed(2));
    optT3 = Number((optEntry + risk * 4.5).toFixed(2));

    const lotSzForCalc = optionMetrics?.lotSize || 1;
    const oneLotCharges = calculateTradeCharges(optEntry, lotSzForCalc, true, optT1);
    const estBrokerage = optionMetrics?.estimatedBrokerage ?? oneLotCharges.roundTripCharges;
    const totalReqWithBrok =
      optionMetrics?.totalRequiredWithBrokerage ?? oneLotCharges.totalRequiredWithBrokerage;
    const grossProfit1Lot = (optT1 - optEntry) * lotSzForCalc;
    const netProfit1Lot =
      optionMetrics?.expectedNetProfit ?? Number((grossProfit1Lot - estBrokerage).toFixed(2));

    if (optionMetrics) {
      const capNoteEn = ` | 1 Lot (${lotSzForCalc} Qty): Premium ₹${oneLotCharges.tradeValue.toLocaleString("en-IN")} + Brokerage & Taxes ₹${estBrokerage.toFixed(0)} = Total ₹${totalReqWithBrok.toLocaleString("en-IN")} (Est. Net Profit: +₹${netProfit1Lot.toFixed(0)})${optionMetrics.affordableLots ? ` [${optionMetrics.affordableLots} Lot Fit Balance]` : ""}`;
      const capNoteMl = ` | 1 ലോട്ട് (${lotSzForCalc} Qty): പ്രീമിയം ₹${oneLotCharges.tradeValue.toLocaleString("en-IN")} + ബ്രോക്കറേജ് & ടാക്സ് ₹${estBrokerage.toFixed(0)} = ആകെ ₹${totalReqWithBrok.toLocaleString("en-IN")} (അറ്റ ലാഭം: +₹${netProfit1Lot.toFixed(0)})${optionMetrics.affordableLots ? ` [ബാലൻസിൽ വാങ്ങാവുന്നത്: ${optionMetrics.affordableLots} Lot]` : ""}`;
      rationale += ` Selected high-momentum ${optSymbol} @ ₹${optEntry} (Δ ${Number(optionMetrics.delta ?? 0.52).toFixed(2)}, IV ${Number(optionMetrics.iv ?? 14).toFixed(1)}%)${capNoteEn}.`;
      rationaleMalayalam += ` തിരഞ്ഞെടുത്ത ലാഭകരമായ ഓപ്ഷൻ: ${optSymbol} @ ₹${optEntry} (Δ ${Number(optionMetrics.delta ?? 0.52).toFixed(2)}, IV ${Number(optionMetrics.iv ?? 14).toFixed(1)}%)${capNoteMl}.`;
    }
  }

  const fallbackLotSz = optionMetrics?.lotSize || 1;
  const fallbackCharges = optSymbol
    ? calculateTradeCharges(optEntry, fallbackLotSz, true, optT1)
    : undefined;

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
      clearRunwayPoints * absDeltaForForecast + 0.5 * gammaForForecast * Math.pow(Math.min(clearRunwayPoints, atr14 * 3), 2),
    ).toFixed(2),
  );
  const estimatedMaxOptionPrice = Number((optEntry + estOptionGainPts).toFixed(2));
  const estMinsLow = Math.max(2, Math.round(clearRunwayPoints / Math.max(1, atr14 * 1.1)));
  const estMinsHigh = Math.min(25, Math.max(estMinsLow + 3, Math.round(clearRunwayPoints / Math.max(1, atr14 * 0.55))));
  const estimatedMinutesToTarget = `${estMinsLow}–${estMinsHigh} mins`;
  const effectiveLotsForEst = Math.max(1, optionMetrics?.affordableLots || 1);
  const effectiveQtyForEst = effectiveLotsForEst * fallbackLotSz;
  const estBrokTotal = (optionMetrics?.estimatedBrokerage || fallbackCharges?.roundTripCharges || 60) * effectiveLotsForEst;
  const minNetProfitEst = Math.max(
    180,
    Math.round((optT1 - optEntry) * effectiveQtyForEst - estBrokTotal),
  );
  const maxNetProfitEst = Math.max(
    minNetProfitEst + 150,
    Math.round(estOptionGainPts * effectiveQtyForEst - estBrokTotal),
  );
  const estimatedNetProfitRange = `+₹${minNetProfitEst.toLocaleString("en-IN")} to +₹${maxNetProfitEst.toLocaleString("en-IN")} Net`;

  return {
    id: `sig_${symbol}_${Date.now()}`,
    symbol: optSymbol || symbol,
    name,
    instrumentKey: optionMetrics?.instrumentKey || instrumentKey,
    underlyingInstrumentKey: instrumentKey,
    signalType,
    strategyName:
      strategy === "SUPERTREND_EMA_CONFLUENCE"
        ? "SuperTrend & EMA Confluence"
        : strategy === "RSI_MOMENTUM_BREAKOUT"
          ? "RSI Momentum Breakout"
          : strategy === "VWAP_INSTITUTIONAL_REVERSION"
            ? "VWAP Institutional Bounce"
            : "7-Layer Institutional Profit Matrix",
    confidenceScore: confidence,
    confidence,
    price: optEntry,
    stopLoss: optSL,
    target1: optT1,
    target2: optT2,
    target3: optT3,
    riskRewardRatio: rrRatio,
    rationale,
    rationaleMalayalam,
    indicators: readings,
    candlestickPattern: detectedPatternEn,
    candlestickPatternMalayalam: detectedPatternMl,
    mtfConfirmation: {
      status:
        (isBullish && tf5m === "BULLISH" && tf15m !== "BEARISH") ||
        (!isBullish && tf5m === "BEARISH" && tf15m !== "BULLISH"),
      timeframe5m: tf5m,
      timeframe15m: tf15m,
    },
    institutionalQuantAnalysis: {
      chartStructurePattern: chartStructureEn,
      chartStructurePatternMl: chartStructureMl,
      nearestSupport,
      nearestResistance,
      clearRunwayPoints,
      corporateHeavyweightScore: corpScore,
      corporateHeavyweightSummary: corpSummary,
      globalMacroAlignment: macroAlign,
      oiBuildupType: oiBuildupDesc,
      estimatedMinutesToTarget,
      estimatedMaxOptionPrice,
      estimatedNetProfitRange,
      fiveYearRegimeSummary: fiveYrSummaryEn,
      fiveYearRegimeSummaryMl: fiveYrSummaryMl,
      multiYearSupport: multiYrSup,
      multiYearResistance: multiYrRes,
      historicalWinProbability: histWinProb,
      indiaVix: indiaVixVal,
      marketRegimeMode,
      optionExecutionSide:
        signalType === "BUY" || signalType === "SELL"
          ? "OPTION_BUYING"
          : marketRegimeMode === "LOW_VIX_RANGE_GUARD"
            ? "MULTI_LEG_STRANGLE"
            : "OPTION_SELLING",
      multiLegDetails: {
        strategyType: adxValue < 16 ? "SHORT_STRANGLE" : "SHORT_STRADDLE",
        callStrike: chosenStrike + (adxValue < 16 ? strikeStep * 2 : 0),
        callLtp: Number((optEntry * 0.85).toFixed(2)),
        putStrike: chosenStrike - (adxValue < 16 ? strikeStep * 2 : 0),
        putLtp: Number((optEntry * 0.82).toFixed(2)),
        combinedPremiumCollected: Number((optEntry * 1.67).toFixed(2)),
        thetaDecayPerDayRupees: Math.round(Math.abs(optionMetrics?.theta ?? 8) * 1.8 * fallbackLotSz),
        upperBreakeven: Math.round(chosenStrike + strikeStep * 2 + optEntry * 1.67),
        lowerBreakeven: Math.round(chosenStrike - strikeStep * 2 - optEntry * 1.67),
      },
    },
    recommendedOptionStrike: optSymbol
      ? {
          strikePrice: chosenStrike,
          optionType: optType,
          ltp: optEntry,
          expiry: optionMetrics?.expiry || "Current Weekly",
          delta: Number((optionMetrics?.delta ?? (isBullish ? 0.54 : -0.54)).toFixed(2)),
          lotSize: optionMetrics?.lotSize,
          iv: optionMetrics?.iv,
          oi: optionMetrics?.oi,
          volume: optionMetrics?.volume,
          instrumentKey: optionMetrics?.instrumentKey,
          requiredCapital: optionMetrics?.requiredCapital ?? fallbackCharges?.tradeValue,
          estimatedBrokerage: optionMetrics?.estimatedBrokerage ?? fallbackCharges?.roundTripCharges,
          totalRequiredWithBrokerage:
            optionMetrics?.totalRequiredWithBrokerage ?? fallbackCharges?.totalRequiredWithBrokerage,
          expectedNetProfit:
            optionMetrics?.expectedNetProfit ??
            (fallbackCharges
              ? Number(((optT1 - optEntry) * fallbackLotSz - fallbackCharges.roundTripCharges).toFixed(2))
              : undefined),
          affordableLots: optionMetrics?.affordableLots,
          availableCapital: optionMetrics?.availableCapital,
          underlyingSpot: currentLtp,
        }
      : undefined,
    timestamp: new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    status: "ACTIVE",
  };
}
