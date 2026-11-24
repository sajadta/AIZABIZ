import test from 'node:test';
import assert from 'node:assert/strict';
import { rankAlphaCandidates } from '../services/bot/entryScan/alphaMatrix';

test('rankAlphaCandidates promotes actionable signals above HOLD rows', () => {
  const rows = rankAlphaCandidates([
    { signalType: 'HOLD', alphaOpportunityScore: 500, confidenceScore: 99 },
    { signalType: 'BUY', alphaOpportunityScore: 10, confidenceScore: 60 },
  ]);
  assert.equal(rows[0].signalType, 'BUY');
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].isTopPick, true);
  assert.equal(rows[1].rank, 2);
  assert.equal(rows[1].isTopPick, false);
});

test('rankAlphaCandidates orders by combined alpha and confidence', () => {
  const rows = rankAlphaCandidates([
    { signalType: 'BUY', alphaOpportunityScore: 20, confidenceScore: 70 },
    { signalType: 'SELL', alphaOpportunityScore: 45, confidenceScore: 80 },
  ]);
  assert.equal(rows[0].signalType, 'SELL');
  assert.equal(rows[1].rank, 2);
});

test('rankAlphaCandidates never marks an all-HOLD list as a top pick', () => {
  const rows = rankAlphaCandidates([{ signalType: 'HOLD' }, { signalType: 'HOLD' }]);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].isTopPick, false);
  assert.equal(rows[1].isTopPick, false);
});

test('rankAlphaCandidates handles an empty list', () => {
  assert.deepEqual(rankAlphaCandidates([]), []);
});
