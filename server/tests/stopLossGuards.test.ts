import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateOptionStopLoss, canEnterTradeAfterExit } from './helpers';

test('calculateOptionStopLoss guarantees at least 6 points breathing room on option strike', () => {
  const res = calculateOptionStopLoss(50.0, 50, 12.0);
  assert.ok(res.optionSlPoints >= 6.0, 'SL points must be at least 6.0');
  assert.equal(res.staticStopLossPrice, 42.0);
  assert.ok(
    res.maxAllowedRupeeLoss >= 300,
    'Max rupee loss must be at least ₹300 to survive 1m noise',
  );
  assert.ok(res.maxAllowedRupeeLoss <= 650, 'Max rupee loss must not exceed safety cap ₹650');
});

test('calculateOptionStopLoss handles expensive options safely without blowing account cap', () => {
  const res = calculateOptionStopLoss(120.0, 50, 12.0);
  assert.ok(res.maxAllowedRupeeLoss <= 650, 'Account risk per trade capped safely');
  assert.ok(res.staticStopLossPrice < 120.0);
  assert.ok(res.optionSlPoints * res.qty <= 650, 'Rupee risk must stay inside the cap');
});

test('calculateOptionStopLoss tightens nano positions so a single tick cannot wipe the trade', () => {
  const res = calculateOptionStopLoss(4.0, 20, 18.0);
  assert.ok(res.isNanoDeployedOpt);
  assert.ok(res.optionSlPoints < 4.0, 'Nano stop must sit below entry premium');
  assert.ok(res.maxAllowedRupeeLoss <= 120, 'Nano risk cap stays small');
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
