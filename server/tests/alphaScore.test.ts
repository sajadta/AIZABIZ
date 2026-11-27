import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAlphaScore } from '../services/bot/entryScan/alphaScore';

const base = {
  effectiveTarget1: 120,
  optionPrice: 100,
  targetQuantity: 75,
  totalTradeBrokerage: 80,
  totalRequiredCash: 7600,
  hasMtfConfirmation: true,
  rvol: 1.5,
  confidenceScore: 90,
};

test('computeAlphaScore derives net profit from the target when none is supplied', () => {
  const res = computeAlphaScore(base);
  assert.equal(res.expectedNetProfit, (120 - 100) * 75 - 80);
  assert.equal(res.profitYield, Number((1420 / 7600).toString()));
});

test('computeAlphaScore honours an explicit expected net profit', () => {
  const res = computeAlphaScore({ ...base, expectedNetProfit: 900 });
  assert.equal(res.expectedNetProfit, 900);
});

test('computeAlphaScore floors net profit at 350 for thin setups', () => {
  const res = computeAlphaScore({ ...base, effectiveTarget1: 100.5, targetQuantity: 75 });
  assert.equal(res.expectedNetProfit, 350);
});

test('computeAlphaScore rewards MTF confluence and clamps RVOL', () => {
  const withMtf = computeAlphaScore(base);
  const withoutMtf = computeAlphaScore({ ...base, hasMtfConfirmation: false });
  assert.ok(withMtf.alphaOpportunityScore > withoutMtf.alphaOpportunityScore);

  const extreme = computeAlphaScore({ ...base, rvol: 50 });
  const clamped = computeAlphaScore({ ...base, rvol: 2 });
  assert.equal(extreme.alphaOpportunityScore, clamped.alphaOpportunityScore);
});

test('computeAlphaScore defaults confidence and RVOL when absent', () => {
  const res = computeAlphaScore({ ...base, confidenceScore: undefined, rvol: undefined });
  const explicit = computeAlphaScore({ ...base, confidenceScore: 85, rvol: 1.15 });
  assert.equal(res.alphaOpportunityScore, explicit.alphaOpportunityScore);
});
