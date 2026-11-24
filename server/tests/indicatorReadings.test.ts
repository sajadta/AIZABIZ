import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndicatorReadings } from '../../src/utils/indicators/signals/readings';

const base = {
  currentLtp: 25120,
  ema9: 25110,
  ema21: 25040,
  ema50: 24950,
  rsi: 58,
  supertrendDir: 'BUY' as const,
  supertrendVal: 25010,
  macdLine: 12,
  macdSignal: 8,
  macdHist: 4,
  prevMacdHist: -1,
  adxValue: 27,
  vwapPrice: 25050,
};

test('buildIndicatorReadings maps a bullish trend snapshot', () => {
  const r = buildIndicatorReadings(base);
  assert.equal(r.supertrend.signal, 'BUY');
  assert.equal(r.emaCross.signal, 'BULLISH');
  assert.equal(r.macd.cross, 'BULLISH');
  assert.equal(r.macd.macd, 12);
  assert.equal(r.macd.signal, 8);
  assert.equal(r.vwap.position, 'ABOVE');
  assert.equal(r.adx.condition, 'STRONG_TREND');
  assert.equal(r.rsi.condition, 'BULLISH');
});

test('buildIndicatorReadings maps a bearish trend snapshot', () => {
  const r = buildIndicatorReadings({
    ...base,
    currentLtp: 24800,
    ema9: 24900,
    ema21: 25000,
    ema50: 25050,
    rsi: 35,
    supertrendDir: 'SELL',
    macdHist: -6,
    prevMacdHist: 2,
    adxValue: 12,
    vwapPrice: 25050,
  });
  assert.equal(r.emaCross.signal, 'BEARISH');
  assert.equal(r.macd.cross, 'BEARISH');
  assert.equal(r.vwap.position, 'BELOW');
  assert.equal(r.adx.condition, 'SIDEWAYS_CHOP');
  assert.equal(r.rsi.condition, 'BEARISH');
});

test('buildIndicatorReadings flags RSI extremes and neutral chop', () => {
  assert.equal(buildIndicatorReadings({ ...base, rsi: 82 }).rsi.condition, 'OVERBOUGHT');
  assert.equal(buildIndicatorReadings({ ...base, rsi: 18 }).rsi.condition, 'OVERSOLD');
  assert.equal(buildIndicatorReadings({ ...base, rsi: 50 }).rsi.condition, 'NEUTRAL');
  assert.equal(buildIndicatorReadings({ ...base, adxValue: 19 }).adx.condition, 'TRENDING');
});

test('buildIndicatorReadings reports NEUTRAL when EMA9 equals EMA21', () => {
  const r = buildIndicatorReadings({ ...base, ema9: 25000, ema21: 25000, ema50: 25000 });
  assert.equal(r.emaCross.signal, 'NEUTRAL');
});
