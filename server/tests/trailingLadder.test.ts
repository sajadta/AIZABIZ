import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTrailingStopLadder } from '../services/bot/positionMonitor/trailingLadder';

const base = {
  staticStopLossPrice: 90,
  isMicroDeployedOpt: false,
  avgOptionAtr: 2,
  ltp: 108,
  buyPrice: 100,
  posNetPnL: 40,
  peakGainPct: 5,
  peakLtp: 108,
  breakEvenWithBrokerage: 100.4,
  minZeroLossPrice: 101.2,
};

test('computeTrailingStopLadder keeps the static stop while the trade is flat', () => {
  assert.equal(computeTrailingStopLadder(base), 90);
});

test('computeTrailingStopLadder locks breakeven after a small gain', () => {
  const sl = computeTrailingStopLadder({ ...base, peakGainPct: 9, posNetPnL: 80 });
  assert.ok(sl >= 100.4, `expected breakeven lock, got ${sl}`);
});

test('computeTrailingStopLadder never sets a stop at or above the live price', () => {
  // Cheap option: brokerage makes breakeven exceed LTP, so the stop must stay below it.
  const sl = computeTrailingStopLadder({
    ...base,
    buyPrice: 20,
    staticStopLossPrice: 18,
    breakEvenWithBrokerage: 20.6,
    minZeroLossPrice: 21,
    ltp: 20.4,
    peakGainPct: 9,
    peakLtp: 20.4,
  });
  assert.ok(sl <= 20.25, `stop ${sl} should stay below LTP 20.4`);
});

test('computeTrailingStopLadder ratchets harder as the peak gain grows', () => {
  const tier1 = computeTrailingStopLadder({ ...base, peakGainPct: 30, peakLtp: 132, ltp: 130 });
  const tier2 = computeTrailingStopLadder({ ...base, peakGainPct: 40, peakLtp: 142, ltp: 140 });
  const tier3 = computeTrailingStopLadder({ ...base, peakGainPct: 60, peakLtp: 162, ltp: 160 });
  assert.ok(tier2 > tier1, `tier2 ${tier2} should exceed tier1 ${tier1}`);
  assert.ok(tier3 > tier2, `tier3 ${tier3} should exceed tier2 ${tier2}`);
});

test('computeTrailingStopLadder uses lower net triggers for micro-capital options', () => {
  const micro = computeTrailingStopLadder({ ...base, isMicroDeployedOpt: true, posNetPnL: 50 });
  const full = computeTrailingStopLadder({ ...base, isMicroDeployedOpt: false, posNetPnL: 50 });
  assert.ok(micro >= full, `micro ${micro} should lock at least as much as full ${full}`);
});
