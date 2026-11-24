import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreStrikeCandidate } from '../services/bot/entryScan/strikeScoring';

const tierCfg = {
  tier: 'STANDARD',
  minLtp: 5,
  minDelta: 0.2,
  maxBrokerageDragPct: 0.3,
  getMinReqNetProfit: () => 300,
};

const base = {
  mode: 'PAPER_TRADING',
  tierCfg,
  effectiveCapital: 5000,
  entryRequiredCashForStrike: 3000,
  totalRequiredWithBrokerage: 3100,
  fitsCapital: true,
  ltp: 60,
  absDelta: 0.5,
  strikeBrokerageDragPct: 0.05,
  roiPotentialPct: 30,
  estimatedBrokerage: 72,
  expectedNetProfit: 900,
  configuredMinProfit: 300,
  bidAskSpreadPct: 0.4,
  iv: 20,
  volume: 20000,
  oi: 80000,
  closePrice: 55,
  distRatio: 0.002,
  isSmallCapitalAccount: false,
  strike: {
    strikePrice: 25000,
    optType: 'CE',
    lotSize: 75,
    delta: 0.5,
    gamma: 0.001,
    theta: -8,
    oneLotCost: 3000,
  },
  cheapestSkippedStrikeForCap: null,
};

test('scoreStrikeCandidate rewards an affordable near-ATM strike', () => {
  const res = scoreStrikeCandidate(base);
  assert.equal(res.skip, false);
  assert.ok(res.score > 500, `expected a strong score, got ${res.score}`);
});

test('scoreStrikeCandidate skips a strike that exceeds available capital', () => {
  const res = scoreStrikeCandidate({ ...base, fitsCapital: false, effectiveCapital: 1000 });
  assert.equal(res.skip, true);
});

test('scoreStrikeCandidate records the cheapest affordable-quality strike skipped for capital', () => {
  const res = scoreStrikeCandidate({ ...base, fitsCapital: false, effectiveCapital: 1000 });
  assert.equal(res.skip, true);
  assert.ok(res.cheapestSkippedStrikeForCap);
  assert.equal(res.cheapestSkippedStrikeForCap.strikePrice, 25000);
  assert.equal(res.cheapestSkippedStrikeForCap.totalRequiredWithBrokerage, 3100);
});

test('scoreStrikeCandidate blocks illiquid strikes with excessive brokerage drag', () => {
  const res = scoreStrikeCandidate({ ...base, strikeBrokerageDragPct: 0.9 });
  assert.equal(res.skip, true);
});

test('scoreStrikeCandidate penalises deep-OTM distance from spot', () => {
  const near = scoreStrikeCandidate(base);
  const far = scoreStrikeCandidate({ ...base, distRatio: 0.05 });
  assert.ok(far.score < near.score, 'far strike should score lower');
});

test('scoreStrikeCandidate penalises low ROI setups', () => {
  const good = scoreStrikeCandidate(base);
  const poor = scoreStrikeCandidate({ ...base, roiPotentialPct: 3 });
  assert.ok(poor.score < good.score);
});
