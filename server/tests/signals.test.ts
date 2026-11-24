import test from 'node:test';
import assert from 'node:assert/strict';
import type { CandleData } from '../../src/types';
import { analyzeTradingSignals } from '../../src/utils/indicators/signals';

test('analyzeTradingSignals rejects narrow 12-bar sideways chop box as HOLD instead of triggering 0DTE chop entries', () => {
  // Reproduces NIFTY 12:00-12:25 25-pt (<0.10%) sideways chop box with EMA21 crossbacks & ADX ~17
  const baseTs = Date.UTC(2026, 10, 17, 6, 30, 0); // 12:00 IST
  const chopPrices = [
    25488, 25494, 25485, 25492, 25483, 25491, 25486, 25495, 25484, 25493, 25487, 25494, 25485,
    25491, 25486, 25492, 25488, 25493, 25487, 25492, 25486, 25491, 25488, 25493, 25487, 25492,
    25488, 25491, 25489, 25493,
  ];
  const candles: CandleData[] = chopPrices.map((close, idx) => ({
    time: new Date(baseTs + idx * 60_000).toISOString(),
    timestamp: baseTs + idx * 60_000,
    open: idx === 0 ? 25486 : chopPrices[idx - 1],
    high: Math.max(close, idx === 0 ? 25486 : chopPrices[idx - 1]) + 2.5,
    low: Math.min(close, idx === 0 ? 25486 : chopPrices[idx - 1]) - 2.5,
    close,
    volume: 1000,
    ema9: 25489,
    ema21: 25489.5,
    ema50: 25482,
    rsi: 54,
    supertrend: 25478,
    supertrendDir: 'BUY',
    macdHist: 0.45,
    adx: 17.5,
  }));

  const sig = analyzeTradingSignals('NIFTY 50', 'NIFTY 50', 'NSE_INDEX|Nifty 50', candles, 25493);
  assert.ok(sig);
  assert.equal(
    sig!.signalType,
    'HOLD',
    'Narrow 25-pt (<0.14%) chop box must stay HOLD to stop 0DTE theta chop losses',
  );
});

test('analyzeTradingSignals vetoes counter-trend CE bounce below rolling 30m VWAP during midday crash & fires clean trend breakout', () => {
  // Morning rally from 25280 -> 25500 followed by 35-bar crash down to 25395 (still near old morning session VWAP,
  // but well below rolling 30-minute VWAP and with bearish clock-aligned 15m/5m bars).
  const startTs = Date.UTC(2026, 10, 17, 3, 45, 0); // 09:15 IST
  const candles: CandleData[] = [];
  for (let i = 0; i < 65; i++) {
    const ts = startTs + i * 60_000;
    let close: number;
    if (i < 30) {
      close = 25280 + i * 7.5; // +220pt rally -> 25505
    } else if (i < 63) {
      close = 25505 - (i - 29) * 3.5; // -115pt steady crash -> 25389.5
    } else {
      close = i === 63 ? 25392 : 25396; // Tiny +6.5pt dead-cat bounce
    }
    const prevC = i === 0 ? 25278 : candles[i - 1].close;
    const isCrash = i >= 30;
    candles.push({
      time: new Date(ts).toISOString(),
      timestamp: ts,
      open: prevC,
      high: Math.max(prevC, close) + 3,
      low: Math.min(prevC, close) - 3,
      close,
      volume: 10000,
      ema9: isCrash ? close + 6 : close - 5,
      ema21: isCrash ? close + 16 : close - 14,
      ema50: isCrash ? close + 28 : close - 25,
      rsi: isCrash ? 38 : 66,
      supertrend: isCrash ? close + 22 : close - 22,
      supertrendDir: isCrash ? 'SELL' : 'BUY',
      macdHist: isCrash ? -1.4 : 1.4,
      adx: 28,
    });
  }

  const counterTrendCeBounce = analyzeTradingSignals(
    'NIFTY 50',
    'NIFTY 50',
    'NSE_INDEX|Nifty 50',
    candles,
    25396,
  );
  assert.ok(counterTrendCeBounce);
  assert.notEqual(
    counterTrendCeBounce!.signalType,
    'BUY',
    'Tiny bounce inside a -115pt crash below rolling 30m VWAP must NEVER fire BUY (CE)',
  );

  // Now simulate clean breakdown continuation (last bar closes red at 25382 breaking lows) -> should allow high-conviction SELL (PE)
  const breakdownCandles = candles.slice(0, -2);
  breakdownCandles.push({
    ...candles[candles.length - 3],
    time: new Date(startTs + 63 * 60_000).toISOString(),
    timestamp: startTs + 63 * 60_000,
    open: 25393,
    high: 25394,
    low: 25384,
    close: 25385,
    ema9: 25392,
    ema21: 25405,
    ema50: 25420,
    rsi: 34,
    supertrend: 25410,
    supertrendDir: 'SELL',
    macdHist: -1.9,
    adx: 31,
  });
  breakdownCandles.push({
    ...candles[candles.length - 3],
    time: new Date(startTs + 64 * 60_000).toISOString(),
    timestamp: startTs + 64 * 60_000,
    open: 25385,
    high: 25386,
    low: 25374,
    close: 25376,
    ema9: 25386,
    ema21: 25400,
    ema50: 25418,
    rsi: 32,
    supertrend: 25405,
    supertrendDir: 'SELL',
    macdHist: -2.2,
    adx: 32,
  });

  const cleanBearBreakdown = analyzeTradingSignals(
    'NIFTY 50',
    'NIFTY 50',
    'NSE_INDEX|Nifty 50',
    breakdownCandles,
    25376,
  );
  assert.ok(cleanBearBreakdown);
  assert.equal(
    cleanBearBreakdown!.signalType,
    'SELL',
    'Aligned clock-MTF + rolling VWAP + breakdown must fire SELL (PE)',
  );
  assert.ok(cleanBearBreakdown!.confidence >= 68);
});

test('analyzeTradingSignals preserves BUY signal when 5m/15m SuperTrend & VWAP uptrend confirm despite mild -33 sector divergence', () => {
  const startTs = Date.UTC(2026, 10, 19, 3, 45, 0); // 09:15 IST
  const candles: CandleData[] = [];
  for (let i = 0; i < 32; i++) {
    const close = 81900 + i * 6.5;
    const prevC = i === 0 ? 81895 : candles[i - 1].close;
    candles.push({
      time: new Date(startTs + i * 60_000).toISOString(),
      timestamp: startTs + i * 60_000,
      open: prevC,
      high: close + 5,
      low: prevC - 3,
      close,
      volume: 10000,
      ema9: close - 20,
      ema21: close - 45,
      ema50: close - 70,
      rsi: 64,
      supertrend: close - 55,
      supertrendDir: 'BUY',
      macdHist: 12.5,
      adx: 24,
    });
  }
  const sig = analyzeTradingSignals(
    'SENSEX',
    'SENSEX',
    'BSE_INDEX|SENSEX',
    candles,
    candles[candles.length - 1].close,
    'PROFIT_MAX_100_PERCENT_MATRIX',
    6.7,
    {
      strikePrice: 83300,
      optionType: 'CE',
      ltp: 6.7,
      expiry: '2026-11-19',
      lotSize: 20,
      delta: 0.0289,
      gamma: 0.0001,
      theta: -6,
      iv: 18,
      corporateHeavyweightScore: -33,
      availableCapital: 182.39,
    },
  );
  assert.ok(sig);
  assert.equal(
    sig!.signalType,
    'BUY',
    'Strong aligned 5m/15m uptrend above VWAP must not be vetoed by mild -33 divergence',
  );
  assert.ok(
    sig!.confidenceScore >= 78,
    `Expected >=78 confidence for micro/nano option setup, got ${sig!.confidenceScore}`,
  );
});
