import { CandleData, IndicatorReadings, TradingSignal, StrategyKey } from '../types';

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
  rsi.push(Number((100 - (100 / (1 + rs))).toFixed(2)));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const currentGain = diff >= 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(Number((100 - (100 / (1 + rs))).toFixed(2)));
  }

  // Pad the beginning
  const padding = new Array(period).fill(50);
  return [...padding, ...rsi];
}

export function calculateMACD(closes: number[]): { macd: number[]; signal: number[]; hist: number[] } {
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

export function calculateATR(candles: { high: number; low: number; close: number }[], period: number = 10): number[] {
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
  multiplier: number = 3
): { supertrend: number[]; direction: ('BUY' | 'SELL')[] } {
  const atr = calculateATR(candles, period);
  const supertrend: number[] = [];
  const direction: ('BUY' | 'SELL')[] = [];

  let prevUpper = 0;
  let prevLower = 0;
  let prevTrend: 'BUY' | 'SELL' = 'BUY';

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

    let currentTrend: 'BUY' | 'SELL' = prevTrend;
    if (i > 0) {
      if (prevTrend === 'BUY' && candles[i].close < finalLower) {
        currentTrend = 'SELL';
      } else if (prevTrend === 'SELL' && candles[i].close > finalUpper) {
        currentTrend = 'BUY';
      }
    }

    const stValue = currentTrend === 'BUY' ? finalLower : finalUpper;
    supertrend.push(Number(stValue.toFixed(2)));
    direction.push(currentTrend);

    prevUpper = finalUpper;
    prevLower = finalLower;
    prevTrend = currentTrend;
  }

  return { supertrend, direction };
}

export function calculateBollingerBands(closes: number[], period: number = 20, stdDevMultiplier: number = 2): { upper: number[]; lower: number[]; middle: number[] } {
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
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      upper.push(Number((avg + stdDevMultiplier * stdDev).toFixed(2)));
      lower.push(Number((avg - stdDevMultiplier * stdDev).toFixed(2)));
    }
  }

  return { upper, lower, middle };
}

export function enrichCandlesWithIndicators(rawCandles: { timestamp: number; timeStr: string; open: number; high: number; low: number; close: number; volume: number }[]): CandleData[] {
  if (!rawCandles || rawCandles.length === 0) return [];

  const closes = rawCandles.map(c => c.close);
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

export function analyzeTradingSignals(
  symbol: string,
  name: string,
  instrumentKey: string,
  candles: CandleData[],
  currentLtp: number,
  strategy: StrategyKey = 'PROFIT_MAX_100_PERCENT_MATRIX',
  realOptionPrice?: number
): TradingSignal | null {
  if (!candles || candles.length < 20) return null;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const ema9 = last.ema9 ?? currentLtp;
  const ema21 = last.ema21 ?? currentLtp;
  const ema50 = last.ema50 ?? currentLtp;
  const rsi = last.rsi ?? 50;
  const supertrendDir = last.supertrendDir ?? 'BUY';
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
      signal: ema9 > ema21 && ema21 > ema50 ? 'BULLISH' : (ema9 < ema21 && ema21 < ema50 ? 'BEARISH' : 'NEUTRAL'),
      ema9,
      ema21,
      ema50,
    },
    rsi: {
      value: rsi,
      condition: rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : rsi > 55 ? 'BULLISH' : rsi < 45 ? 'BEARISH' : 'NEUTRAL',
    },
    macd: {
      macd: last.macd ?? 0,
      signal: last.macdSignal ?? 0,
      hist: macdHist,
      cross: macdHist > 0 && prevMacdHist <= 0 ? 'BULLISH' : (macdHist < 0 && prevMacdHist >= 0 ? 'BEARISH' : macdHist > 0 ? 'BULLISH' : 'BEARISH'),
    },
    vwap: {
      value: Number(((candles.reduce((acc, c) => acc + c.close * c.volume, 0)) / (candles.reduce((acc, c) => acc + c.volume, 1))).toFixed(2)),
      position: currentLtp >= ((candles.reduce((acc, c) => acc + c.close * c.volume, 0)) / (candles.reduce((acc, c) => acc + c.volume, 1))) ? 'ABOVE' : 'BELOW',
    },
  };

  let bullishPoints = 0;
  let bearishPoints = 0;

  // Scoring matrix
  if (readings.supertrend.signal === 'BUY') bullishPoints += 30;
  else bearishPoints += 30;

  if (readings.emaCross.signal === 'BULLISH') bullishPoints += 25;
  else if (readings.emaCross.signal === 'BEARISH') bearishPoints += 25;

  if (readings.rsi.value >= 50 && readings.rsi.value <= 72) bullishPoints += 20;
  else if (readings.rsi.value < 50 && readings.rsi.value >= 28) bearishPoints += 20;

  if (readings.macd.cross === 'BULLISH' || macdHist > 0) bullishPoints += 15;
  else if (readings.macd.cross === 'BEARISH' || macdHist < 0) bearishPoints += 15;

  if (readings.vwap.position === 'ABOVE') bullishPoints += 10;
  else bearishPoints += 10;

  const totalBullishConfidence = Math.min(99, Math.max(10, bullishPoints));
  const totalBearishConfidence = Math.min(99, Math.max(10, bearishPoints));

  let signalType: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let confidence = 50;
  let stopLoss = currentLtp * 0.99;
  let target1 = currentLtp * 1.012;
  let target2 = currentLtp * 1.025;
  let target3 = currentLtp * 1.04;
  let rationale = '';
  let rationaleMalayalam = '';

  if (totalBullishConfidence >= 75) {
    signalType = 'BUY';
    confidence = totalBullishConfidence;
    stopLoss = Number((Math.min(supertrendVal, currentLtp * 0.985)).toFixed(2));
    const risk = currentLtp - stopLoss;
    target1 = Number((currentLtp + risk * 1.5).toFixed(2));
    target2 = Number((currentLtp + risk * 2.5).toFixed(2));
    target3 = Number((currentLtp + risk * 4.0).toFixed(2));
    rationale = `Strong Bullish Confluence: SuperTrend Green, EMA9 (${ema9}) > EMA21 (${ema21}), RSI ${rsi} showing strong upward momentum, MACD Histogram positive.`;
    rationaleMalayalam = `ശക്തമായ ബുള്ളിഷ് സിഗ്നൽ: സൂപ്പർട്രെൻഡ് ബൈ മോഡിൽ, EMA ക്രോസ്സ് ഓവർ അനുകൂലം, RSI ${rsi} ശക്തമായ മുന്നേറ്റം കാണിക്കുന്നു, MACD പോസിറ്റീവ് സോണിൽ.`;
  } else if (totalBearishConfidence >= 75) {
    signalType = 'SELL';
    confidence = totalBearishConfidence;
    stopLoss = Number((Math.max(supertrendVal, currentLtp * 1.015)).toFixed(2));
    const risk = stopLoss - currentLtp;
    target1 = Number((currentLtp - risk * 1.5).toFixed(2));
    target2 = Number((currentLtp - risk * 2.5).toFixed(2));
    target3 = Number((currentLtp - risk * 4.0).toFixed(2));
    rationale = `Strong Bearish Confluence: SuperTrend Red, EMA9 (${ema9}) < EMA21 (${ema21}), RSI ${rsi} dropping below equilibrium, MACD Histogram negative.`;
    rationaleMalayalam = `ശക്തമായ ബെയറിഷ് സിഗ്നൽ: സൂപ്പർട്രെൻഡ് സെൽ മോഡിൽ, EMA താഴ്ന്ന ട്രെൻഡിൽ, RSI ${rsi} താഴേക്ക്, വിൽക്കാനുള്ള അനുകൂല ഘടകം.`;
  } else {
    signalType = 'HOLD';
    confidence = 50;
    rationale = `Neutral / Consolidation: Market is hovering near key moving averages without definitive breakout confirmation.`;
    rationaleMalayalam = `വിപണി സന്തുലിത അവസ്ഥയിൽ (HOLD). കൃത്യമായ ബ്രേക്ക്ഔട്ട് വരുന്നതുവരെ കാത്തിരിക്കുക.`;
  }

  const riskDiff = Math.abs(currentLtp - stopLoss);
  const rewardDiff = Math.abs(target1 - currentLtp);
  const rrRatio = `1:${(rewardDiff / (riskDiff || 1)).toFixed(1)}`;

  
  const isBullish = signalType === 'BUY';
  let optSymbol = '';
  if (symbol.includes('NIFTY') && !symbol.includes('BANK') && !symbol.includes('FIN')) {
     const strike = Math.round(currentLtp / 50) * 50;
     optSymbol = `NIFTY ${strike} ${isBullish ? 'CE' : 'PE'}`;
  } else if (symbol.includes('BANK')) {
     const strike = Math.round(currentLtp / 100) * 100;
     optSymbol = `BANKNIFTY ${strike} ${isBullish ? 'CE' : 'PE'}`;
  } else if (symbol.includes('FIN')) {
     const strike = Math.round(currentLtp / 50) * 50;
     optSymbol = `FINNIFTY ${strike} ${isBullish ? 'CE' : 'PE'}`;
  } else if (symbol.includes('SENSEX')) {
     const strike = Math.round(currentLtp / 100) * 100;
     optSymbol = `SENSEX ${strike} ${isBullish ? 'CE' : 'PE'}`;
  }

  
  let optEntry = currentLtp;
  let optSL = stopLoss;
  let optT1 = target1;
  let optT2 = target2;
  let optT3 = target3;

  if (optSymbol) {
     let basePremium = 100;
     if (symbol.includes('BANK')) basePremium = 300;
     else if (symbol.includes('SENSEX')) basePremium = 350;
     
     // USE REAL OPTION PRICE IF AVAILABLE, OTHERWISE USE BASE
     optEntry = realOptionPrice ? realOptionPrice : basePremium;
     
     // Option Stop Loss: typically 20% of premium
     optSL = Number((optEntry * 0.8).toFixed(2));
     const risk = optEntry - optSL;
     
     // Targets based on Risk/Reward multipliers on the premium itself
     optT1 = Number((optEntry + risk * 1.5).toFixed(2));
     optT2 = Number((optEntry + risk * 2.5).toFixed(2));
     optT3 = Number((optEntry + risk * 4.0).toFixed(2));
  }

  return {
    id: `sig_${symbol}_${Date.now()}`,
    symbol: optSymbol || symbol,
    
    name,
    instrumentKey,
    signalType,
    strategyName: strategy === 'SUPERTREND_EMA_CONFLUENCE' ? 'SuperTrend & EMA Confluence' :
      strategy === 'RSI_MOMENTUM_BREAKOUT' ? 'RSI Momentum Breakout' :
      strategy === 'VWAP_INSTITUTIONAL_REVERSION' ? 'VWAP Institutional Bounce' : '100% High-Accuracy Profit Matrix',
    confidenceScore: confidence,
    price: optEntry,
    stopLoss: optSL,
    target1: optT1,
    target2: optT2,
    target3: optT3,
    riskRewardRatio: rrRatio,
    rationale,
    rationaleMalayalam,
    indicators: readings,
    timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    status: 'ACTIVE',
  };
}
