import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEffectiveCapital,
  computePaperBalance,
} from '../services/bot/entryScan/capitalSizing';

const base = {
  mode: 'PAPER_TRADING',
  configuredCap: 0,
  liveAvailableMargin: 5000,
  initialCapital: 2000,
  openPaperPositions: [],
  paperTradeHistory: [],
};

test('computePaperBalance subtracts open exposure and adds realized P&L', () => {
  const balance = computePaperBalance({
    initialCapital: 2000,
    openPaperPositions: [{ buyPrice: 100, quantity: 10 }],
    paperTradeHistory: [{ netRealizedPnL: 250 }, { realizedPnL: -50 }],
  });
  assert.equal(balance, 2000 + 200 - 1000);
});

test('computePaperBalance ignores live-mode rows and never goes negative', () => {
  const balance = computePaperBalance({
    initialCapital: 500,
    openPaperPositions: [{ mode: 'UPSTOX_LIVE', buyPrice: 400, quantity: 5 }],
    paperTradeHistory: [{ mode: 'UPSTOX_LIVE', netRealizedPnL: 9000 }],
  });
  assert.equal(balance, 500);
});

test('computeEffectiveCapital uses live margin in UPSTOX_LIVE mode', () => {
  assert.equal(
    computeEffectiveCapital({ ...base, mode: 'UPSTOX_LIVE', liveAvailableMargin: 4200 }),
    4200,
  );
});

test('computeEffectiveCapital caps by a manual override', () => {
  assert.equal(
    computeEffectiveCapital({
      ...base,
      mode: 'UPSTOX_LIVE',
      liveAvailableMargin: 90000,
      configuredCap: 15000,
    }),
    15000,
  );
});

test('computeEffectiveCapital falls back to the paper balance in paper mode', () => {
  assert.equal(
    computeEffectiveCapital({
      ...base,
      initialCapital: 2000,
      paperTradeHistory: [{ netRealizedPnL: 500 }],
      liveAvailableMargin: 99999,
    }),
    2500,
  );
});
