import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOptionTrend } from '../services/bot/positionMonitor/optionTrend';

// Upstox 1m candle layout: [time, open, high, low, close, volume], newest first.
const candle = (o: number, h: number, l: number, c: number) => ['t', o, h, l, c, 0];

test('evaluateOptionTrend falls back to a buy-price ATR with too few candles', () => {
  const res = evaluateOptionTrend({
    candles: [candle(100, 101, 99, 100)],
    ltp: 100,
    buyPrice: 100,
    forecastedMaxPrice: 120,
  });
  assert.equal(res.avgOptionAtr, 2.5);
  assert.equal(res.isTrendIntact, true);
  assert.equal(res.isBreakingDown, false);
  assert.equal(res.isClimaxReversal, false);
});

test('evaluateOptionTrend computes ATR from the recent bar ranges', () => {
  const res = evaluateOptionTrend({
    candles: [candle(100, 104, 100, 103), candle(100, 103, 99, 101), candle(100, 102, 98, 100)],
    ltp: 103,
    buyPrice: 100,
    forecastedMaxPrice: 130,
  });
  assert.equal(res.avgOptionAtr, Number(((4 + 4 + 4) / 3).toFixed(2)));
});

test('evaluateOptionTrend keeps the trend intact while price holds the prior low', () => {
  const res = evaluateOptionTrend({
    candles: [candle(100, 105, 101, 104), candle(100, 104, 100, 103), candle(100, 103, 99, 100)],
    ltp: 104,
    buyPrice: 100,
    forecastedMaxPrice: 130,
  });
  assert.equal(res.isTrendIntact, true);
  assert.equal(res.isBreakingDown, false);
});

test('evaluateOptionTrend flags a structural breakdown below both prior lows', () => {
  const res = evaluateOptionTrend({
    candles: [candle(100, 101, 96, 97), candle(102, 103, 99, 100), candle(104, 105, 101, 102)],
    ltp: 96,
    buyPrice: 100,
    forecastedMaxPrice: 130,
  });
  assert.equal(res.isTrendIntact, false);
  assert.equal(res.isBreakingDown, true);
});

test('evaluateOptionTrend flags a climax rejection on a profitable upper wick', () => {
  const res = evaluateOptionTrend({
    candles: [candle(103, 120, 102, 105), candle(100, 104, 99, 103), candle(100, 103, 98, 102)],
    ltp: 105,
    buyPrice: 100,
    forecastedMaxPrice: 150,
  });
  assert.equal(res.isClimaxReversal, true);
});
