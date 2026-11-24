/**
 * institutionalQuant.ts
 * Advanced institutional quant metrics: VWAP Multi-Sigma Channels, Order Book Bid-Ask Depth Pressure,
 * 0DTE Expiry Gamma Explosion detection, and Intermarket Correlation.
 */

export interface VwapSigmaResult {
  vwap: number;
  upper1: number;
  lower1: number;
  upper2: number;
  lower2: number;
  position: 'ABOVE_UPPER2' | 'BETWEEN_UPPER1_2' | 'ABOVE_VWAP' | 'BELOW_VWAP' | 'BETWEEN_LOWER1_2' | 'BELOW_LOWER2';
}

/**
 * Calculates VWAP and Multi-Sigma standard deviation bands for mean-reversion & breakout confirmation.
 */
export function calculateVwapSigmaBands(candles: any[], currentLtp: number): VwapSigmaResult {
  if (!candles || candles.length === 0) {
    return { vwap: currentLtp, upper1: currentLtp, lower1: currentLtp, upper2: currentLtp, lower2: currentLtp, position: 'ABOVE_VWAP' };
  }

  let cumulativeVwapVol = 0;
  let cumulativeVol = 0;
  const closes: number[] = [];

  for (const c of candles) {
    const typical = Number((c.high + c.low + c.close) / 3);
    const vol = Number(c.volume || 1);
    cumulativeVwapVol += typical * vol;
    cumulativeVol += vol;
    closes.push(c.close);
  }

  const vwap = cumulativeVol > 0 ? Number((cumulativeVwapVol / cumulativeVol).toFixed(2)) : currentLtp;

  // Calculate standard deviation of closes around VWAP
  const variance = closes.reduce((sum, p) => sum + Math.pow(p - vwap, 2), 0) / Math.max(1, closes.length);
  const stdev = Math.sqrt(variance) || (vwap * 0.002);

  const upper1 = Number((vwap + stdev).toFixed(2));
  const lower1 = Number((vwap - stdev).toFixed(2));
  const upper2 = Number((vwap + stdev * 2).toFixed(2));
  const lower2 = Number((vwap - stdev * 2).toFixed(2));

  let position: VwapSigmaResult['position'] = 'ABOVE_VWAP';
  if (currentLtp >= upper2) position = 'ABOVE_UPPER2';
  else if (currentLtp >= upper1) position = 'BETWEEN_UPPER1_2';
  else if (currentLtp > vwap) position = 'ABOVE_VWAP';
  else if (currentLtp === vwap) position = 'ABOVE_VWAP';
  else if (currentLtp >= lower1) position = 'BELOW_VWAP';
  else if (currentLtp >= lower2) position = 'BETWEEN_LOWER1_2';
  else position = 'BELOW_LOWER2';

  return { vwap, upper1, lower1, upper2, lower2, position };
}

/**
 * Evaluates Order Book Bid-Ask Depth Pressure (sum of top 5 bid quantities vs ask quantities).
 */
export function evaluateDepthPressure(totalBidQty: number, totalAskQty: number): { ratio: number; sentiment: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH' } {
  const bids = Math.max(1, Number(totalBidQty || 1));
  const asks = Math.max(1, Number(totalAskQty || 1));
  const ratio = Number((bids / asks).toFixed(2));

  let sentiment: ReturnType<typeof evaluateDepthPressure>['sentiment'] = 'NEUTRAL';
  if (ratio >= 2.2) sentiment = 'STRONG_BULLISH';
  else if (ratio >= 1.25) sentiment = 'BULLISH';
  else if (ratio <= 0.45) sentiment = 'STRONG_BEARISH';
  else if (ratio <= 0.80) sentiment = 'BEARISH';

  return { ratio, sentiment };
}

/**
 * Detects 0DTE Expiry Day Gamma Explosion conditions (high acceleration in final hours).
 */
export function detect0DteGammaExplosion(candles: any[], currentLtp: number): boolean {
  if (!candles || candles.length < 5) return false;
  const nowIst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hour = nowIst.getHours();
  const minute = nowIst.getMinutes();
  const isExpiryAfternoon = hour >= 13 && (hour < 15 || (hour === 15 && minute <= 20));

  if (!isExpiryAfternoon) return false;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const rangeLast = Math.max(0.01, last.high - last.low);
  const rangePrev = Math.max(0.01, prev.high - prev.low);

  return rangeLast >= rangePrev * 1.5 && Math.abs(currentLtp - prev.close) >= rangePrev * 0.8;
}

/**
 * Evaluates Intermarket Correlation (Gift Nifty proxy, USDINR, etc.).
 */
export function evaluateIntermarketCorrelation(giftNiftyChgPct: number): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  if (giftNiftyChgPct >= 0.25) return 'BULLISH';
  if (giftNiftyChgPct <= -0.25) return 'BEARISH';
  return 'NEUTRAL';
}
