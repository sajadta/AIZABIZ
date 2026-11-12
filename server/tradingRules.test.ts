import test from 'node:test';
import assert from 'node:assert/strict';

function calculateOptionStopLoss(buyPrice: number, quantity: number, stopLossPercent: number) {
  const effectiveSlPct = Math.max(10.0, Math.min(18.0, Number(stopLossPercent || 14.0)));
  let optionSlPoints = Math.max(6.0, Number((buyPrice * (effectiveSlPct / 100)).toFixed(2)));
  if (buyPrice < 24) {
    optionSlPoints = Math.min(optionSlPoints, Number((buyPrice * 0.25).toFixed(2)));
  }
  const dynamicMaxRupeeLossCap = Math.max(380, Math.min(650, Math.round(optionSlPoints * quantity)));
  if (optionSlPoints * quantity > dynamicMaxRupeeLossCap) {
    optionSlPoints = Number((dynamicMaxRupeeLossCap / quantity).toFixed(2));
  }
  const stopLossPrice = Number(Math.max(0.10, buyPrice - optionSlPoints).toFixed(2));
  return {
    optionSlPoints,
    dynamicMaxRupeeLossCap,
    stopLossPrice,
    maxRupeeLoss: Math.round(optionSlPoints * quantity)
  };
}

function canEnterTradeAfterExit(lastExitTimeMs: number, currentTimeMs: number, cooldownMs: number = 180000): boolean {
  return (currentTimeMs - lastExitTimeMs) >= cooldownMs;
}

test('calculateOptionStopLoss guarantees at least 6 points breathing room on option strike', () => {
  const res = calculateOptionStopLoss(50.0, 50, 12.0);
  assert.ok(res.optionSlPoints >= 6.0, 'SL points must be at least 6.0');
  assert.equal(res.stopLossPrice, 44.0);
  assert.ok(res.maxRupeeLoss >= 300, 'Max rupee loss must be at least ₹300 to survive 1m noise');
  assert.ok(res.maxRupeeLoss <= 650, 'Max rupee loss must not exceed safety cap ₹650');
});

test('calculateOptionStopLoss handles expensive options safely without blowing account cap', () => {
  const res = calculateOptionStopLoss(120.0, 50, 12.0);
  assert.ok(res.maxRupeeLoss <= 650, 'Account risk per trade capped safely');
  assert.ok(res.stopLossPrice < 120.0);
});

test('canEnterTradeAfterExit blocks revenge trading within 3-minute cooldown', () => {
  const exitTime = 1000000;
  // 30 seconds later -> must be blocked
  assert.equal(canEnterTradeAfterExit(exitTime, exitTime + 30000), false);
  // 2 minutes later -> must be blocked
  assert.equal(canEnterTradeAfterExit(exitTime, exitTime + 120000), false);
  // 3 minutes and 1 second later -> allowed
  assert.equal(canEnterTradeAfterExit(exitTime, exitTime + 181000), true);
});
