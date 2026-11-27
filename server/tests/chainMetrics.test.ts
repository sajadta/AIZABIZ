import test from 'node:test';
import assert from 'node:assert/strict';
import { computeChainOiMetrics } from '../services/bot/entryScan/chainMetrics';

const row = (strike: number, callOi: number, putOi: number) => ({
  strike_price: strike,
  call_options: { market_data: { oi: callOi } },
  put_options: { market_data: { oi: putOi } },
});

test('computeChainOiMetrics returns PCR and OI walls around spot', () => {
  const rows = [
    row(24900, 1200, 5400),
    row(25000, 4300, 3100),
    row(25100, 8800, 900),
    row(25200, 2100, 400),
  ];
  const m = computeChainOiMetrics(rows, 25050);
  assert.equal(m.chainPcr, Number((9800 / 16400).toFixed(2)));
  assert.equal(m.callWallStrike, 25100);
  assert.equal(m.maxCallWallOi, 8800);
  assert.equal(m.putWallStrike, 24900);
  assert.equal(m.maxPutWallOi, 5400);
});

test('computeChainOiMetrics defaults PCR to 1 when no call OI exists', () => {
  const m = computeChainOiMetrics([row(25000, 0, 900)], 25000);
  assert.equal(m.chainPcr, 1.0);
  assert.equal(m.callWallStrike, 0);
  assert.equal(m.putWallStrike, 0);
});

test('computeChainOiMetrics tolerates an empty chain', () => {
  const m = computeChainOiMetrics([], 25000);
  assert.deepEqual(m, {
    chainPcr: 1,
    callWallStrike: 0,
    maxCallWallOi: 0,
    putWallStrike: 0,
    maxPutWallOi: 0,
  });
});
