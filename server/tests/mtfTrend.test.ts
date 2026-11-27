import test from 'node:test';
import assert from 'node:assert/strict';
import type { CandleData } from '../../src/types';
import { buildMtfTrend } from '../../src/utils/indicators/signals/mtfTrend';

const buildCandles = (closes: number[], startMs: number, stepMs = 60_000): CandleData[] =>
  closes.map((close, i) => ({
    timestamp: startMs + i * stepMs,
    open: i === 0 ? close : closes[i - 1],
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  })) as CandleData[];

test('buildMtfTrend returns NEUTRAL when there are not enough candles for the timeframe', () => {
  const candles = buildCandles([100, 101, 102], Date.UTC(2026, 10, 17, 3, 45));
  assert.equal(buildMtfTrend(candles, 102, 5), 'NEUTRAL');
});

test('buildMtfTrend detects a bullish higher-high higher-low structure with clock-aligned IST bars', () => {
  const closes: number[] = [];
  for (let i = 0; i < 40; i++) closes.push(100 + i * 2);
  const candles = buildCandles(closes, Date.UTC(2026, 10, 17, 3, 45));
  assert.equal(buildMtfTrend(candles, closes[closes.length - 1], 5), 'BULLISH');
});

test('buildMtfTrend detects a bearish lower-high lower-low structure', () => {
  const closes: number[] = [];
  for (let i = 0; i < 40; i++) closes.push(200 - i * 2);
  const candles = buildCandles(closes, Date.UTC(2026, 10, 17, 3, 45));
  assert.equal(buildMtfTrend(candles, closes[closes.length - 1], 5), 'BEARISH');
});

test('buildMtfTrend falls back to positional grouping when candles carry no timestamps', () => {
  const closes: number[] = [];
  for (let i = 0; i < 40; i++) closes.push(100 + i);
  const candles = closes.map((close, i) => ({
    open: i === 0 ? close : closes[i - 1],
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume: 500,
  })) as CandleData[];
  assert.equal(buildMtfTrend(candles, closes[closes.length - 1], 5), 'BULLISH');
});
