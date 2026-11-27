import test from 'node:test';
import assert from 'node:assert/strict';
import type { CandleData } from '../../src/types';
import { detectCandlePattern } from '../../src/utils/indicators/signals/candlePatterns';

const candle = (open: number, high: number, low: number, close: number): CandleData =>
  ({ open, high, low, close, volume: 1000 }) as CandleData;

test('detectCandlePattern scores a bullish engulfing candle with live follow-through', () => {
  const prev3 = candle(104, 105, 102, 103);
  const prev2 = candle(103, 103.5, 99, 100);
  const prev = candle(99.5, 105, 99, 104);
  const result = detectCandlePattern(prev, prev2, prev3, 104.5);
  assert.equal(result.patternEn, 'Bullish Engulfing + Follow-Through Breakout');
  assert.equal(result.bullishPoints, 16);
  assert.equal(result.bearishPoints, 0);
  assert.equal(result.isBullishEngulfing, true);
});

test('detectCandlePattern scores a bearish engulfing candle with live breakdown', () => {
  const prev3 = candle(100, 102, 99, 101);
  const prev2 = candle(101, 105, 100.5, 104);
  const prev = candle(104.5, 105, 99, 100);
  const result = detectCandlePattern(prev, prev2, prev3, 99.5);
  assert.equal(result.patternEn, 'Bearish Engulfing + Breakdown Confirmation');
  assert.equal(result.bearishPoints, 16);
  assert.equal(result.isBearishEngulfing, true);
});

test('detectCandlePattern falls back when an inside bar has no breakout', () => {
  const prev3 = candle(100, 101, 99, 100.5);
  const prev2 = candle(100.5, 101.5, 100, 101);
  const prev = candle(101.2, 101.4, 100.6, 100.9);
  const result = detectCandlePattern(prev, prev2, prev3, 100.9);
  assert.equal(result.patternEn, 'Multi-Candle Structure Follow-Through');
  assert.equal(result.bullishPoints, 0);
  assert.equal(result.bearishPoints, 0);
});

test('detectCandlePattern requires live confirmation and never fires on a closed candle alone', () => {
  const prev3 = candle(104, 105, 102, 103);
  const prev2 = candle(103, 103.5, 99, 100);
  const prev = candle(99.5, 105, 99, 104);
  // price slipped back below the engulfing close -> no bullish confirmation
  const result = detectCandlePattern(prev, prev2, prev3, 103.2);
  assert.notEqual(result.patternEn, 'Bullish Engulfing + Follow-Through Breakout');
  assert.equal(result.isBullishEngulfing, false);
});
