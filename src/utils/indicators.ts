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
  volume?: number;
  pcr?: number;
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

  // Evaluate individual indicator signals
  const readings: IndicatorReadings = {
    supertrend: {
      signal: supertrendDir,
      value: supertrendVal,
    },
    emaCross: {
      signal:
        ema9 > ema21 && ema21 > ema50
          ? "BULLISH"
          : ema9 < ema21 && ema21 < ema50
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
            : rsi > 55
              ? "BULLISH"
              : rsi < 45
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
      value: Number(
        (
          candles.reduce((acc, c) => acc + c.close * c.volume, 0) /
          candles.reduce((acc, c) => acc + c.volume, 1)
        ).toFixed(2),
      ),
      position:
        currentLtp >=
        candles.reduce((acc, c) => acc + c.close * c.volume, 0) /
          candles.reduce((acc, c) => acc + c.volume, 1)
          ? "ABOVE"
          : "BELOW",
    },
  };

  let bullishPoints = 0;
  let bearishPoints = 0;

  // 1. Supertrend (Institutional Trend Direction) - 30 Points
  if (readings.supertrend.signal === "BUY") bullishPoints += 30;
  else bearishPoints += 30;

  // 2. EMA Cross (Momentum) - 25 Points
  if (readings.emaCross.signal === "BULLISH" && ema9 > ema21 * 1.0005)
    bullishPoints += 25;
  else if (readings.emaCross.signal === "BEARISH" && ema9 < ema21 * 0.9995)
    bearishPoints += 25;

  // 3. RSI (Strength) - 20 Points
  if (readings.rsi.value >= 52 && readings.rsi.value <= 72) bullishPoints += 20;
  else if (readings.rsi.value <= 48 && readings.rsi.value >= 28)
    bearishPoints += 20;

  // 4. MACD (Acceleration) - 15 Points
  if (
    (readings.macd.cross === "BULLISH" || macdHist > 0) &&
    macdHist > prevMacdHist
  )
    bullishPoints += 15;
  else if (
    (readings.macd.cross === "BEARISH" || macdHist < 0) &&
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
  const isBullTrapSweep = lastUpperWick / candleRange > 0.55;
  const isBearTrapSweep = lastLowerWick / candleRange > 0.55;

  if (isBullTrapSweep) {
    bullishPoints -= 25;
    bearishPoints += 10;
  }
  if (isBearTrapSweep) {
    bearishPoints -= 25;
    bullishPoints += 10;
  }

  // 8. Theta Decay Shield (Time-of-day Option Decay Protection)
  const nowIst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hoursIst = nowIst.getHours();
  const minsIst = nowIst.getMinutes();
  const isThetaChopZone = (hoursIst === 11 && minsIst >= 45) || (hoursIst === 12) || (hoursIst === 13 && minsIst <= 15);
  if (isThetaChopZone && Math.abs(macdHist) < 0.5) {
    bullishPoints -= 12;
    bearishPoints -= 12;
  }

  // 9. Volatility & Trap Filter (Penalty)
  if (readings.rsi.value > 80) bullishPoints -= 15;
  if (readings.rsi.value < 20) bearishPoints -= 15;

  // 10. Candlestick Anatomy
  const bodySize = Math.abs(last.close - last.open);
  const totalSize = last.high - last.low;
  const isDoji = totalSize > 0 && bodySize / totalSize < 0.15;
  if (isDoji) {
    bullishPoints -= 10;
    bearishPoints -= 10;
  }

  // 10.5 STRICT IMMEDIATE PRICE ACTION & MOMENTUM ALIGNMENT FILTER (Prevents Counter-Trend Losses!)
  // Even if lagging indicators (SuperTrend / EMA50) point one way, NEVER buy a Call (CE) if the last 3-5 minutes are actively falling,
  // and NEVER buy a Put (PE) if the last 3-5 minutes are actively bouncing/rising!
  const prev3 = candles[Math.max(0, candles.length - 4)];
  const prev5 = candles[Math.max(0, candles.length - 6)];
  const move3m = currentLtp - prev3.close;
  const move5m = currentLtp - prev5.close;
  const lastCandleBullish = currentLtp >= last.open && last.close >= prev.close;
  const lastCandleBearish = currentLtp <= last.open && last.close <= prev.close;

  if (move3m > 0 && move5m > 0 && lastCandleBullish && currentLtp > ema9) {
    // Strong immediate upward thrust: boost CE, strictly block PE!
    bullishPoints += 22;
    bearishPoints -= 45;
  } else if (move3m < 0 && move5m < 0 && lastCandleBearish && currentLtp < ema9) {
    // Strong immediate downward thrust: boost PE, strictly block CE!
    bearishPoints += 22;
    bullishPoints -= 45;
  } else {
    // Mixed or counter-trend chop: penalize whichever side is fighting immediate price action
    if (move3m < 0 || currentLtp < last.open) {
      bullishPoints -= 30; // Block buying CE while current candle/3m is red
    }
    if (move3m > 0 || currentLtp > last.open) {
      bearishPoints -= 30; // Block buying PE while current candle/3m is green
    }
  }

  // 11. LAYER 2: Live Option Premium, Greeks (Delta, Gamma, Theta, IV) & OI Validation
  if (optionMetrics) {
    const absDelta = Math.abs(optionMetrics.delta ?? 0.5);
    // High-responsiveness ATM/ITM Delta (0.45 to 0.72) boosts option profitability
    if (absDelta >= 0.45 && absDelta <= 0.75) {
      if (optionMetrics.optionType === "CE") bullishPoints += 8;
      else bearishPoints += 8;
    } else if (absDelta < 0.25) {
      // Penalize deep OTM lottery strikes that bleed to Theta
      bullishPoints -= 15;
      bearishPoints -= 15;
    }

    // IV Crush Filter: Penalize dangerously inflated Implied Volatility (> 45%)
    if (optionMetrics.iv && optionMetrics.iv > 45) {
      bullishPoints -= 10;
      bearishPoints -= 10;
    }

    // Put-Call Ratio (PCR) Institutional Alignment
    if (optionMetrics.pcr) {
      if (optionMetrics.optionType === "CE" && optionMetrics.pcr >= 0.95) bullishPoints += 5;
      if (optionMetrics.optionType === "PE" && optionMetrics.pcr <= 1.05) bearishPoints += 5;
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

  const isBullish = signalType === "BUY";
  const optType: "CE" | "PE" = optionMetrics?.optionType || (isBullish ? "CE" : "PE");
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
            : "100% High-Accuracy Profit Matrix",
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
