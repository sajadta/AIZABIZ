import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEffectiveHoldingQuantity } from '../lib/portfolioNormalize';

test('computeEffectiveHoldingQuantity subtracts cnc_used_quantity for holdings sold today', () => {
  assert.deepEqual(
    computeEffectiveHoldingQuantity({ quantity: 15, t1_quantity: 0, cnc_used_quantity: 1 }),
    { remainingQty: 14, soldTodayQty: 1, rawTotalQty: 15 },
  );
  assert.deepEqual(
    computeEffectiveHoldingQuantity({ quantity: 39, t1_quantity: 21, cnc_used_quantity: 39 }),
    { remainingQty: 0, soldTodayQty: 39, rawTotalQty: 60 },
  );
  assert.deepEqual(
    computeEffectiveHoldingQuantity({ quantity: 0, t1_quantity: 10, cnc_used_quantity: 0 }),
    { remainingQty: 10, soldTodayQty: 0, rawTotalQty: 10 },
  );
});
