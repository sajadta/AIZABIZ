import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOptionLayer } from '../../src/utils/indicators/signals/optionLayer';

const base = {
  bullishPoints: 60,
  bearishPoints: 40,
  corpScore: 0,
  rvol: 1.5,
};

test('applyOptionLayer prefers CE when bullish points dominate', () => {
  const res = applyOptionLayer(base);
  assert.equal(res.effectiveOptDir, 'CE');
});

test('applyOptionLayer prefers PE when bearish points dominate', () => {
  const res = applyOptionLayer({ ...base, bullishPoints: 20, bearishPoints: 70 });
  assert.equal(res.effectiveOptDir, 'PE');
});

test('applyOptionLayer falls back to PE when corporate score is strongly negative', () => {
  const res = applyOptionLayer({ ...base, bullishPoints: 70, bearishPoints: 30, corpScore: -20 });
  assert.equal(res.effectiveOptDir, 'PE');
});

test('applyOptionLayer rewards a healthy delta sweet spot', () => {
  const res = applyOptionLayer({
    ...base,
    optionMetrics: { ltp: 120, optionType: 'CE', delta: 0.55, gamma: 0.0012, theta: 6 },
  });
  assert.ok(res.bullishPoints > base.bullishPoints);
  assert.equal(res.effectiveOptDir, 'CE');
});

test('applyOptionLayer penalises IV crush above 45%', () => {
  const res = applyOptionLayer({
    ...base,
    optionMetrics: { ltp: 120, optionType: 'CE', delta: 0.55, gamma: 0.0012, theta: 6, iv: 60 },
  });
  assert.ok(res.bullishPoints < base.bullishPoints + 14);
});

test('applyOptionLayer describes call short covering for negative OI change', () => {
  const res = applyOptionLayer({
    ...base,
    optionMetrics: { ltp: 120, optionType: 'CE', delta: 0.55, oiChange: -5000, bidAskRatio: 1.2 },
  });
  assert.match(res.oiBuildupDesc, /Call Short Covering/);
});

test('applyOptionLayer describes put short covering for negative OI change in PE', () => {
  const res = applyOptionLayer({
    ...base,
    bullishPoints: 20,
    bearishPoints: 70,
    optionMetrics: { ltp: 90, optionType: 'PE', delta: -0.55, oiChange: -5000, bidAskRatio: 1.2 },
  });
  assert.match(res.oiBuildupDesc, /Put Short Covering/);
});

test('applyOptionLayer keeps points unchanged without option metrics', () => {
  const res = applyOptionLayer(base);
  assert.equal(res.bullishPoints, base.bullishPoints);
  assert.equal(res.bearishPoints, base.bearishPoints);
  assert.equal(res.oiBuildupDesc, 'Balanced Institutional OI');
});
