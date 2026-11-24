import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRvol, evaluateVolumeRegime } from '../../src/utils/indicators/signals/volumeRegime';

const candle = (o: number, h: number, l: number, c: number, v: number) => ({
  open: o,
  high: h,
  low: l,
  close: c,
  volume: v,
});

const flatHistory = Array.from({ length: 20 }, () => candle(100, 101, 99, 100, 1000));

test('computeRvol compares the newest volume with the trailing 20-bar average', () => {
  // The window includes the newest bar, so 19 flat bars + a 2500 bar average 1075.
  const candles = [...flatHistory.slice(0, 19), candle(100, 102, 99, 101, 2500)];
  const rvol = computeRvol({
    candles,
    last: candles[candles.length - 1],
    prev: candles[candles.length - 2],
    currentLtp: 101,
  });
  assert.equal(rvol, Number((2500 / ((19 * 1000 + 2500) / 20)).toFixed(2)));
});

test('computeRvol falls back to range expansion for volume-less index candles', () => {
  const indexCandles = Array.from({ length: 20 }, () => candle(25000, 25010, 24990, 25000, 0));
  indexCandles.push(candle(25000, 25040, 24995, 25030, 0));
  const rvol = computeRvol({
    candles: indexCandles,
    last: indexCandles[indexCandles.length - 1],
    prev: indexCandles[indexCandles.length - 2],
    currentLtp: 25030,
  });
  assert.ok(rvol > 1.2, `expected expansion, got ${rvol}`);
  assert.ok(rvol <= 3.5);
});

test('evaluateVolumeRegime rewards a bullish volume spike', () => {
  const candles = [...flatHistory, candle(100, 105, 99.5, 104, 5000)];
  const res = evaluateVolumeRegime({
    candles,
    last: candles[candles.length - 1],
    prev: candles[candles.length - 2],
    currentLtp: 104,
    rsi: 62,
  });
  assert.equal(res.isDarkPoolBullishBlock, true);
  assert.equal(res.isDarkPoolBearishBlock, false);
  assert.ok(res.bullishPoints >= 22);
  assert.equal(res.bearishPoints, 0);
  assert.ok(res.neuralQuantConfidenceWeight >= 0.65);
});

test('evaluateVolumeRegime rewards a bearish volume spike', () => {
  const candles = [...flatHistory, candle(104, 104.5, 99, 99.5, 5000)];
  const res = evaluateVolumeRegime({
    candles,
    last: candles[candles.length - 1],
    prev: candles[candles.length - 2],
    currentLtp: 99.5,
    rsi: 40,
  });
  assert.equal(res.isDarkPoolBearishBlock, true);
  assert.ok(res.bearishPoints >= 22);
});

test('evaluateVolumeRegime awards nothing on quiet normal volume', () => {
  const candles = [...flatHistory, candle(100, 101, 99, 100.5, 1000)];
  const res = evaluateVolumeRegime({
    candles,
    last: candles[candles.length - 1],
    prev: candles[candles.length - 2],
    currentLtp: 100.5,
    rsi: 50,
  });
  assert.equal(res.isDarkPoolBullishBlock, false);
  assert.equal(res.isDarkPoolBearishBlock, false);
  assert.equal(res.bullishPoints, 0);
  assert.equal(res.bearishPoints, 0);
});
