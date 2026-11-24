import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLiveTick, mapUpstoxCandles } from '../services/bot/entryScan/candles';

// Upstox returns candles newest-first; the mapper reverses them into ascending order.
const rows = [
  ['2026-11-12T04:05:00+00:00', 25020, 25060, 25010, 25050, 0],
  ['2026-11-12T04:00:00+00:00', 25000, 25040, 24990, 25020, 0],
];

test('mapUpstoxCandles reverses Upstox order into ascending time series', () => {
  const candles = mapUpstoxCandles(rows);
  assert.equal(candles.length, 2);
  assert.equal(candles[0].close, 25020);
  assert.equal(candles[1].close, 25050);
  assert.ok(candles[1].timestamp > candles[0].timestamp);
  assert.match(candles[0].timeStr, /^\d{2}:\d{2}\s?(am|pm)?$/i);
});

test('applyLiveTick overwrites the newest close and expands its range', () => {
  const candles = mapUpstoxCandles(rows);
  applyLiveTick(candles, 25120);
  const last = candles[candles.length - 1];
  assert.equal(last.close, 25120);
  assert.equal(last.high, 25120);

  applyLiveTick(candles, 24900);
  assert.equal(last.low, 24900);
});

test('applyLiveTick leaves candles untouched for an invalid tick', () => {
  const candles = mapUpstoxCandles(rows);
  const before = JSON.stringify(candles);
  applyLiveTick(candles, 0);
  applyLiveTick([], 25000);
  assert.equal(JSON.stringify(candles), before);
});
